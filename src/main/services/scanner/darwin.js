/**
 * macOS scanner — reads /Applications, /Applications/Utilities, ~/Applications
 * and parses each .app's Info.plist for metadata. Cross-references
 * LaunchAgents plists for autostart and tries to read kMDItemLastUsedDate
 * via `mdls` for last-opened time.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  toFileUrl, dirSize, safeStat, readPlist, parsePlistXml, runCmd,
} = require('./common');

const SCAN_DIRS = [
  '/Applications',
  '/Applications/Utilities',
  '/System/Applications',
  '/System/Applications/Utilities',
];

async function* walkApps(root) {
  let entries;
  try { entries = await fs.promises.readdir(root, { withFileTypes: true }); }
  catch (_) { return; }

  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    if (!e.name.endsWith('.app')) continue;
    const full = path.join(root, e.name);
    yield full;
  }
}

const parseInfoPlist = async (appPath) => {
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  return readPlist(plistPath);
};

const findIcnsFile = (appPath, plist) => {
  if (!plist) return '';
  const candidates = [];
  if (plist.CFBundleIconFile) candidates.push(plist.CFBundleIconFile);
  if (plist.CFBundleIconName) candidates.push(plist.CFBundleIconName);
  if (Array.isArray(plist.CFBundleIconFiles)) candidates.push(...plist.CFBundleIconFiles);

  for (const name of candidates) {
    // macOS may include the .icns suffix or not — try both
    const variants = name.endsWith('.icns') ? [name] : [`${name}.icns`, name];
    for (const v of variants) {
      const p = path.join(appPath, 'Contents', 'Resources', v);
      try { if (fs.existsSync(p)) return p; } catch (_) {}
    }
  }
  // Fallback: first .icns in Resources
  try {
    const resDir = path.join(appPath, 'Contents', 'Resources');
    const items = fs.readdirSync(resDir);
    const icns = items.find((f) => f.endsWith('.icns'));
    if (icns) return path.join(resDir, icns);
  } catch (_) {}
  return '';
};

const ICON_CACHE_DIR = path.join(os.tmpdir(), 'dragonclaw-icons');

const convertIcnsToPng = async (icnsPath) => {
  // The renderer's <img> can't decode .icns; use `sips` (macOS built-in) to
  // produce a 128px PNG in a temp cache. Cache by file mtime so we re-render
  // when the app updates. Failures are non-fatal — the renderer falls back
  // to the first-letter placeholder.
  if (!icnsPath) return '';
  try {
    await fs.promises.mkdir(ICON_CACHE_DIR, { recursive: true });
    const st = await fs.promises.stat(icnsPath);
    const hash = Buffer.from(icnsPath).toString('base64url').slice(0, 40);
    const out = path.join(ICON_CACHE_DIR, `${hash}-${st.mtimeMs}.png`);
    if (!fs.existsSync(out)) {
      // `-Z 128` constrains the longest side; `-s format png` forces PNG output.
      const { spawn } = require('child_process');
      await new Promise((resolve) => {
        const child = spawn('sips', ['-s', 'format', 'png', '-Z', '128', icnsPath, '--out', out], { stdio: 'ignore' });
        const t = setTimeout(() => { try { child.kill(); } catch (_) {} resolve(); }, 5000);
        child.on('exit', () => { clearTimeout(t); resolve(); });
        child.on('error', () => { clearTimeout(t); resolve(); });
      });
    }
    if (fs.existsSync(out)) {
      // 将图片转换为 base64 格式，避免 Electron 安全限制
      const buffer = await fs.promises.readFile(out);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    return '';
  } catch (_) {
    return '';
  }
};

const readAutostart = async (homedir) => {
  // macOS tracks per-user "Open at Login" items in three places:
  //   1. ~/Library/LaunchAgents/*.plist with RunAtLoad=true (LaunchAgents)
  //   2. /Library/LaunchAgents — system agents, usually root-owned
  //   3. ~/Library/Application Support/com.apple.backgroundtaskmanagementagent/backgrounditems.btm
  //      (the modern Login Items database — NSKeyedArchiver binary plist that
  //       stores NSURL bookmarks to .app bundles registered by the user via
  //       System Settings → General → Login Items)
  //
  // We extract two views of the world:
  //   - bundleLabels: LaunchAgent plist `Label` values, used to match by bundleId
  //   - exes: every executable path mentioned in Program/ProgramArguments plus
  //           .app bundle paths decoded from the BTM database
  const exes = new Set();
  const bundleLabels = new Set();
  const dirs = [
    path.join(homedir, 'Library', 'LaunchAgents'),
    '/Library/LaunchAgents',
  ];
  for (const dir of dirs) {
    let entries;
    try { entries = await fs.promises.readdir(dir); } catch (_) { continue; }
    for (const f of entries) {
      if (!f.endsWith('.plist')) continue;
      const data = await readPlist(path.join(dir, f));
      if (!data) continue;
      if (data.RunAtLoad !== true) continue;
      const label = data.Label || f.replace(/\.plist$/, '');
      bundleLabels.add(label);
      if (Array.isArray(data.ProgramArguments)) {
        for (const arg of data.ProgramArguments) {
          if (typeof arg === 'string' && arg) exes.add(arg);
        }
      } else if (typeof data.Program === 'string') {
        exes.add(data.Program);
      }
    }
  }

  // Walk the BTM database. It's an NSKeyedArchiver plist; instead of
  // implementing a full unarchiver we ask `plutil` to extract every `bookmark`
  // data blob and decode it via macOS's `swift` or `python` — but to keep this
  // dependency-free we use a simple `plutil -convert json` and regex-scan
  // for path-like strings. A more robust implementation would use `cfprefsd`
  // / `NSURL` APIs, but this covers the common case where the path appears
  // verbatim inside the bookmark.
  const btm = path.join(homedir, 'Library', 'Application Support', 'com.apple.backgroundtaskmanagementagent', 'backgrounditems.btm');
  try {
    if (fs.existsSync(btm)) {
      const json = await runCmd('plutil', ['-convert', 'json', '-o', '-', btm]);
      if (json) {
        // bookmark data is base64-ish; look for "/Applications/" / ".app" substrings after un-archiving
        const matches = json.match(/"[^"]*\/[A-Za-z0-9._-]+\.app[^"]*"/g) || [];
        for (const m of matches) {
          const p = m.replace(/^"|"$/g, '').replace(/\\u002F/g, '/');
          if (p.startsWith('/') && p.endsWith('.app')) exes.add(p);
        }
      }
    }
  } catch (_) {}

  return { exes, bundleLabels };
};

const getLastUsed = async (appPath) => {
  const out = await runCmd('mdls', ['-name', 'kMDItemLastUsedDate', '-raw', appPath]);
  const t = (out || '').trim();
  if (!t || t === '(null)') return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.getTime();
};

const matchesAutostart = (appPath, bundleId, autostart) => {
  if (!autostart) return false;
  if (bundleId && autostart.bundleLabels.has(bundleId)) return true;
  // Walk every registered exe and check if it lives inside this .app bundle
  const appName = path.basename(appPath);
  for (const exe of autostart.exes) {
    if (!exe) continue;
    if (exe === appPath || exe.startsWith(appPath + '/')) return true;
    if (exe.includes(`/${appName}/Contents/MacOS/`)) return true;
    if (exe.includes(`/${appName}/Contents/Library/`)) return true;
    // Some apps have a separate helper .app inside Contents/Library/LoginItems
    if (exe.includes(`/Contents/Library/LoginItems/`)) return true;
  }
  return false;
};

const hasLoginItemHelper = async (appPath) => {
  // macOS apps declare helper login items under Contents/Library/LoginItems/*.app
  // (see Apple's "Adding Login Items" docs). If such a helper exists, the parent
  // app is registered as a login item by the user via the system Settings panel.
  const dir = path.join(appPath, 'Contents', 'Library', 'LoginItems');
  try {
    const entries = await fs.promises.readdir(dir);
    return entries.some((e) => e.endsWith('.app'));
  } catch (_) {
    return false;
  }
};

const guessDataDirs = (appPath, bundleId) => {
  // Best-effort list of per-app user data locations we should include in the size total.
  const homedir = os.homedir();
  const candidates = [
    path.join(homedir, 'Library', 'Application Support', bundleId || ''),
    path.join(homedir, 'Library', 'Application Support', path.basename(appPath, '.app')),
    path.join(homedir, 'Library', 'Caches', bundleId || ''),
    path.join(homedir, 'Library', 'Caches', path.basename(appPath, '.app')),
    path.join(homedir, 'Library', 'Containers', bundleId || ''),
    path.join(homedir, 'Library', 'Group Containers', `group.${bundleId || ''}`),
    path.join(homedir, 'Library', 'Saved Application State', `${bundleId}.savedState`),
  ];
  return candidates.filter((p) => {
    try { return fs.existsSync(p); } catch (_) { return false; }
  });
};

async function* scan({ homedir }) {
  const userAppsDir = path.join(homedir, 'Applications');
  const autostart = await readAutostart(homedir);
  const seen = new Set();

  const roots = [...SCAN_DIRS, userAppsDir];
  for (const root of roots) {
    for await (const appPath of walkApps(root)) {
      if (seen.has(appPath)) continue;
      seen.add(appPath);

      const plist = await parseInfoPlist(appPath);
      const stat = await safeStat(appPath);
      const name = (plist && (plist.CFBundleDisplayName || plist.CFBundleName)) || path.basename(appPath, '.app');
      const bundleId = (plist && plist.CFBundleIdentifier) || appPath;
      const version = (plist && plist.CFBundleShortVersionString) || (plist && plist.CFBundleVersion) || '';
      const publisher = (plist && plist.CFBundleDeveloperName) || (plist && plist.CFBundleSignature) || '';

      // 阶段1: 快速扫描基本信息，不转换图标，不计算大小
      const autostartMatched = matchesAutostart(appPath, bundleId, autostart);
      const hasHelper = !autostartMatched ? await hasLoginItemHelper(appPath) : false;

      yield {
        id: `darwin:${appPath}`,
        name,
        publisher,
        version,
        icon: null,  // 暂不加载
        installPath: appPath,
        installDate: stat && stat.birthtime ? stat.birthtime.getTime() : null,
        lastUsed: null,  // 暂不查询
        sizeBytes: 0,    // 暂不计算
        autostart: autostartMatched || hasHelper,
        autostartKey: bundleId,
        uninstall: {
          kind: 'mac-app',
          payload: { appPath, bundleId, dataDirs: [] },
        },
        source: 'infoPlist',
      };
    }
  }
}

// 阶段2: 加载单个应用图标
async function loadIcon(app) {
  try {
    const plist = await parseInfoPlist(app.installPath);
    if (!plist) return '';
    const icnsPath = findIcnsFile(app.installPath, plist);
    if (!icnsPath) return '';
    return await convertIcnsToPng(icnsPath);
  } catch (_) {
    return '';
  }
}

// 阶段3: 计算单个应用大小
async function loadSize(app) {
  try {
    const bundleSize = await dirSize(app.installPath);
    const dataDirs = guessDataDirs(app.installPath, app.autostartKey);
    let dataSize = 0;
    for (const d of dataDirs) dataSize += await dirSize(d);
    return bundleSize + dataSize;
  } catch (_) {
    return 0;
  }
}

// 加载单个应用的最后使用时间
async function loadLastUsed(app) {
  try {
    return await getLastUsed(app.installPath);
  } catch (_) {
    return null;
  }
}

module.exports = { scan, loadIcon, loadSize, loadLastUsed };
