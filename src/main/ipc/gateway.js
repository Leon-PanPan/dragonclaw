const { ipcMain, app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const CH = require('../../../shared/ipc-channels');
const { getMachineId } = require('../utils');
const { parseJSONFromOutput, getGatewayPort } = require('../utils');
const { extractOpenClawVersion, buildShellPathPrefix } = require('../utils');

const OPENCLAW_CONFIG_PATH = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json')
  : path.join(process.env.HOME, '.openclaw', 'openclaw.json');

const DRAGONCLAW_DIR = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE, '.dragonclaw')
  : path.join(process.env.HOME, '.dragonclaw');
const REMOTE_CONFIG_PATH = path.join(DRAGONCLAW_DIR, 'remote-config.json');

let versionCache = {
  nodeVersion: '',
  npmVersion: '',
  openclawVersion: '',
  clawhubVersion: '',
  timestamp: 0
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1小时

// 快速环境检测(不调用 gateway status,只用 -v 命令)
async function quickEnvironmentCheck() {
  const isWindows = process.platform === 'win32';
  const overrideConfigPath = path.join(DRAGONCLAW_DIR, 'dev-env-override.json');

  let dev = null;
  if (fs.existsSync(overrideConfigPath)) {
    try {
      dev = JSON.parse(fs.readFileSync(overrideConfigPath, 'utf-8'));
    } catch (e) {
      console.log('[quickEnvironmentCheck] 读取覆盖配置失败:', e.message);
    }
  }

  const devEnv = (dev && dev.env) || {};
  const result = {
    nodejs: { installed: false, version: '' },
    npm: { installed: false, version: '' },
    openclaw: { installed: false, version: '' },
    run: false,
    stop: (dev && dev.stop) || null
  };

  const extendPath = isWindows ? '' : buildShellPathPrefix();
  const shell = isWindows ? true : '/bin/bash';
  const stderrRedirect = isWindows ? '2>nul' : '2>/dev/null';

  // npm
  if (devEnv.npm && devEnv.npm.installed === false) {
    result.npm = { installed: false, version: '' };
  } else if (devEnv.npm && typeof devEnv.npm.installed === 'boolean') {
    result.npm = { installed: true, version: devEnv.npm.version || '' };
  } else if (devEnv.npm && devEnv.npm.version != null) {
    result.npm = { installed: true, version: devEnv.npm.version };
  } else {
    try {
      const output = execSync(`${extendPath}npm -v ${stderrRedirect}`, { encoding: 'utf-8', timeout: 3000, shell }).trim();
      result.npm = { installed: true, version: output };
    } catch (e) {}
  }

  // nodejs
  if (devEnv.nodejs && devEnv.nodejs.installed === false) {
    result.nodejs = { installed: false, version: '' };
  } else if (devEnv.nodejs && typeof devEnv.nodejs.installed === 'boolean') {
    result.nodejs = { installed: true, version: devEnv.nodejs.version || '' };
  } else if (devEnv.nodejs && devEnv.nodejs.version != null) {
    result.nodejs = { installed: true, version: devEnv.nodejs.version };
  } else {
    try {
      const output = execSync(`${extendPath}node -v ${stderrRedirect}`, { encoding: 'utf-8', timeout: 3000, shell }).trim();
      result.nodejs = { installed: true, version: output };
    } catch (e) {}
  }

  // openclaw
  if (devEnv.openclaw && devEnv.openclaw.installed === false) {
    result.openclaw = { installed: false, version: '' };
  } else if (devEnv.openclaw && typeof devEnv.openclaw.installed === 'boolean') {
    result.openclaw = { installed: true, version: devEnv.openclaw.version || '' };
  } else if (devEnv.openclaw && devEnv.openclaw.version != null) {
    result.openclaw = { installed: true, version: devEnv.openclaw.version };
  } else {
    try {
      const raw = execSync(`openclaw -v ${stderrRedirect}`, { encoding: 'utf-8', timeout: 3000, shell }).trim();
      result.openclaw = { installed: true, version: extractOpenClawVersion(raw) };
    } catch (e) {}
  }

  // openclaw.running (Gateway 运行状态)
  if (devEnv.openclaw && typeof devEnv.openclaw.running === 'boolean') {
    result.run = devEnv.openclaw.running;
  } else {
    const port = 18789;
    result.run = await new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, '127.0.0.1');
    });
  }

  return result;
}

