/**
 * Scanner Worker — runs in a separate thread.
 * Receives { taskId, platform, homedir } via workerData and emits:
 *   { type: 'progress', app }    — one discovered application
 *   { type: 'icon-update', appId, icon } — icon loaded for an app
 *   { type: 'size-update', appId, sizeBytes, lastUsed } — size calculated for an app
 *   { type: 'done', count, durationMs }
 *   { type: 'error', error }
 *
 * Per-platform implementations live in ./scanner/{darwin,win32,linux}.js
 * and each exposes:
 *   async function* scan({ homedir, parentPort })
 *     → async generator yielding normalized `app` objects
 *   async function loadIcon(app)  (optional)
 *     → loads icon for a single app
 *   async function loadSize(app)  (optional)
 *     → calculates size for a single app
 */

const { parentPort, workerData } = require('worker_threads');
const { platform, homedir } = workerData;

let platformScanner;
if (platform === 'darwin') {
  platformScanner = require('./scanner/darwin');
} else if (platform === 'win32') {
  platformScanner = require('./scanner/win32');
} else {
  platformScanner = require('./scanner/linux');
}

(async () => {
  const startedAt = Date.now();
  let count = 0;
  const apps = [];
  
  try {
    // 阶段1: 快速扫描基本信息
    for await (const app of platformScanner.scan({ homedir })) {
      count += 1;
      apps.push(app);
      parentPort.postMessage({ type: 'progress', app });
    }
    
    // 阶段2: 后台加载图标（逐个）
    if (typeof platformScanner.loadIcon === 'function') {
      for (const app of apps) {
        try {
          const icon = await platformScanner.loadIcon(app);
          if (icon) {
            parentPort.postMessage({ type: 'icon-update', appId: app.id, icon });
          }
        } catch (_) {
          // 图标加载失败，忽略
        }
      }
    }
    
    // 阶段3: 后台计算大小和最后使用时间（逐个）
    if (typeof platformScanner.loadSize === 'function') {
      for (const app of apps) {
        try {
          const sizeBytes = await platformScanner.loadSize(app);
          parentPort.postMessage({ type: 'size-update', appId: app.id, sizeBytes });
        } catch (_) {
          // 大小计算失败，忽略
        }
      }
    }
    
    // 加载最后使用时间
    if (typeof platformScanner.loadLastUsed === 'function') {
      for (const app of apps) {
        try {
          const lastUsed = await platformScanner.loadLastUsed(app);
          if (lastUsed) {
            parentPort.postMessage({ type: 'lastused-update', appId: app.id, lastUsed });
          }
        } catch (_) {
          // 忽略
        }
      }
    }
    
    parentPort.postMessage({ type: 'done', count, durationMs: Date.now() - startedAt });
  } catch (err) {
    parentPort.postMessage({ type: 'error', error: err && err.message ? err.message : String(err) });
  }
})();
