const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');

const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const TMP_LOG_DIR = '/tmp/openclaw';

const { getGatewayPort } = require('../utils');
function getGatewayToken() { try { if (fs.existsSync(OPENCLAW_CONFIG)) { const c = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8')); return c?.gateway?.auth?.token || ''; } } catch {} return ''; }

function checkPort(port) { return new Promise(r => { const s = new net.Socket(); s.setTimeout(1000); s.on('connect', () => { s.destroy(); r(true); }); s.on('timeout', () => { s.destroy(); r(false); }); s.on('error', () => { s.destroy(); r(false); }); s.connect(port, '127.0.0.1'); }); }

function setupAppMenu(mainWindow) {
  const isMac = process.platform === 'darwin';
  const appName = app.getName();

  const systemSubmenu = [
    { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
    { label: '开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow.webContents.openDevTools() },
    { type: 'separator' },
    { label: '官网', click: () => shell.openExternal('http://www.dragonclaw.cc') },
    {
      label: '关于',
      click: () => mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("open-about-modal"))'),
    },
    { type: 'separator' },
    { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
  ];

  const editSubmenu = [
    { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
    { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
    { type: 'separator' },
    { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
    { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
    { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
    { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
  ];

  const modeSubmenu = [
    { label: '本机模式', click: () => mainWindow.webContents.send('set-mode', 'local') },
    { label: '远程模式', click: () => mainWindow.webContents.send('set-mode', 'remote') },
  ];

  const openclawSubmenu = [
    {
      label: 'Web后台',
      click: async () => {
        const port = getGatewayPort();
        const token = getGatewayToken();
        const isRunning = await checkPort(port);
        if (!isRunning) { dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Gateway 未运行', message: 'OpenClaw Gateway 未运行,无法打开管理后台。', detail: '请先启动 OpenClaw Gateway' }); return; }
        let url = `http://127.0.0.1:${port}/`;
        if (token) url += `#token=${token}`;
        const w = new BrowserWindow({ width: 1200, height: 800, title: 'OpenClaw 管理后台', webPreferences: { nodeIntegration: false, contextIsolation: true } });
        w.setMenu(null); w.loadURL(url);
      },
    },
    { label: '官网', click: () => shell.openExternal('https://www.openclaw.ai') },
    { label: '文档', click: () => shell.openExternal('https://docs.openclaw.ai') },
    { label: 'GitHub', click: () => shell.openExternal('https://github.com/openclaw/openclaw') },
  ];

  const template = isMac
    ? [
        {
          label: appName,
          submenu: [
            { label: `关于 ${appName}`, click: () => mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("open-about-modal"))') },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
          ],
        },
        { label: '系统', submenu: systemSubmenu },
        { label: '编辑', submenu: editSubmenu },
        { label: '模式', submenu: modeSubmenu },
        { label: 'OpenClaw', submenu: openclawSubmenu },
      ]
    : [
        { label: '系统', submenu: systemSubmenu },
        { label: '编辑', submenu: editSubmenu },
        { label: '模式', submenu: modeSubmenu },
        { label: 'OpenClaw', submenu: openclawSubmenu },
      ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { setupAppMenu };
