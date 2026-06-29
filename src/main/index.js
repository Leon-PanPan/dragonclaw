/**
 * DragonClaw — Electron Main Process
 *
 * Architecture:
 *   shared/ipc-channels.js    — single source of truth for all IPC names
 *   main/ipc/*.js              — auto-register IPC handlers (require = register)
 *   main/database/             — SQLite data access layer
 *   main/services/             — business logic (menu, env checker)
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const previewProtocol = require('./services/previewProtocol');

// Register privileged custom scheme BEFORE app is ready.
previewProtocol.registerSchemePrivileges();

// ── GPU / network ──
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-features', 'NetworkService');
app.commandLine.appendSwitch('log-level', '0');

// 允许渲染进程从 localhost / file:// 访问私有网络（192.168.x.x、10.x、172.16-31.x）。
// Chromium 124+ 默认会拦截此类请求并报 ERR_ADDRESS_UNREACHABLE，
// 这里显式禁用该检查，避免开发模式下远程模式测试连接失败。
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreviews'
);

// ── PATH 增强 ──
// macOS/Linux 上从 Finder / Launch Services 启动的 Electron 应用
// 不会继承用户 shell 的 PATH，必须主动把常见安装目录（/usr/local/bin、
// /opt/homebrew/bin、~/.nvm/versions/node/current/bin 等）追加进来，
// 否则后续 `node -v` / `npm -v` / `openclaw -v` 这类命令无法解析。
require('./utils').augmentPath();

// ── Paths ──
const os = require('os');
const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const DRAGONCLAW_DIR = path.join(os.homedir(), '.dragonclaw');

// ── Database ──
const { initDatabase } = require('./database');

// ── Services ──
const { setupAppMenu } = require('./services/menu');

let mainWindow = null;

const ICONS_DIR = path.join(__dirname, '../assets/icons');

// Each platform has different expectations around icon padding:
//   macOS  — Apple HIG: keep ~10% inner safe area; the artwork already
//            ships with that margin baked in (icon-mac-*.png).
//   Windows — Windows applies its own corner mask, so the source must
//            be full-bleed (icon-win-512.png).
//   Linux  — Most desktop environments expect a square, full-bleed PNG
//            (icon-linux-512.png). The window icon drives the taskbar
//            and launcher icon at runtime.
function pickIcons() {
  if (process.platform === 'darwin') {
    return {
      window: path.join(ICONS_DIR, 'icon-mac-256.png'),
      dock:   path.join(ICONS_DIR, 'icon-mac-1024.png'),
    };
  }
  if (process.platform === 'win32') {
    return {
      window: path.join(ICONS_DIR, 'icon-win-512.png'),
      dock:   path.join(ICONS_DIR, 'icon-win-512.png'),
    };
  }
  // Linux + others
  return {
    window: path.join(ICONS_DIR, 'icon-linux-512.png'),
    dock:   path.join(ICONS_DIR, 'icon-linux-512.png'),
  };
}

function createWindow() {
  const { window: windowIcon, dock: dockIcon } = pickIcons();

  // macOS: override the runtime dock icon (used when launched via
  // `electron .` outside a packaged .app bundle). No-op on other
  // platforms. `app.dock` only exists on darwin.
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(dockIcon); } catch {}
  }

  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600, icon: windowIcon,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      webSecurity: process.env.NODE_ENV !== 'development',
    },
    frame: true, titleBarStyle: 'default',
  });

  // 设置合理的 Content-Security-Policy，消除 DevTools 的不安全 CSP 警告。
  // 允许 connect 到任意 ws/wss（远程模式需要连接局域网 IP）和 http/https。
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "connect-src 'self' ws: wss: http: https:; " +
          "img-src 'self' data: blob: http: https:; " +
          "media-src 'self' data: blob: http: https:; " +
          "font-src 'self' data: blob:;"
        ],
      },
    });
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  if (isDev) {
    const viteUrl = 'http://127.0.0.1:5177';
    const http = require('http');
    const check = setInterval(() => {
      http.get(viteUrl, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ if(d.includes('<div id="app">')){ clearInterval(check); mainWindow.loadURL(viteUrl); } }); }).on('error',()=>{});
    }, 500);
    setTimeout(() => clearInterval(check), 60000);
  } else {
    const prodPath = path.join(__dirname, '../../renderer/dist/index.html');
    if (fs.existsSync(prodPath)) mainWindow.loadFile(prodPath).catch(console.error);
    else require('electron').dialog.showErrorBox('错误', '请先运行 npx vite build');
  }

  setupAppMenu(mainWindow);
  previewProtocol.registerHandler();
}

// ── App Lifecycle ──
app.whenReady().then(async () => {
  await initDatabase(OPENCLAW_CONFIG, DRAGONCLAW_DIR);

  // Auto-register all IPC handlers — each require() call registers its handlers
  require('./ipc/agent');
  require('./ipc/session');
  require('./ipc/gateway');
  require('./ipc/files');
  require('./ipc/skills');
  require('./ipc/installer');
  require('./ipc/updater');
  require('./ipc/software');
  require('./ipc/cleanup');


  createWindow();

  try {
    const Updater = require('./services/updater');
    const updater = new Updater(mainWindow);
    require('./ipc/installer').setUpdater(updater);
    require('./ipc/updater').setUpdater(updater);
  } catch (e) {
    // Updater 初始化失败不影响主流程
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
