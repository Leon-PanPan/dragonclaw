/**
 * Linux scanner — parses .desktop files in standard XDG locations plus
 * Flatpak/Snap exports. Autostart comes from ~/.config/autostart.
 *
 * The .desktop spec is line-based key=value with [Section] headers, which
 * is trivial to parse without external deps.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pExecFile = promisify(execFile);
const { toFileUrl, safeStat, readFileUtf8, dirSize } = require('./common');

const DESKTOP_DIRS = [
  '/usr/share/applications',
  '/usr/local/share/applications',
  '/var/lib/flatpak/exports/share/applications',
  '/var/lib/snapd/desktop/applications',
];

const ICON_THEME_DIRS = [
  '/usr/share/icons/hicolor',
  '/usr/share/icons/gnome',
  '/var/lib/flatpak/exports/share/icons/hicolor',
];

const AUTOSTART_DIR = (homedir) => path.join(homedir, '.config', 'autostart');

const parseDesktop = (text) => {
  const map = {};
  let inDesktopEntry = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inDesktopEntry = line === '[Desktop Entry]';
      continue;
    }
    if (!inDesktopEntry) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    map[key] = val;
  }
  return map;
};

const findIconFile = (iconSpec) => {
  if (!iconSpec) return '';
  // Absolute path → use directly
  if (iconSpec.startsWith('/') && fs.existsSync(iconSpec)) return iconSpec;
  // Otherwise search the icon theme for name + .png/.svg
  for (const theme of ICON_THEME_DIRS) {
    if (!fs.existsSync(theme)) continue;
    // Common sizes to try
    const sizes = ['48x48', '64x64', '128x128', '256x256', 'scalable'];
    for (const size of sizes) {
      for (const ext of ['.png', '.svg', '.xpm']) {
        for (const cat of ['apps', 'categories', 'status']) {
          const candidate = path.join(theme, size, cat, iconSpec + ext);
          try { if (fs.existsSync(candidate)) return candidate; } catch (_) {}
        }
      }
    }
  }
  return '';
};

const AUTOSTART_KEYS = new Set(['autostart', 'startup']);

const readAutostart = async (homedir) => {
  const set = new Map(); // desktop id → { file, exec }
  const dir = AUTOSTART_DIR(homedir);
  let entries;
  try { entries = await fs.promises.readdir(dir); } catch (_) { return set; }
  for (const f of entries) {
    if (!f.endsWith('.desktop')) continue;
    const text = await readFileUtf8(path.join(dir, f));
    if (!text) continue;
    const d = parseDesktop(text);
    if (d.Hidden === 'true' || d.NoDisplay === 'true') continue;
    if (d.Type && d.Type !== 'Application') continue;
    const exec = (d.Exec || '').split(' ')[0] || f;
    set.set(d.Name || f, { file: path.join(dir, f), exec });
  }
  return set;
};

const stripExec = (exec) => {
  // Remove field codes (%u, %U, %f, %F, %i, %c, %k) and quoting wrappers
  return (exec || '')
    .replace(/%.$/g, '')
    .replace(/%[uUfFdic]/g, '')
    .replace(/^"([^"]+)"$/, '$1')
    .trim();
};

async function* scan({ homedir }) {
  const userDir = path.join(homedir, '.local', 'share', 'applications');
  const autostart = await readAutostart(homedir);
  const seen = new Set();

  const dirs = [...DESKTOP_DIRS, userDir];
  for (const dir of dirs) {
    let entries;
    try { entries = await fs.promises.readdir(dir); } catch (_) { continue; }
    for (const f of entries) {
      if (!f.endsWith('.desktop')) continue;
      const full = path.join(dir, f);
      if (seen.has(full)) continue;
      seen.add(full);

      const text = await readFileUtf8(full);
      if (!text) continue;
      const d = parseDesktop(text);
      if (d.Type && d.Type !== 'Application') continue;
      if (d.NoDisplay === 'true') continue;

      const name = d.Name || d.GenericName || f.replace(/\.desktop$/, '');
      const execRaw = d.Exec || '';
      const exec = stripExec(execRaw);
      const execName = exec.split('/').pop();
      const iconSpec = d.Icon || '';
      const iconPath = findIconFile(iconSpec);
      const stat = await safeStat(full);
      const autostartHit = autostart.has(name) || (execName && [...autostart.values()].some((v) => v.exec.endsWith('/' + execName)));

      yield {
        id: `linux:${full}`,
        name,
        publisher: '',
        version: '',
        icon: iconPath ? toFileUrl(iconPath) : '',
        installPath: exec,
        installDate: stat && stat.mtime ? stat.mtime.getTime() : null,
        lastUsed: null, // Linux has no standard "last used" for apps; would need .recently-used.xbel
        sizeBytes: 0,
        autostart: !!autostartHit,
        autostartKey: name,
        uninstall: {
          kind: 'linux-desktop',
          payload: { desktopFile: full, exec, packageManagerHint: d.Icon && execRaw.includes('flatpak') ? 'flatpak' : '' },
        },
        source: 'desktop',
      };
    }
  }
}

// 阶段2: 加载单个应用图标（Linux）
async function loadIcon(app) {
  try {
    // Linux 图标已经在扫描时从文件系统获取，需要转换为 base64
    const iconPath = app.icon;
    if (!iconPath || iconPath.startsWith('data:')) return iconPath;
    
    // 如果是 file:// URL，提取文件路径
    let filePath = iconPath;
    if (filePath.startsWith('file://')) {
      filePath = decodeURIComponent(filePath.replace('file://', ''));
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) return '';
    
    // 读取图片并转换为 base64
    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.xpm') mimeType = 'image/x-xpixmap';
    
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return '';
  }
}

// 阶段3: 计算单个应用大小（Linux）
async function loadSize(app) {
  // Best-effort disk usage:
  //   - If Exec points to a binary file → stat the file (real on-disk size)
  //   - If it's a flatpak → du -sb on /var/lib/flatpak/app/<id>
  //   - If installPath is a directory → du -sb (capped)
  //   - If binary lives in a system dir (/usr/bin, /bin, /snap) → fall back to file stat only
  try {
    const exec = app.installPath || '';
    const st = await safeStat(exec);
    if (st && st.isFile()) {
      const dir = path.dirname(exec);
      const inSystemDir = /^\/(usr\/s?bin|bin|sbin|snap)(\/|$)/.test(dir);
      if (!inSystemDir) {
        // For self-contained bundles (AppImage, /opt/xxx), use du -sb which is fast.
        const out = await new Promise((resolve) => {
          pExecFile('du', ['-sb', dir], { timeout: 8000 })
            .then(({ stdout }) => resolve(stdout || ''))
            .catch(() => resolve(''));
        });
        const n = parseInt((out || '').split(/\s+/)[0], 10);
        if (n > 0) return n;
      }
      return st.size;
    }
    if (st && st.isDirectory()) {
      const out = await new Promise((resolve) => {
        pExecFile('du', ['-sb', exec], { timeout: 8000 })
          .then(({ stdout }) => resolve(stdout || ''))
          .catch(() => resolve(''));
      });
      const n = parseInt((out || '').split(/\s+/)[0], 10);
      if (n > 0) return n;
      return await dirSize(exec);
    }
    // Try du for flatpak installs
    const flatpakMatch = exec.match(/flatpak\s+run\s+([^\s]+)/);
    if (flatpakMatch) {
      const out = await new Promise((resolve) => {
        pExecFile('du', ['-sb', `/var/lib/flatpak/app/${flatpakMatch[1]}`], { timeout: 8000 })
          .then(({ stdout }) => resolve(stdout || ''))
          .catch(() => resolve(''));
      });
      const n = parseInt((out || '').split(/\s+/)[0], 10);
      if (n > 0) return n;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}

module.exports = { scan, loadIcon, loadSize };
