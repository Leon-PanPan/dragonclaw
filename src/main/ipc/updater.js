const { ipcMain, app } = require('electron');
const CH = require('../../../shared/ipc-channels');

let _updater = null;

// 检查更新（同步，手动点击按钮时使用，立即返回完整结果）
ipcMain.handle(CH.CHECK_FOR_UPDATES, async () => {
  if (!_updater) {
    return { hasUpdate: false, error: '更新器未初始化' };
  }
  try {
    const result = await _updater.checkForUpdate();
    return result;
  } catch (error) {
    return { hasUpdate: false, error: error.message };
  }
});

// 检查更新（非阻塞，自动启动时使用）
// 调用 checkForUpdateAsync() 后立即返回 { pending: true }，
// 真正的检查在后台执行，完成后通过 'update-check-status' 事件推送到渲染层。
ipcMain.handle(CH.CHECK_FOR_UPDATES_ASYNC, async () => {
  if (!_updater) {
    return { pending: false, error: '更新器未初始化' };
  }
  try {
    const accepted = _updater.checkForUpdateAsync();
    return { pending: !!accepted };
  } catch (error) {
    return { pending: false, error: error.message };
  }
});

// 下载更新
ipcMain.handle(CH.DOWNLOAD_UPDATE, async () => {
  if (!_updater) {
    return { success: false, error: '更新器未初始化' };
  }
  try {
    const result = await _updater.downloadUpdate();
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 安装 exe 更新
ipcMain.handle(CH.INSTALL_EXE_UPDATE, async (event, exePath) => {
  if (!_updater) {
    return { success: false, error: '更新器未初始化' };
  }
  try {
    await _updater.installExeUpdate(exePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 通用 HTTP 请求 API(解决跨域问题)
ipcMain.handle(CH.FETCH_API, async (event, { url, method = 'GET', headers = {}, body = null }) => {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const http = isHttps ? require('https') : require('http');

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'User-Agent': 'dragonclaw/1.0',
          ...headers
        },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            success: true,
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: '请求超时' });
      });

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

function setUpdater(updater) { _updater = updater; }

module.exports = { setUpdater };