// 检查 OpenClaw Gateway 是否运行(通过端口检测)
async function checkGatewayRunning(portFromRenderer) {
  const port = portFromRenderer || getGatewayPort();
  return new Promise((resolve) => {
    try {
      const net = require('net');
      const socket = new net.Socket();
      let resolved = false;

      const doResolve = (running) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({ running, port });
      };

      socket.setTimeout(2000);

      socket.on('connect', () => {
        doResolve(true);
      });

      socket.on('timeout', () => {
        doResolve(false);
      });

      socket.on('error', (err) => {
        doResolve(false);
      });

      socket.connect(port, '127.0.0.1');
    } catch (error) {
      resolve({ running: false, port, error: error.message });
    }
  });
}

// 检查 OpenClaw 是否安装和运行(使用 --json 获取状态)
async function checkOpenClawInstalled() {
  try {
    const versionOutput = execSync('openclaw --version', { encoding: 'utf-8' }).trim();
    const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[0] : versionOutput;

    let serviceStatus = { loaded: false, runtime: { status: 'unknown' } };
    try {
      const statusOutput = execSync('openclaw gateway status --json', { encoding: 'utf-8', timeout: 10000 });
      const parsed = parseJSONFromOutput(statusOutput);
      if (parsed && parsed.service) {
        serviceStatus = parsed.service;
      }
    } catch (statusError) {
      console.log('获取服务状态失败:', statusError.message);
    }

    let config = null;
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      try {
        config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
      } catch (configError) {
        console.error('读取配置文件失败:', configError);
      }
    }

    const isRunning = serviceStatus.runtime?.status === 'running';
    const isStopped = serviceStatus.runtime?.status === 'stopped';

    return {
      installed: true,
      version: version,
      commandAvailable: true,
      config,
      running: isRunning,
      stopped: isStopped,
      serviceStatus,
      port: config?.gateway?.port || 18789
    };
  } catch (error) {
    console.log('openclaw 命令不可用,检查配置文件:', error.message);
    try {
      if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
        return {
          installed: true,
          version: '已配置但命令不可用',
          commandAvailable: false,
          config,
          running: false,
          stopped: true,
          serviceStatus: null,
          port: config?.gateway?.port || 18789
        };
      }
    } catch (configError) {
      console.error('读取配置文件失败:', configError);
    }
    return {
      installed: false,
      version: '',
      commandAvailable: false,
      config: null,
      running: false,
      stopped: true,
      serviceStatus: null,
      port: null
    };
  }
}

// ==================== Gateway / Config / System IPC handlers ====================

ipcMain.handle(CH.GET_OPENCLAW_STATUS, async () => {
  return await checkOpenClawInstalled();
});

ipcMain.handle(CH.GET_OPENCLAW_HOME, async () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.openclaw');
});

ipcMain.handle(CH.QUICK_ENV_CHECK, async () => {
  return await quickEnvironmentCheck();
});

ipcMain.handle(CH.CHECK_GATEWAY_RUNNING, async (event, port) => {
  return await checkGatewayRunning(port);
});

ipcMain.handle(CH.GET_GATEWAY_STATUS, async () => {
  return new Promise((resolve) => {
    try {
      let installed = false;
      try {
        execSync('openclaw --version', { encoding: 'utf-8', timeout: 3000 });
        installed = true;
      } catch (e) {
        resolve({ installed: false, error: 'OpenClaw CLI 未安装' });
        return;
      }

      try {
        const output = execSync('openclaw gateway status --json', { encoding: 'utf-8', timeout: 5000 });
        const result = parseJSONFromOutput(output);
        resolve({
          installed: true,
          running: result?.service?.runtime?.status === 'running',
          stopped: result?.service?.runtime?.status === 'stopped',
          service: result?.service || null,
          raw: result
        });
      } catch (statusError) {
        resolve({
          installed: true,
          running: false,
          stopped: true,
          error: statusError.message,
          service: null
        });
      }
    } catch (error) {
      resolve({ installed: false, error: error.message });
    }
  });
});

