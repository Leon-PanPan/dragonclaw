/**
 * Windows scanner — reads the Uninstall registry hive via `reg.exe` and
 * the HKCU Run key for autostart. No native deps; uses async execFile so
 * the worker thread never blocks the main process.
 *
 * Why `reg.exe` instead of `regedit` automation:
 *   - reg.exe ships with Windows, no install needed
 *   - Output is plain text, easy to parse
 *   - Multiple keys are queried in parallel from the worker
 */

const path = require('path');
const fs = require('fs');
const { runCmd, toFileUrl, dirSize, safeStat } = require('./common');

const UNINSTALL_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

const AUTOSTART_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
];

/**
 * Run `reg query <key>` and parse into a single map of subkey name → values.
 * Returns a Map<subkeyName, Map<valueName, valueData>>.
 */
const queryKey = async (key) => {
  const out = await runCmd('reg', ['query', key, '/s']);
  if (!out) return new Map();
  return parseRegQuery(out, key);
};

const parseRegQuery = (text, rootKey) => {
  const map = new Map();
  let current = null;
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    // New subkey header, e.g. "HKEY_LOCAL_MACHINE\...\Uninstall\Google Chrome"
    if (/^HKEY_/.test(line) || line.startsWith(rootKey)) {
      const tail = line.replace(rootKey, '').replace(/^\\+/, '');
      current = tail || '__ROOT__';
      if (!map.has(current)) map.set(current, new Map());
      continue;
    }

    if (!current) continue;

    const m = line.match(/^\s+(\S+)\s+(REG_[A-Z_]+)\s+(.*)$/);
    if (m) {
      const [, name, type, data] = m;
      map.get(current).set(name, { type, data });
    }
  }
  return map;
};

const parseInstallDate = (s) => {
  // YYYYMMDD format used by Windows Installer
  if (!s || s.length !== 8) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const dt = new Date(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt.getTime();
};

const parseSizeKb = (s) => {
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n * 1024;
};

const guessIconFromDisplayIcon = (s) => {
  if (!s) return '';
  // DisplayIcon can be: "C:\path\foo.exe", "C:\path\foo.exe,0", or "C:\path\foo.ico"
  const cleaned = s.split(',')[0].replace(/^"/, '').replace(/"$/, '');
  if (cleaned.toLowerCase().endsWith('.ico') || cleaned.toLowerCase().endsWith('.exe')) {
    return toFileUrl(cleaned);
  }
  return '';
};

const extractExeFromUninstall = (s) => {
  if (!s) return '';
  // MsiExec.exe /I{...}  /x  → leave as-is for uninstall
  // "<path>\uninst.exe" /S → return exe path
  const m = s.match(/^"?([^"]+\.exe)"?/i);
  return m ? m[1] : s;
};

const readAutostart = async () => {
  const set = new Set();
  for (const key of AUTOSTART_KEYS) {
    const map = await queryKey(key);
    for (const [, values] of map) {
      for (const [name, { data }] of values) {
        if (data && data.length) {
          set.add(name.toLowerCase());
          set.add((data.split('"')[1] || data).toLowerCase());
        }
      }
    }
  }
  return set;
};

async function* scan() {
  const autostart = await readAutostart();
  const seen = new Set();

  for (const key of UNINSTALL_KEYS) {
    const map = await queryKey(key);
    for (const [subkey, values] of map) {
      const displayName = values.get('DisplayName') && values.get('DisplayName').data;
      if (!displayName) continue; // system components / KB patches have no name
      if (seen.has(displayName.toLowerCase())) continue;
      seen.add(displayName.toLowerCase());

      const displayIcon = values.get('DisplayIcon') && values.get('DisplayIcon').data;
      const installLoc = values.get('InstallLocation') && values.get('InstallLocation').data;
      const publisher = values.get('Publisher') && values.get('Publisher').data;
      const version = values.get('DisplayVersion') && values.get('DisplayVersion').data;
      const installDate = values.get('InstallDate') && values.get('InstallDate').data;
      const sizeKb = values.get('EstimatedSize') && values.get('EstimatedSize').data;
      const uninstallStr = values.get('UninstallString') && values.get('UninstallString').data;
      const quietUninstall = values.get('QuietUninstallString') && values.get('QuietUninstallString').data;

      const exe = extractExeFromUninstall(uninstallStr);
      const autostartHit = autostart.has(displayName.toLowerCase())
        || (installLoc && autostart.has(installLoc.toLowerCase()))
        || (exe && autostart.has(exe.toLowerCase()));

      yield {
        id: `win:${subkey}`,
        name: displayName,
        publisher: publisher || '',
        version: version || '',
        icon: guessIconFromDisplayIcon(displayIcon),
        installPath: installLoc || exe,
        installDate: parseInstallDate(installDate),
        lastUsed: null, // Registry doesn't track this; would need Prefetch / RecentFiles (out of scope for v1)
        sizeBytes: parseSizeKb(sizeKb),
        autostart: !!autostartHit,
        autostartKey: displayName,
        uninstall: {
          kind: 'win-uninstall',
          payload: { command: quietUninstall || uninstallStr },
        },
        source: 'registry',
      };
    }
  }
}

// 阶段2: 加载单个应用图标（Windows）
async function loadIcon(app) {
  try {
    // Windows 图标已经在扫描时从注册表获取，不需要额外加载
    // 如果图标是 .ico 或 .exe 文件，需要转换为 base64
    const iconPath = app.icon;
    if (!iconPath || iconPath.startsWith('data:')) return iconPath;
    
    // 如果是 file:// URL，提取文件路径
    let filePath = iconPath;
    if (filePath.startsWith('file://')) {
      filePath = decodeURIComponent(filePath.replace('file://', ''));
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) return '';
    
    // 对于 .ico 文件，读取并转换为 base64
    if (filePath.toLowerCase().endsWith('.ico')) {
      const buffer = await fs.promises.readFile(filePath);
      return `data:image/x-icon;base64,${buffer.toString('base64')}`;
    }
    
    // 对于 .exe 文件，暂时返回空（需要使用 nativeImage 提取图标）
    // 这是一个简化实现，实际可能需要使用 node-exe-icon 或类似库
    return '';
  } catch (_) {
    return '';
  }
}

// 阶段3: 计算单个应用大小（Windows）
async function loadSize(app) {
  // Registry's EstimatedSize is often missing or unreliable. If we have a
  // value, use it; otherwise walk InstallLocation (or the exe's parent dir)
  // to compute an actual disk total.
  try {
    if (app.sizeBytes && app.sizeBytes > 0) return app.sizeBytes;
    const target = app.installPath || '';
    if (!target) return 0;
    const st = await safeStat(target);
    if (st && st.isDirectory()) {
      return await dirSize(target);
    }
    if (st && st.isFile()) {
      const dir = path.dirname(target);
      // Avoid walking system dirs that would balloon the result.
      if (/^(C:\\Windows|C:\\Program Files\\WindowsApps)(\\|$)/i.test(dir)) {
        return st.size;
      }
      const walked = await dirSize(dir);
      return walked > 0 ? walked : st.size;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}

module.exports = { scan, loadIcon, loadSize };
