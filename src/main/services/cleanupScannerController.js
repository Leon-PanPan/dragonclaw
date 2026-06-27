/**
 * Disk Cleanup Scanner — main-process controller.
 *
 * Spawns the worker thread and pipes progress/file events back to the
 * renderer via IPC. Only one scan can be active at a time; calling
 * startScan() while another is running cancels the previous one.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const { app } = require('electron');

let activeWorker = null;
let activeTaskId = 0;
let activeSender = null;

function killActive() {
  if (activeWorker) {
    try {
      activeWorker.postMessage({ cmd: 'cancel' });
    } catch (_) {}
    try { activeWorker.terminate(); } catch (_) {}
    activeWorker = null;
  }
  activeSender = null;
}

function startScan(sender) {
  killActive();
  activeTaskId += 1;
  const taskId = activeTaskId;
  activeSender = sender;

  const workerPath = path.join(__dirname, 'cleanupScanner.js');
  const worker = new Worker(workerPath, {
    workerData: {
      taskId,
      platform: process.platform,
      homedir: app.getPath('home'),
    },
  });
  activeWorker = worker;

  worker.on('message', (msg) => {
    const s = activeSender;
    if (!s || s.isDestroyed()) return;
    if (msg.type === 'started') {
      s.send('cleanup:started', { taskId, roots: msg.roots, totalRoots: msg.totalRoots });
    } else if (msg.type === 'root-start') {
      s.send('cleanup:root-start', { taskId, root: msg.root });
    } else if (msg.type === 'progress') {
      s.send('cleanup:progress', { taskId, ...msg });
    } else if (msg.type === 'file-batch') {
      s.send('cleanup:files', { taskId, entries: msg.entries });
    } else if (msg.type === 'root-done') {
      s.send('cleanup:root-done', { taskId, root: msg.root, scannedFiles: msg.scannedFiles });
    } else if (msg.type === 'done') {
      s.send('cleanup:done', { taskId, scannedFiles: msg.scannedFiles, foundFiles: msg.foundFiles, durationMs: msg.durationMs, cancelled: msg.cancelled });
      activeWorker = null;
      activeSender = null;
    } else if (msg.type === 'error') {
      s.send('cleanup:error', { taskId, error: msg.error });
      activeWorker = null;
      activeSender = null;
    }
  });

  worker.on('error', (err) => {
    const s = activeSender;
    if (s && !s.isDestroyed()) s.send('cleanup:error', { taskId, error: err.message });
    activeWorker = null;
    activeSender = null;
  });

  worker.on('exit', () => {
    if (activeWorker === worker) activeWorker = null;
  });

  return { taskId };
}

function stopScan() {
  killActive();
}

module.exports = { startScan, stopScan };
