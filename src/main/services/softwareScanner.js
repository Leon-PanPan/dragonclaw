/**
 * Software Scanner — multi-platform installed application scanner.
 *
 * Architecture:
 *   main process         → spawns a worker_threads worker to scan
 *   worker (this module is NOT the worker; see scannerWorker.js)
 *                       → reads platform-specific sources (registry / Info.plist / .desktop)
 *                         and posts each discovered app back to main as `progress` messages
 *   renderer             ← receives stream of `software:scan-progress` IPC events
 *
 * We split the worker into a separate file so it can be loaded via `new Worker(path)`
 * without polluting the main bundle.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const { app } = require('electron');

let activeWorker = null;
let activeTaskId = 0;
let activeSender = null;

function killActive() {
  if (activeWorker) {
    try { activeWorker.terminate(); } catch (_) {}
    activeWorker = null;
  }
  activeSender = null;
}

/**
 * Start a scan. Returns the taskId the renderer can correlate progress with.
 * @param {Electron.WebContents} sender  — the BrowserWindow's webContents pushing progress to
 * @returns {{ taskId: number, platform: string }}
 */
function startScan(sender) {
  killActive();
  activeTaskId += 1;
  const taskId = activeTaskId;
  activeSender = sender;

  const workerPath = path.join(__dirname, 'scannerWorker.js');
  activeWorker = new Worker(workerPath, {
    workerData: {
      taskId,
      platform: process.platform,
      homedir: app.getPath('home'),
    },
  });

  activeWorker.on('message', (msg) => {
    if (!activeSender || activeSender.isDestroyed()) return;
    if (msg.type === 'progress') {
      activeSender.send('software:scan-progress', { taskId, app: msg.app });
    } else if (msg.type === 'icon-update') {
      activeSender.send('software:icon-update', { taskId, appId: msg.appId, icon: msg.icon });
    } else if (msg.type === 'size-update') {
      activeSender.send('software:size-update', { taskId, appId: msg.appId, sizeBytes: msg.sizeBytes });
    } else if (msg.type === 'lastused-update') {
      activeSender.send('software:lastused-update', { taskId, appId: msg.appId, lastUsed: msg.lastUsed });
    } else if (msg.type === 'done') {
      activeSender.send('software:scan-done', { taskId, count: msg.count, durationMs: msg.durationMs });
    } else if (msg.type === 'error') {
      activeSender.send('software:scan-error', { taskId, error: msg.error });
    }
  });

  activeWorker.on('error', (err) => {
    if (activeSender && !activeSender.isDestroyed()) {
      activeSender.send('software:scan-error', { taskId, error: err.message });
    }
    activeWorker = null;
    activeSender = null;
  });

  activeWorker.on('exit', () => {
    if (activeWorker) activeWorker = null;
  });

  return { taskId, platform: process.platform };
}

function stopScan() {
  killActive();
}

module.exports = { startScan, stopScan };