ipcMain.handle(CH.START_OPENCLAW, () => {
  return new Promise((resolve, reject) => {
    const openclawProcess = spawn('openclaw', ['gateway', 'start', '--json'], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    let settled = false;

    const settle = () => {
      if (settled) return;
      settled = true;
      const result = parseJSONFromOutput(output);
      console.log('[gateway] start settle, output:', output.substring(0, 200));
      resolve({ success: true, output, result });
    };

    openclawProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    openclawProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    openclawProcess.on('close', (code) => {
      console.log('[gateway] start 进程关闭, code:', code);
      settle();
    });

    openclawProcess.on('error', (error) => {
      console.log('[gateway] start 错误:', error.message);
      if (!settled) settle();
    });

    setTimeout(() => {
      if (!settled) {
        console.log('[gateway] start 超时');
        settled = true;
        try { openclawProcess.kill(); } catch (e) {}
        resolve({ success: true, output, result: null, timedOut: true });
      }
    }, 30000);
  });
});

ipcMain.handle(CH.STOP_OPENCLAW, () => {
  console.log('[gateway] stop-openclaw IPC 被调用');
  return new Promise((resolve, reject) => {
    console.log('[gateway] 执行 spawn openclaw gateway stop --json');
    const openclawProcess = spawn('openclaw', ['gateway', 'stop', '--json'], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    let settled = false;

    const settle = () => {
      if (settled) return;
      settled = true;
      const result = parseJSONFromOutput(output);
      console.log('[gateway] stop settle, output:', output.substring(0, 200));
      resolve({ success: true, output, result });
    };

    openclawProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('[gateway] stdout:', data.toString().substring(0, 100));
    });

    openclawProcess.stderr.on('data', (data) => {
      console.log('[gateway] stderr:', data.toString().substring(0, 100));
    });

    openclawProcess.on('close', (code) => {
      console.log('[gateway] openclaw stop 进程关闭, code:', code);
      settle();
    });

    openclawProcess.on('error', (error) => {
      console.log('[gateway] openclaw stop 错误:', error.message);
      reject({ success: false, error: error.message });
    });
  });
});

ipcMain.handle(CH.RESTART_OPENCLAW, () => {
  return new Promise((resolve, reject) => {
    const openclawProcess = spawn('openclaw', ['gateway', 'restart', '--json'], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    openclawProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    openclawProcess.on('close', (code) => {
      const result = parseJSONFromOutput(output);
      if (result) {
        console.log('重启结果:', JSON.stringify(result));
      }
      if (code === 0 || result?.ok) {
        resolve({ success: true, output, result });
      } else {
        reject({ success: false, output, result });
      }
    });

    openclawProcess.on('error', (error) => {
      reject({ success: false, error: error.message });
    });
  });
});

ipcMain.handle(CH.READ_CONFIG, async () => {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const defaultConfig = {
        "meta": {
          "lastTouchedVersion": "2026.3.15",
          "lastTouchedAt": new Date().toISOString()
        },
        "env": {},
        "models": {
          "mode": "merge",
          "providers": {}
        },
        "agents": {
          "defaults": {
            "model": {
              "primary": "deepseek/deepseek-reasoner",
              "fallbacks": ["deepseek/deepseek-chat"]
            },
            "workspace": process.platform === 'win32'
              ? path.join(process.env.USERPROFILE, '.openclaw', 'workspace')
              : path.join(process.env.HOME, '.openclaw', 'workspace'),
            "compaction": {
              "mode": "default",
              "reserveTokensFloor": 20000
            }
          },
          "list": [
            {
              "id": "main",
              "model": "deepseek/deepseek-reasoner"
            }
          ]
        },
        "gateway": {
          "port": 18789,
          "mode": "local",
          "bind": "loopback",
          "auth": {
            "mode": "token",
            "token": require('crypto').randomBytes(24).toString('hex')
          },
          "http": {
            "endpoints": {
              "chatCompletions": {
                "enabled": true
              }
            }
          }
        },
        "skills": {
          "entries": {
            "clawhub": {
              "enabled": true
            }
          }
        }
      };

      const configDir = path.dirname(OPENCLAW_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        await fs.promises.mkdir(configDir, { recursive: true });
      }
      await fs.promises.writeFile(OPENCLAW_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log('已创建默认配置文件:', OPENCLAW_CONFIG_PATH);
      return defaultConfig;
    }

    const configContent = await fs.promises.readFile(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);
    return config;
  } catch (error) {
    console.error('读取配置文件失败:', error);
    throw new Error('读取配置文件失败: ' + error.message);
  }
});

