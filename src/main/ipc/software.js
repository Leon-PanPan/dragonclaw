/**
 * Software Manager IPC — bridges renderer ↔ scanner service.
 *
 * Channels (see shared/ipc-channels.js):
 *   software:scan            → start a new scan, returns { taskId, platform }
 *   software:stop-scan       → cancel the running scan
 *   software:toggle-autostart → { app, enabled }  returns success/error
 *   software:uninstall       → { app }            returns success/error
 *   software:launch          → { app }            returns success/error
 *
 * Pushed events:
 *   software:scan-progress   → { taskId, app }   — one app discovered
 *   software:scan-done       → { taskId, count, durationMs }
 *   software:scan-error      → { taskId, error }
 */

const { ipcMain, shell, BrowserWindow, app: electronApp } = require('electron');
const path = require('path');
const fs = require('fs');
const CH = require('../../../shared/ipc-channels');
const { startScan, stopScan } = require('../services/softwareScanner');
const { runCmd } = require('../services/scanner/common');

ipcMain.handle(CH.SCAN_SOFTWARE, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return startScan(win ? win.webContents : event.sender);
});

ipcMain.handle(CH.STOP_SCAN_SOFTWARE, () => {
  stopScan();
  return { success: true };
});

ipcMain.handle(CH.TOGGLE_AUTOSTART, async (event, { app: target, enabled }) => {
  if (!target || !target.id) return { success: false, error: 'invalid app' };
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      const { id, installPath } = target;
      if (!id || !installPath) return { success: false, error: 'missing bundle id' };
      const agentDir = path.join(electronApp.getPath('home'), 'Library', 'LaunchAgents');
      const plistPath = path.join(agentDir, `${id}.plist`);
      if (enabled) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${id}</string>
  <key>ProgramArguments</key><array><string>open</string><string>${installPath}</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>`;
        await fs.promises.mkdir(agentDir, { recursive: true });
        await fs.promises.writeFile(plistPath, xml, 'utf8');
      } else {
        try { await fs.promises.unlink(plistPath); } catch (_) {}
      }
    } else if (platform === 'win32') {
      const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
      const { name, installPath } = target;
      if (enabled) {
        const value = `"${installPath}"`;
        await runCmd('reg', ['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f']);
      } else {
        await runCmd('reg', ['delete', key, '/v', name, '/f']);
      }
    } else {
      const autostartDir = path.join(electronApp.getPath('home'), '.config', 'autostart');
      const file = path.join(autostartDir, `${(target.name || 'app').replace(/[^\w.-]+/g, '_')}.desktop`);
      if (enabled) {
        const text = `[Desktop Entry]
Type=Application
Name=${target.name || 'App'}
Exec=${target.installPath || ''}
X-GNOME-Autostart-enabled=true
`;
        await fs.promises.mkdir(autostartDir, { recursive: true });
        await fs.promises.writeFile(file, text, 'utf8');
      } else {
        try { await fs.promises.unlink(file); } catch (_) {}
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(CH.UNINSTALL_SOFTWARE, async (event, { app: target }) => {
  if (!target || !target.uninstall) return { success: false, error: 'no uninstall info' };
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      const { appPath } = target.uninstall.payload || {};
      if (!appPath) return { success: false, error: 'missing app path' };
      // macOS apps have no standard uninstaller — move the .app bundle to Trash.
      // shell.trashItem uses the system Trash on macOS.
      await shell.trashItem(appPath);
      return { success: true, note: '已移至废纸篓' };
    }
    if (platform === 'win32') {
      const { command } = target.uninstall.payload || {};
      if (!command) return { success: false, error: 'missing uninstall command' };
      const { spawn } = require('child_process');
      spawn(command, { detached: true, stdio: 'ignore', shell: true }).unref();
      return { success: true };
    }
    // Linux
    const { desktopFile, exec, packageManagerHint } = target.uninstall.payload || {};
    if (packageManagerHint === 'flatpak' || (exec && exec.includes('flatpak'))) {
      const appId = (exec.match(/flatpak\s+run\s+([^\s]+)/) || [])[1];
      if (appId) {
        try {
          const { execFile } = require('child_process');
          const { promisify } = require('util');
          await promisify(execFile)('flatpak', ['uninstall', '-y', appId], { timeout: 60000 });
          return { success: true };
        } catch (err) {
          // Fall through to desktop-file trash below.
        }
      }
    }
    if (desktopFile) {
      // Move the .desktop entry to Trash via Electron's shell.trashItem (uses
      // XDG trash on Linux). Also try to remove the binary itself when it
      // lives in a user-writable location (e.g. ~/.local/bin).
      await shell.trashItem(desktopFile);
      if (exec && !exec.includes(' ')) {
        try {
          const st = await fs.promises.stat(exec);
          // Only trash user-owned executables; skip system binaries.
          const inUserDir = exec.startsWith(require('os').homedir());
          if (st.isFile() && inUserDir) {
            await shell.trashItem(exec);
          }
        } catch (_) { /* binary not accessible — that's fine */ }
      }
      return { success: true, note: '已移至回收站' };
    }
    return { success: false, error: 'no supported uninstall method' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(CH.LAUNCH_SOFTWARE, async (event, { app: target }) => {
  if (!target || !target.installPath) return { success: false, error: 'no install path' };
  try {
    if (process.platform === 'darwin') {
      await runCmd('open', [target.installPath]);
    } else if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      spawn(target.installPath, { detached: true, stdio: 'ignore' }).unref();
    } else {
      const { spawn } = require('child_process');
      const exe = target.installPath.split(' ')[0];
      spawn(exe, { detached: true, stdio: 'ignore' }).unref();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
