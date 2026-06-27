/**
 * dragonclaw 更新器模块
 * 独立于主业务逻辑，负责检查更新、下载更新、安装更新
 * 防止更新失败导致主程序白屏
 *
 * 更新检测统一走 config.json 的 api.versionCheck 路径 + sign=dragonclaw
 * 一次 API 请求返回所有组件（dragonclaw / openclaw / nodejs）的更新信息
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const { getMachineId } = require('../utils');
const APP_CONFIG = require('../../shared/config');

const UPDATE_TEMP_PATH = path.join(app.getPath('userData'), 'update-temp');

function getEnvVersions() {
  return new Promise((resolve) => {
    const result = { nodejs: '', npm: '', openclaw: '' };
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? true : '/bin/bash';

    try {
      try {
        const nodeVersion = require('child_process').execSync('node -v', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (nodeVersion) result.nodejs = nodeVersion.replace(/^v/, '');
      } catch {
      }

      exec('npm -v', { timeout: 5000, shell }, (err, stdout) => {
        if (!err && stdout) result.npm = stdout.trim();

        const openclawCmd = isWindows
          ? 'openclaw --version'
          : 'openclaw --version 2>/dev/null || echo ""';
        exec(openclawCmd, { timeout: 5000, shell }, (err2, stdout2) => {
          if (!err2 && stdout2) {
            const match = stdout2.trim().match(/(\d+\.\d+\.\d+)/);
            if (match) result.openclaw = match[1];
          }
          resolve(result);
        });
      });
    } catch {
      resolve(result);
    }
  });
}

function getClawcPlatform() {
  const p = process.platform;
  if (p === 'darwin') return os.arch() === 'arm64' ? 'mac_m' : 'mac_intel';
  if (p === 'win32') return 'win';
  return 'linux';
}

class Updater {
  constructor(mainWindow, sendProgressCallback) {
    this.mainWindow = mainWindow;
    this.sendProgress = sendProgressCallback || (() => {});
    this.currentVersion = app.getVersion();
    this.updateInfo = null;
    this.isChecking = false;
    this.isDownloading = false;

    if (!fs.existsSync(UPDATE_TEMP_PATH)) {
      fs.mkdirSync(UPDATE_TEMP_PATH, { recursive: true });
    }
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
    this.sendProgress(channel, data);
  }

  /**
   * 检查更新（统一 API，sign=dragonclaw，返回所有组件更新信息）
   *
   * 返回值：{ hasUpdate, version, force, silent, title, scriptUrl, fileUrl, note }
   * 副作用：
   *   - dragonclaw 有更新 → 发送 'update-available' 事件给渲染进程（VersionChecker 弹窗）
   *   - openclaw/nodejs 有更新 → 发送 'component-update-available' 事件给渲染进程（通知条）
   */
  async checkForUpdate() {
    if (this.isChecking) {
      console.log('[Updater] 正在检查更新，跳过...');
      return this.updateInfo;
    }

    this.isChecking = true;
    console.log('[Updater] 开始检查更新...');

    try {
      const env = await getEnvVersions();
      const machineId = getMachineId();
      console.log('[Updater] 环境版本:', JSON.stringify(env));
      console.log('[Updater] machineId:', machineId);

      const cfg = APP_CONFIG.clawc;
      const domain = cfg.domain;
      const apiPath = cfg.api?.versionCheck || 'index.php/addons/clawc/version/check';
      const params = new URLSearchParams({
        version: this.currentVersion,
        platform: getClawcPlatform(),
        sign: 'dragonclaw',
        uuid: machineId,
        nodejs_version: env.nodejs || '',
        npm_version: env.npm || '',
        openclaw_version: env.openclaw || '',
      });
      const url = `${domain}/${apiPath}?${params.toString()}`;

      console.log('[Updater] 请求 URL:', url);

      const rawResponse = await this.httpGet(url);
      const response = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

      console.log('[Updater] 原始响应:', JSON.stringify(response));

      const body = response.data;

      if (!body) {
        throw new Error('API 返回异常: 响应数据为空');
      }

      console.log('[Updater] 解析后 data:', JSON.stringify(body));

      // ── dragonclaw 自身更新 ──
      const dc = body.dragonclaw;

      if (dc && dc.update) {
        this.updateInfo = {
          hasUpdate: true,
          version: dc.current,
          title: dc.note || '',
          note: dc.note || '',
          force: !!dc.force,
          silent: !!dc.silent,
          scriptUrl: dc.script_url || '',
          fileUrl: dc.file_url || '',
        };

        console.log('[Updater] DragonClaw 发现新版本:', this.updateInfo.version);

        if (dc.silent) {
          console.log('[Updater] 静默更新，开始后台下载...');
          this.downloadUpdate().catch(err => {
            console.error('[Updater] 静默更新下载失败:', err.message);
          });
          return this.updateInfo;
        }

        this.sendToRenderer('update-available', this.updateInfo);
      } else {
        this.updateInfo = {
          hasUpdate: false,
          version: this.currentVersion,
        };
        console.log('[Updater] DragonClaw 当前已是最新版本');
      }

      // ── openclaw / nodejs 组件更新 → 发送 component-update-available 事件 ──
      const componentUpdates = {};
      for (const key of ['nodejs', 'openclaw']) {
        const comp = body[key];
        if (comp && comp.update) {
          componentUpdates[key] = {
            key,
            label: key === 'nodejs' ? 'Node.js' : 'OpenClaw',
            update: true,
            force: !!comp.force,
            silent: !!comp.silent,
            version: comp.version || '',
            current: comp.current || '',
            note: comp.note || '',
            script_url: comp.script_url || '',
            file_url: comp.file_url || '',
          };
        }
      }

      if (Object.keys(componentUpdates).length > 0) {
        console.log('[Updater] 发现组件更新:', Object.keys(componentUpdates).join(', '));
        this.sendToRenderer('component-update-available', componentUpdates);
      }

      return this.updateInfo;
    } catch (error) {
      console.error('[Updater] 检查更新失败:', error.message);
      return { hasUpdate: false, error: error.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 非阻塞版本检查：立即返回 true/false 表示是否接受任务，
   * 后台执行 checkForUpdate()，完成后通过 'update-check-status' 事件推送结果。
   * 用于 IPC CHECK_FOR_UPDATES handler，避免渲染层 await 时阻塞 UI 启动。
   */
  checkForUpdateAsync() {
    if (this.isChecking) {
      console.log('[Updater] 正在检查更新，跳过...');
      return false;
    }

    this.isChecking = true;
    console.log('[Updater] 开始检查更新...');

    this.checkForUpdate()
      .then((result) => {
        this.sendToRenderer('update-check-status', {
          ok: true,
          hasUpdate: !!(result && result.hasUpdate),
          version: result?.version || '',
          force: !!(result && result.force),
          silent: !!(result && result.silent),
          title: result?.title || '',
          scriptUrl: result?.scriptUrl || '',
          note: result?.note || ''
        });
      })
      .catch((err) => {
        console.error('[Updater] 检查更新失败:', err.message);
        this.sendToRenderer('update-check-status', {
          ok: false,
          error: err.message
        });
      })
      .finally(() => {
        this.isChecking = false;
      });

    return true;
  }

  async downloadUpdate() {
    if (!this.updateInfo || !this.updateInfo.hasUpdate) {
      console.log('[Updater] 没有可用更新');
      return false;
    }

    if (this.isDownloading) {
      console.log('[Updater] 正在下载中...');
      return false;
    }

    this.isDownloading = true;
    const { version, scriptUrl } = this.updateInfo;

    console.log('[Updater] 开始下载更新:', version);

    try {
      await this.downloadFullUpdate(scriptUrl, version);
      return true;
    } catch (error) {
      console.error('[Updater] 下载更新失败:', error.message);
      this.sendToRenderer('update-error', { message: error.message });
      return false;
    } finally {
      this.isDownloading = false;
    }
  }

  async downloadFullUpdate(scriptUrl, version) {
    console.log('[Updater] 全量更新，获取安装脚本:', scriptUrl);

    this.sendToRenderer('update-progress', {
      stage: 'fetching',
      message: '正在获取安装脚本...',
    });

    const rawResponse = await this.httpGet(scriptUrl);
    const response = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

    if (response.status !== 200) {
      throw new Error('获取安装脚本失败: ' + (response.message || ''));
    }

    const scripts = response.data?.scripts || [];

    if (scripts.length === 0) {
      throw new Error('安装脚本为空');
    }

    console.log('[Updater] 获取到', scripts.length, '个安装步骤');

    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      this.sendToRenderer('update-progress', {
        stage: 'installing',
        message: `正在执行: ${s.name}`,
        progress: Math.floor(((i + 1) / scripts.length) * 100),
        step: s.step,
        stepName: s.name,
      });

      console.log(`[Updater] 步骤 ${s.step}: ${s.name}`);
      console.log(`[Updater] 命令: ${s.command}`);

      await this.execCommand(s.command);
    }

    this.sendToRenderer('update-progress', {
      stage: 'done',
      message: '更新完成！',
      success: true,
      silent: this.updateInfo.silent,
    });

    console.log('[Updater] 全量更新完成');
  }

  async downloadIncrementUpdate(scriptUrl, version) {
    console.log('[Updater] 增量更新，获取脚本:', scriptUrl);

    this.sendToRenderer('update-progress', {
      stage: 'fetching',
      message: '正在获取更新脚本...',
    });

    const rawResponse = await this.httpGet(scriptUrl);
    const response = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;

    if (response.status !== 200) {
      throw new Error('获取安装脚本失败: ' + (response.message || ''));
    }

    const scripts = response.data?.scripts || [];

    if (scripts.length === 0) {
      throw new Error('安装脚本为空');
    }

    console.log('[Updater] 获取到', scripts.length, '个步骤（增量）');

    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      if (s.name && s.name.includes('Node.js')) {
        console.log('[Updater] 增量更新，跳过:', s.name);
        continue;
      }

      this.sendToRenderer('update-progress', {
        stage: 'installing',
        message: `正在执行: ${s.name}`,
        progress: 100,
        step: s.step,
        stepName: s.name,
      });

      console.log(`[Updater] 步骤 ${s.step}: ${s.name}`);
      console.log(`[Updater] 命令: ${s.command}`);

      await this.execCommand(s.command);
    }

    this.sendToRenderer('update-progress', {
      stage: 'done',
      message: '增量更新完成！',
      success: true,
      silent: this.updateInfo.silent,
    });

    console.log('[Updater] 增量更新完成');
  }

  execCommand(command) {
    return new Promise((resolve, reject) => {
      const opts = {
        timeout: 120000,
        shell: process.platform === 'win32' ? 'powershell' : '/bin/bash',
      };
      exec(command, opts, (error, stdout, stderr) => {
        if (error) {
          console.error('[Updater] 命令执行失败:', stderr || error.message);
          reject(error);
        } else {
          console.log('[Updater] 输出:', stdout?.trim() || '(无)');
          resolve();
        }
      });
    });
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
    });
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  getUpdateInfo() {
    return this.updateInfo;
  }

  clearCache() {
    try {
      if (fs.existsSync(UPDATE_TEMP_PATH)) {
        fs.rmSync(UPDATE_TEMP_PATH, { recursive: true, force: true });
        fs.mkdirSync(UPDATE_TEMP_PATH, { recursive: true });
      }
      console.log('[Updater] 更新缓存已清理');
    } catch (error) {
      console.error('[Updater] 清理缓存失败:', error.message);
    }
  }

  installExeUpdate(exePath) {
    return new Promise((resolve, reject) => {
      try {
        const { exec } = require('child_process');
        const cmd = process.platform === 'win32'
          ? `start "" "${exePath}"`
          : `open "${exePath}"`;
        exec(cmd, { timeout: 5000 }, (error) => {
          if (error) reject(error);
          else {
            setTimeout(() => app.quit(), 1000);
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getEnvVersionsPublic() { return getEnvVersions(); }
  getClawcPlatformPublic() { return getClawcPlatform(); }
  getConfig() { return APP_CONFIG; }
  httpGetPublic(url) { return this.httpGet(url); }
}

module.exports = Updater;