ipcMain.handle(CH.WRITE_CONFIG, async (event, config) => {
  try {
    if (typeof config !== 'object' || config === null) {
      throw new Error('配置必须是有效的JSON对象');
    }

    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const backupPath = OPENCLAW_CONFIG_PATH + '.backup.' + Date.now();
      await fs.promises.copyFile(OPENCLAW_CONFIG_PATH, backupPath);
      console.log('配置备份已创建:', backupPath);
    }

    const configDir = path.dirname(OPENCLAW_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      await fs.promises.mkdir(configDir, { recursive: true });
    }

    await fs.promises.writeFile(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log('配置已成功写入:', OPENCLAW_CONFIG_PATH);
    return true;
  } catch (error) {
    console.error('写入配置文件失败:', error);
    throw new Error('写入配置文件失败: ' + error.message);
  }
});

ipcMain.handle(CH.GET_AGENTS_CONFIG, async () => {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      return { list: [], models: { providers: {} } };
    }
    const configContent = await fs.promises.readFile(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);
    return {
      list: config.agents?.list || [],
      defaults: config.agents?.defaults || {},
      models: config.models || { providers: {} }
    };
  } catch (error) {
    console.error('读取agents配置失败:', error);
    return { list: [], defaults: {}, models: { providers: {} } };
  }
});

ipcMain.handle(CH.CHECK_OPENCLAW_CONFIG, async () => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const workspacePath = path.join(os.homedir(), '.openclaw', 'workspace');
    const skillsPath = path.join(workspacePath, 'skills');

    const checks = {
      openclaw: { success: false, message: '等待检查...' },
      config: { success: false, message: '等待检查...' },
      skills: { success: false, message: '等待检查...' },
      permissions: { success: false, message: '等待检查...' },
    };

    const issues = [];

    try {
      const versionOutput = execSync('openclaw --version', { encoding: 'utf-8' }).trim();
      checks.openclaw.success = true;
      checks.openclaw.message = `版本: ${extractOpenClawVersion(versionOutput)}`;
    } catch (error) {
      checks.openclaw.success = false;
      checks.openclaw.message = '未安装或命令不可用';
      issues.push('OpenClaw核心未安装');
    }

    const configExists = fs.existsSync(configPath);
    if (configExists) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        checks.config.success = true;
        checks.config.message = '配置文件正常';
        checks.config.config = config;
      } catch (error) {
        checks.config.success = false;
        checks.config.message = `配置文件解析错误: ${error.message}`;
        issues.push('配置文件格式错误');
      }
    } else {
      checks.config.success = false;
      checks.config.message = '配置文件不存在';
      issues.push('配置文件不存在');
    }

    const skillsExists = fs.existsSync(skillsPath);
    if (skillsExists) {
      try {
        const skillItems = fs.readdirSync(skillsPath);
        const skillCount = skillItems.length;
        checks.skills.success = true;
        checks.skills.message = `技能目录正常 (${skillCount} 个项目)`;
        checks.skills.count = skillCount;
      } catch (error) {
        checks.skills.success = false;
        checks.skills.message = `技能目录访问错误: ${error.message}`;
        issues.push('技能目录访问错误');
      }
    } else {
      checks.skills.success = false;
      checks.skills.message = '技能目录不存在';
      issues.push('技能目录不存在');
    }

    try {
      const testFile = path.join(os.tmpdir(), `openclaw-test-${Date.now()}.txt`);
      fs.writeFileSync(testFile, 'permission test');
      fs.unlinkSync(testFile);
      checks.permissions.success = true;
      checks.permissions.message = '文件系统权限正常';
    } catch (error) {
      checks.permissions.success = false;
      checks.permissions.message = `文件系统权限错误: ${error.message}`;
      issues.push('文件系统权限不足');
    }

    const passed = Object.values(checks).every(check => check.success);

    return {
      passed,
      issues,
      checks,
      paths: {
        config: configPath,
        workspace: workspacePath,
        skills: skillsPath,
      },
      exists: configExists,
    };
  } catch (error) {
    console.error('检查OpenClaw配置失败:', error);
    return {
      passed: false,
      issues: [`检查过程中出错: ${error.message}`],
      checks: {},
      error: error.message
    };
  }
});

ipcMain.handle(CH.SAVE_REMOTE_CONFIG, async (event, config) => {
  try {
    if (!fs.existsSync(DRAGONCLAW_DIR)) {
      await fs.promises.mkdir(DRAGONCLAW_DIR, { recursive: true });
    }
    await fs.promises.writeFile(REMOTE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[main] 远程配置已保存:', REMOTE_CONFIG_PATH);
    return true;
  } catch (error) {
    console.error('[main] 保存远程配置失败:', error);
    return false;
  }
});

ipcMain.handle(CH.LOAD_REMOTE_CONFIG, async () => {
  try {
    if (!fs.existsSync(REMOTE_CONFIG_PATH)) {
      return null;
    }
    const raw = await fs.promises.readFile(REMOTE_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    console.log('[main] 远程配置已读取:', config.ip, config.port);
    return config;
  } catch (error) {
    console.error('[main] 读取远程配置失败:', error);
    return null;
  }
});

ipcMain.handle(CH.CLEAR_REMOTE_CONFIG, async () => {
  try {
    if (fs.existsSync(REMOTE_CONFIG_PATH)) {
      await fs.promises.unlink(REMOTE_CONFIG_PATH);
    }
    return true;
  } catch (error) {
    console.error('[main] 清除远程配置失败:', error);
    return false;
  }
});

ipcMain.handle(CH.SHOW_CONFIRMATION_DIALOG, (event, { title, message }) => {
  const { dialog } = require('electron');
  const win = BrowserWindow.getAllWindows()[0];
  return dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['确定', '取消'],
    defaultId: 0,
    cancelId: 1,
    title,
    message,
  }) === 0;
});

ipcMain.handle(CH.GET_MACHINE_ID, () => getMachineId());

ipcMain.handle(CH.GET_SYSTEM_INFO, async () => {
  const now = Date.now();

  if (versionCache.timestamp && (now - versionCache.timestamp < CACHE_TTL_MS)) {
    console.log('[系统信息] 使用缓存,有效期剩余', Math.round((CACHE_TTL_MS - (now - versionCache.timestamp)) / 1000 / 60), '分钟');
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: versionCache.nodeVersion || '',
      npmVersion: versionCache.npmVersion || '',
      openclawVersion: versionCache.openclawVersion || '',
      clawhubVersion: versionCache.clawhubVersion || '',
      chromeVersion: process.versions.chrome,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      cached: true
    };
  }

  console.log('[系统信息] 缓存已过期,重新读取...');

  try {
    versionCache.nodeVersion = execSync('node -v', { encoding: 'utf-8', timeout: 3000 }).trim();
  } catch (e) {
    versionCache.nodeVersion = '';
  }

  try {
    versionCache.npmVersion = execSync('npm -v', { encoding: 'utf-8', timeout: 3000 }).trim();
  } catch (e) {
    versionCache.npmVersion = '';
  }

  try {
    const raw = execSync('openclaw -v', { encoding: 'utf-8', timeout: 3000 }).trim();
    versionCache.openclawVersion = extractOpenClawVersion(raw);
  } catch (e) {
    versionCache.openclawVersion = '';
  }

  try {
    versionCache.clawhubVersion = execSync('npx clawhub@latest --cli-version', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (e) {
    versionCache.clawhubVersion = '';
  }

  versionCache.timestamp = now;

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: versionCache.nodeVersion || '',
    npmVersion: versionCache.npmVersion || '',
    openclawVersion: versionCache.openclawVersion || '',
    clawhubVersion: versionCache.clawhubVersion || '',
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    cached: false
  };
});

ipcMain.handle(CH.GET_APP_VERSION, () => {
  return app.getVersion();
});

ipcMain.handle(CH.OPEN_EXTERNAL, async (event, url) => {
  try {
    if (typeof url !== 'string' || !url) {
      return { success: false, error: 'invalid url' };
    }
    if (!/^https?:\/\//i.test(url)) {
      return { success: false, error: 'only http(s) urls are allowed' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(CH.TEST_FEISHU_CONNECTION, async (event, feishuConfig) => {
  try {
    if (!feishuConfig.appId || !feishuConfig.appSecret) {
      return { success: false, error: 'App ID 或 App Secret 为空' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
