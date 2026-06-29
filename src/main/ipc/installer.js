const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec, execFile, execSync } = require('child_process');
const CH = require('../../../shared/ipc-channels');
const { parseJSONFromOutput, extractOpenClawVersion, getMachineId, writeLog, logInstallStep, buildShellPathPrefix } = require('../utils');

let _updater = null;

// dev 覆盖配置路径（与 gateway.js 共享 ~/.dragonclaw/dev-env-override.json）
const DEV_OVERRIDE_PATH = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE, '.dragonclaw', 'dev-env-override.json')
  : path.join(process.env.HOME, '.dragonclaw', 'dev-env-override.json');

/**
 * 读取 dev-env-override.json（每次调用都重新读，支持热更新）
 * 返回 null 表示无覆盖或读取失败
 */
function readDevEnvOverride() {
  if (!fs.existsSync(DEV_OVERRIDE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(DEV_OVERRIDE_PATH, 'utf-8'));
  } catch (e) {
    console.log('[readDevEnvOverride] 解析失败:', e.message);
    return null;
  }
}

// 环境检查
ipcMain.handle(CH.CHECK_ENVIRONMENT, async () => {
  try {
    const results = {};

    try {
      try {
        results.nodeVersion = execSync('node --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      } catch (e) {
        results.nodeVersion = '';
        results.nodeError = e.message;
      }
      results.nodejs = true;
    } catch (error) {
      results.nodejs = false;
      results.nodeError = error.message;
    }

    try {
      const npmOutput = execSync('npm --version', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        timeout: 5000
      }).trim();
      results.npmVersion = npmOutput;
      results.npm = true;
    } catch (error) {
      results.npm = false;
      results.npmError = error.message;
    }

    try {
      const clawhubOutput = execSync('clawhub --cli-version', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        timeout: 5000
      }).trim();
      results.clawhubVersion = clawhubOutput;
      results.clawhub = true;
    } catch (error) {
      results.clawhub = false;
      results.clawhubError = error.message;
    }

    return results;
  } catch (error) {
    console.error('环境检查失败:', error);
    return { error: error.message };
  }
});

// 安装OpenClaw
ipcMain.handle(CH.INSTALL_OPENCLAW, async (event, method = 'npm') => {
  const mainWindow = BrowserWindow.getAllWindows()[0];

  try {
    console.log(`使用${method}安装OpenClaw...`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', {
        stage: 'start',
        message: `开始安装 OpenClaw...`
      });
    }

    let command;
    if (method === 'yarn') {
      command = 'yarn global add openclaw';
    } else {
      command = 'npm install -g openclaw';
    }

    const childProcess = spawn(command, {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-progress', {
          stage: 'installing',
          message: text.trim(),
          type: 'stdout'
        });
      }
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-progress', {
          stage: 'installing',
          message: text.trim(),
          type: 'stderr'
        });
      }
    });

    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        if (code === 0) {
          console.log('OpenClaw安装成功');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'init',
              message: '安装成功,正在初始化配置...'
            });
          }

          exec('openclaw init --skip-wizard', (initError, initStdout, initStderr) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (initError) {
                mainWindow.webContents.send('install-progress', {
                  stage: 'done',
                  message: `安装成功,初始化跳过: ${initError.message}`,
                  success: true
                });
              } else {
                mainWindow.webContents.send('install-progress', {
                  stage: 'done',
                  message: '安装并初始化成功!',
                  success: true
                });
              }
            }
            resolve({ success: true, output, error: errorOutput });
          });
        } else {
          console.error('OpenClaw安装失败,退出码:', code);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'error',
              message: `安装失败,退出码: ${code}`,
              success: false
            });
          }
          reject({
            success: false,
            message: `OpenClaw安装失败,退出码: ${code}`,
            output,
            error: errorOutput
          });
        }
      });

      childProcess.on('error', (error) => {
        console.error('OpenClaw安装进程错误:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-progress', {
            stage: 'error',
            message: `安装进程错误: ${error.message}`,
            success: false
          });
        }
        reject({
          success: false,
          message: `OpenClaw安装进程错误: ${error.message}`,
          output,
          error: errorOutput
        });
      });

      setTimeout(() => {
        childProcess.kill();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-progress', {
            stage: 'error',
            message: '安装超时(10分钟)',
            success: false
          });
        }
        reject({
          success: false,
          message: 'OpenClaw安装超时',
          output,
          error: errorOutput
        });
      }, 600000);
    });
  } catch (error) {
    console.error('OpenClaw安装执行失败:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', {
        stage: 'error',
        message: `安装执行失败: ${error.message}`,
        success: false
      });
    }
    return {
      success: false,
      message: `OpenClaw安装执行失败: ${error.message}`
    };
  }
});

// 安装 ClawHub
ipcMain.handle(CH.INSTALL_CLAWHUB, async () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];

  try {
    console.log('开始安装 ClawHub...');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', {
        stage: 'start',
        message: '开始安装 ClawHub...'
      });
    }

    const installCmd = process.platform === 'win32'
      ? 'chcp 65001 > nul & npm install -g clawhub@latest'
      : 'npm install -g clawhub@latest';

    const childProcess = spawn(installCmd, {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[ClawHub 安装]', text);
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.warn('[ClawHub 安装 stderr]', text);
    });

    return new Promise((resolve, reject) => {
      childProcess.on('close', async (code) => {
        if (code !== 0) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'error',
              message: `ClawHub CLI 安装失败,错误码: ${code}`,
              success: false
            });
          }
          resolve({ success: false, message: 'ClawHub CLI 安装失败', output, error: errorOutput });
          return;
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-progress', {
            stage: 'installing-sonoscli',
            message: '正在安装 sonoscli...'
          });
        }

        const npxCmd = 'npx clawhub@latest install sonoscli';
        const npxProcess = spawn(npxCmd, {
          stdio: 'pipe',
          shell: true,
        });

        let npxOutput = '';
        let npxError = '';

        npxProcess.stdout.on('data', (data) => {
          const text = data.toString();
          npxOutput += text;
          console.log('[sonoscli 安装]', text);
        });

        npxProcess.stderr.on('data', (data) => {
          const text = data.toString();
          npxError += text;
          console.warn('[sonoscli 安装 stderr]', text);
        });

        npxProcess.on('close', (npxCode) => {
          if (npxError.includes('Already installed')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('install-progress', {
                stage: 'done',
                message: 'sonoscli 已存在,跳过安装',
                success: true
              });
            }
            resolve({ success: true, message: 'sonoscli 已安装', output: npxOutput, alreadyInstalled: true });
            return;
          }

          if (npxCode !== 0) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('install-progress', {
                stage: 'error',
                message: `sonoscli 安装失败,错误码: ${npxCode}`,
                success: false
              });
            }
            resolve({ success: false, message: 'sonoscli 安装失败', output: npxOutput, error: npxError });
            return;
          }

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'done',
              message: 'ClawHub 安装完成!',
              success: true
            });
          }
          resolve({ success: true, message: 'ClawHub 安装成功' });
        });

        npxProcess.on('error', (err) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'error',
              message: `sonoscli 安装进程错误: ${err.message}`,
              success: false
            });
          }
          resolve({ success: false, message: 'sonoscli 安装进程错误' });
        });

        setTimeout(() => {
          npxProcess.kill();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('install-progress', {
              stage: 'error',
              message: '安装超时(10分钟)',
              success: false
            });
          }
          resolve({ success: false, message: '安装超时' });
        }, 600000);
      });

      childProcess.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-progress', {
            stage: 'error',
            message: `安装进程错误: ${err.message}`,
            success: false
          });
        }
        resolve({ success: false, message: '安装进程错误' });
      });

      setTimeout(() => {
        childProcess.kill();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-progress', {
            stage: 'error',
            message: '安装超时(10分钟)',
            success: false
          });
        }
        resolve({ success: false, message: '安装超时' });
      }, 600000);
    });
  } catch (error) {
    console.error('ClawHub安装执行失败:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', {
        stage: 'error',
        message: `安装执行失败: ${error.message}`,
        success: false
      });
    }
    return { success: false, message: `ClawHub安装执行失败: ${error.message}` };
  }
});

// 完成设置
ipcMain.handle(CH.FINISH_SETUP, async () => {
  console.log('安装引导完成');
  return { success: true, message: '安装引导完成' };
});

// 重启 App 自身（silent 安装完成后由前端触发）
ipcMain.handle(CH.RESTART_APP, async () => {
  try {
    console.log('[restart-app] 正在重启应用...');
    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (e) {
    console.error('[restart-app] 重启失败:', e.message);
    return { success: false, error: e.message };
  }
});

// 获取云端版本信息
ipcMain.handle(CH.FETCH_VERSION_CHECK, async () => {
  try {
    if (!_updater) {
      return { status: 500, message: 'Updater 未初始化' };
    }

    // 复用 Updater 启动时已经请求过的结果，避免重复 HTTP
    const cached = _updater.getLastRawResponse();
    if (cached) {
      return cached;
    }

    const currentVersion = _updater.getCurrentVersion();
    let env = await _updater.getEnvVersionsPublic();
    const platform = _updater.getClawcPlatformPublic();
    const config = _updater.getConfig();
    const domain = config.clawc?.domain || 'http://192.168.1.239:82';
    const machineId = getMachineId();

    // dev 覆盖：在请求云端前，根据 env 覆盖版本参数
    const dev = readDevEnvOverride();
    const devEnv = (dev && dev.env) || {};
    if (devEnv.nodejs && devEnv.nodejs.installed === false) {
      env.nodejs = '';
    } else if (devEnv.nodejs && devEnv.nodejs.version != null && devEnv.nodejs.installed !== false) {
      env.nodejs = devEnv.nodejs.version;
    }
    if (devEnv.openclaw && devEnv.openclaw.installed === false) {
      env.openclaw = '';
    } else if (devEnv.openclaw && devEnv.openclaw.version != null && devEnv.openclaw.installed !== false) {
      env.openclaw = devEnv.openclaw.version;
    }

    const apiPath = config.clawc?.api?.versionCheck || 'base/api/addons/clawc/version/check';
    const params = new URLSearchParams({
      version: currentVersion,
      platform,
      sign: 'dragonclaw',
      uuid: machineId,
      nodejs_version: env.nodejs || '',
      npm_version: env.npm || '',
      openclaw_version: env.openclaw || '',
    });
    const url = `${domain}/${apiPath}?${params.toString()}`;

    const data = await _updater.httpGetPublic(url);
    const cloudResp = JSON.parse(data);

    // dev 覆盖：dragonclaw 没有独立的 URL 参数传达安装状态，需要手动覆盖
    // nodejs / openclaw 的安装状态已通过 URL 参数传达，云端返回的数据就是正确的，不需要再覆盖
    if (devEnv.dragonclaw && cloudResp.data && cloudResp.data.dragonclaw) {
      if (devEnv.dragonclaw.installed === false) {
        cloudResp.data.dragonclaw.version = null;
        cloudResp.data.dragonclaw.update = true;
      } else if (devEnv.dragonclaw.version != null && devEnv.dragonclaw.installed !== false) {
        cloudResp.data.dragonclaw.version = devEnv.dragonclaw.version;
      }
    }

    return cloudResp;
  } catch (error) {
    return { status: 500, message: error.message };
  }
});

// 获取安装脚本
ipcMain.handle(CH.FETCH_INSTALL_SCRIPT, async (event, { url }) => {
  try {
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = url + sep + 'uuid=' + encodeURIComponent(getMachineId());
    console.log('[fetch-install-script] URL:', fullUrl);
    const data = await _updater.httpGetPublic(fullUrl);
    return JSON.parse(data);
  } catch (error) {
    console.error('[fetch-install-script] Error:', error.message);
    return { status: 500, message: error.message };
  }
});

// 执行安装步骤
ipcMain.handle(CH.EXECUTE_INSTALL_STEP, async (event, { command, name, sudoPassword, envVars, key }) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];

  return new Promise((resolve) => {
    writeLog('INFO', 'install', `[${key || '?'}] [${name}] start, envVars=${JSON.stringify(envVars || {})}`);
    console.log(`[execute-install-step] ${name}:`, command);
    if (envVars && Object.keys(envVars).length > 0) {
      console.log(`[execute-install-step] envVars:`, JSON.stringify(envVars));
    }

    if (envVars && envVars.LOCAL_FILE && command.includes('$LOCAL_FILE')) {
      const localFile = envVars.LOCAL_FILE;
      console.log(`[execute-install-step] 内联 LOCAL_FILE=${localFile}`);
      command = command.replace(/\$LOCAL_FILE/g, localFile);
      if (envVars) delete envVars.LOCAL_FILE;
    }

    let finalCommand = command;
    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';

    if (command.trim().includes('sudo')) {
      if (isMac) {
        const sudoMatch = command.match(/sudo\s+(.*?)(\s*(&&|\|\||;)\s*|$)/);
        if (sudoMatch) {
          const safeCmd = command.replace(/"/g, '" & quote & "');
          finalCommand = `osascript -e 'do shell script "${safeCmd}" with administrator privileges with prompt "DragonClaw 安装需要 Touch ID 或密码授权"'`;
        }

        console.log('[execute-install-step] macOS 使用系统原生认证对话框');
      } else if (sudoPassword) {
        const escapedPwd = sudoPassword.replace(/'/g, "'\\''");
        finalCommand = command.replace(/\bsudo\s+/g, `echo '${escapedPwd}' | sudo -S `);
        console.log('[execute-install-step] 使用 sudo -S 密码认证');
      }
    }

    // 发送开始事件
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-step-output', {
        type: 'stdout',
        message: `▶ ${name}`,
        key,
        name,
        success: null,
        progress: 0
      });
    }
    logInstallStep({ key, type: 'stdout', name, message: `▶ ${name}` });

    // ========== 关键修复：每次执行都启动独立的非交互 PowerShell 进程 ==========
    // 之前用 `exec(cmd, { shell: 'powershell' })` 会启动一个持续的 PowerShell 交互 shell，
    // 主进程的 console.log 输出会被父终端（或 node 主进程的 stdio 转发）当作命令执行，
    // 导致主进程 console.log 污染 PowerShell stdin，把整个 PowerShell 命令切碎。
    // 修复方案：
    //   - Windows：用 execFile 显式启动 powershell.exe，每次都是新进程，无持续 stdin
    //   - macOS/Linux：继续用 exec + /bin/bash（bash 同样问题，但 macOS/Linux 通常是 GUI 包启动，污染概率低）
    let child;
    if (isWindows) {
      child = execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', finalCommand
      ], {
        timeout: 0,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, ...(envVars || {}) },
        windowsHide: true
      });
    } else {
      child = exec(finalCommand, {
        timeout: 0,
        shell: '/bin/bash',
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, ...(envVars || {}) }
      });
    }

    child.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter(l => l);
      lines.forEach(line => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-step-output', {
            type: 'stdout',
            message: line,
            key,
            name,
            success: null,
            progress: 0
          });
        }
        logInstallStep({ key, type: 'stdout', name, message: line });
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter(l => l);
      lines.forEach(line => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('install-step-output', {
            type: 'stderr',
            message: line,
            key,
            name,
            success: null,
            progress: 0
          });
        }
        logInstallStep({ key, type: 'stderr', name, message: line });
      });
    });

    child.on('close', (code) => {
      const success = code === 0;
      const finalMsg = success ? `✓ ${name} 完成` : `✗ ${name} 失败 (退出码 ${code})`;
      writeLog(success ? 'INFO' : 'ERROR', 'install', `[${key || '?'}] [${name}] exit=${code} success=${success}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-step-output', {
          type: 'stdout',
          message: finalMsg,
          key,
          name,
          success: success,
          progress: success ? 100 : 0
        });
      }
      logInstallStep({ key, type: success ? 'stdout' : 'stderr', name, code, message: finalMsg });
      resolve({ success, error: code !== 0 ? `Exit code: ${code}` : null });
    });

    child.on('error', (err) => {
      const errMsg = `✗ ${name} 错误: ${err.message}`;
      writeLog('ERROR', 'install', `[${key || '?'}] [${name}] error: ${err.message}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-step-output', {
          type: 'stderr',
          message: errMsg,
          key,
          name,
          success: false,
          progress: 0
        });
      }
      logInstallStep({ key, type: 'stderr', name, message: err.message });
      resolve({ success: false, error: err.message });
    });
  });
});

// 原生密码弹窗（系统级对话框，全平台支持）
ipcMain.handle(CH.REQUEST_NATIVE_PASSWORD, async (event, { title, message }) => {
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';
  const isLinux = !isMac && !isWindows;

  if (isMac) {
    const script = 'display dialog "' + message + '" with title "' + title + '" default answer "" with hidden answer with icon caution\ntext returned of result';
    return new Promise((resolve) => {
      exec('osascript -e \'' + script.replace(/'/g, "'\\''") + '\'', { timeout: 300000 }, (err, stdout) => {
        if (err) {
          console.log('[native-password] macOS 密码弹窗取消或失败:', err.message);
          resolve('');
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  if (isWindows) {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = '${title}'
$form.Size = New-Object System.Drawing.Size(380, 180)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Text = '${message}'
$label.Location = New-Object System.Drawing.Point(20, 20)
$label.Size = New-Object System.Drawing.Size(330, 20)
$form.Controls.Add($label)
$textBox = New-Object System.Windows.Forms.TextBox
$textBox.Location = New-Object System.Drawing.Point(20, 50)
$textBox.Size = New-Object System.Drawing.Size(320, 20)
$textBox.PasswordChar = '*'
$textBox.UseSystemPasswordChar = $true
$form.Controls.Add($textBox)
$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = '确定'
$okButton.Location = New-Object System.Drawing.Point(180, 90)
$okButton.Size = New-Object System.Drawing.Size(75, 30)
$okButton.DialogResult = 'OK'
$form.Controls.Add($okButton)
$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = '取消'
$cancelButton.Location = New-Object System.Drawing.Point(265, 90)
$cancelButton.Size = New-Object System.Drawing.Size(75, 30)
$cancelButton.DialogResult = 'Cancel'
$form.Controls.Add($cancelButton)
$form.AcceptButton = $okButton
$form.CancelButton = $cancelButton
if ($form.ShowDialog() -eq 'OK') { Write-Output $textBox.Text } else { Write-Output '' }
`;

    return new Promise((resolve) => {
      const ps = spawn('powershell', ['-NoProfile', '-Command', psScript], {
        timeout: 300000,
        windowsHide: true
      });
      let stdout = '';
      ps.stdout.on('data', (data) => { stdout += data.toString(); });
      ps.on('close', () => { resolve(stdout.trim()); });
      ps.on('error', () => { resolve(''); });
    });
  }

  if (isLinux) {
    const commands = [
      'zenity --password --title="' + title + '" --text="' + message + '" 2>/dev/null',
      'kdialog --password "' + message + '" --title "' + title + '" 2>/dev/null',
    ];

    for (const cmd of commands) {
      try {
        const result = await new Promise((resolve) => {
          exec(cmd, { timeout: 300000 }, (err, stdout) => {
            resolve(err ? '' : stdout.trim());
          });
        });
        if (result) return result;
      } catch (e) {
      }
    }
  }

  return '';
});

// 下载文件到临时目录，带回进度通知
const doDownload = async (url, tempName, mainWindow) => {
  const https = require('https');
  const http = require('http');
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, tempName || 'clawc-download-' + Date.now());

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 600000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        console.log('[download-file] 重定向到:', redirectUrl);
        res.destroy();
        resolve(doDownload(redirectUrl, tempName, mainWindow));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }
      res.setTimeout(0);
      const totalSize = parseInt(res.headers['content-length'], 10) || 0;
      let downloadedSize = 0;
      const writeStream = fs.createWriteStream(filePath);
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        writeStream.write(chunk);
        if (totalSize > 0 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', {
            progress: (downloadedSize / totalSize) * 100,
            downloaded: downloadedSize,
            total: totalSize
          });
        }
      });
      res.on('end', () => {
        writeStream.end();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', {
            progress: 100, downloaded: downloadedSize, total: totalSize, filePath
          });
        }
        console.log('[download-file] 下载完成:', filePath, `${downloadedSize} bytes`);
        resolve({ filePath, size: downloadedSize });
      });
      res.on('error', (err) => {
        writeStream.close();
        fs.unlink(filePath, () => {});
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-error', { message: err.message });
        }
        reject(err);
      });
    });
    req.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-error', { message: err.message });
      }
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('下载超时'));
    });
  });
};

ipcMain.handle(CH.DOWNLOAD_FILE, async (event, { url, tempName }) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  console.log('[download-file] 开始下载:', url);
  return doDownload(url, tempName, mainWindow);
});

// 测试模型连接
ipcMain.handle(CH.TEST_MODEL_CONNECTION, async (event, model) => {
  return new Promise((resolve) => {
    try {
      console.log(`测试模型连接: ${model.id}`);

      let testCommand;
      if (model.provider === 'ollama') {
        testCommand = `curl -s ${model.base_url || 'http://localhost:11434'}/api/tags -H "Content-Type: application/json" -d '{}'`;
      } else if (model.provider === 'openai' || model.provider === 'deepseek') {
        testCommand = `curl -s ${model.base_url}/v1/models -H "Authorization: Bearer ${model.api_key}"`;
      } else {
        testCommand = `curl -s ${model.base_url}/v1/models`;
      }

      const child = spawn('sh', ['-c', testCommand], {
        timeout: 10000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        console.log(`模型连接测试完成,退出码: ${code}`);
        console.log(`stdout: ${stdout.substring(0, 500)}`);
        console.log(`stderr: ${stderr.substring(0, 500)}`);

        if (code === 0 && !stderr.includes('error')) {
          if (stdout.includes('model') || stdout.includes('"id"') || stdout === '{}') {
            resolve({ success: true, message: '连接成功', output: stdout });
          } else {
            resolve({ success: false, message: '响应格式异常', output: stdout });
          }
        } else {
          resolve({
            success: false,
            message: stderr || `连接失败,退出码: ${code}`,
            output: stderr || stdout
          });
        }
      });

      child.on('error', (err) => {
        console.error(`模型连接测试进程错误:`, err.message);
        resolve({ success: false, message: err.message });
      });

    } catch (error) {
      console.error(`测试模型连接失败:`, error.message);
      resolve({ success: false, message: error.message });
    }
  });
});

// 重新检测环境版本（安装后）
ipcMain.handle(CH.RECHECK_ENV_VERSIONS, () => {
  return new Promise((resolve) => {
    const dev = readDevEnvOverride();
    const devEnv = (dev && dev.env) || {};
    const versions = { nodejs: '', npm: '', openclaw: '' };
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? true : '/bin/bash';

    const pathPrefix = isWindows ? '' : buildShellPathPrefix();
    const nodeCmd = isWindows
      ? 'node --version 2>nul'
      : `${pathPrefix}node --version 2>/dev/null`;
    const npmCmd = isWindows
      ? 'npm --version 2>nul'
      : `${pathPrefix}npm --version 2>/dev/null`;

    exec(nodeCmd, { timeout: 5000, shell }, (e, out) => {
      if (!e && out) versions.nodejs = out.trim().replace(/^v/, '');
      exec(npmCmd, { timeout: 5000, shell }, (e2, out2) => {
        if (!e2 && out2) versions.npm = out2.trim();
        const openclawCmd = isWindows
          ? 'openclaw --version'
          : 'openclaw --version 2>/dev/null || echo ""';
        exec(openclawCmd, { timeout: 5000, shell }, (e3, out3) => {
          if (!e3 && out3) {
            const m = out3.trim().match(/(\d+\.\d+\.\d+)/);
            if (m) versions.openclaw = m[1];
          }

          // dev 覆盖：根据 env 中 installed/version 覆盖检测结果
          for (const key of ['nodejs', 'npm', 'openclaw']) {
            if (devEnv[key]) {
              if (devEnv[key].installed === false) {
                versions[key] = '';
              } else if (devEnv[key].version != null && devEnv[key].installed !== false) {
                versions[key] = String(devEnv[key].version);
              }
            }
          }

          resolve(versions);
        });
      });
    });
  });
});

// 发送对话消息(通过 Gateway Chat Completions API)
ipcMain.handle(CH.SEND_CHAT_MESSAGE, async (event, { agentId = 'main', messages, stream = true }) => {
  try {
    const configPath = path.join(process.env.HOME, '.openclaw', 'openclaw.json');
    let token = '';
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      token = config.gateway?.auth?.token || '';
    } catch (e) {
      console.warn('读取配置文件失败:', e.message);
    }

    const port = 18789;
    const apiUrl = `http://127.0.0.1:${port}/v1/chat/completions`;

    const payload = {
      model: `openclaw:${agentId}`,
      messages: messages,
      stream: stream
    };

    console.log('发送对话请求:', apiUrl, 'agent:', agentId);

    if (stream) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-openclaw-agent-id': agentId
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API错误: ${response.status} ${errorText}`);
      }

      return {
        success: true,
        stream: true,
        reader: response.body.getReader(),
        contentType: response.headers.get('content-type')
      };
    } else {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-openclaw-agent-id': agentId
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API错误: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return { success: true, data: data };
    }
  } catch (error) {
    console.error('发送对话消息失败:', error.message);
    return { success: false, error: error.message };
  }
});

function setUpdater(updater) { _updater = updater; }

module.exports = { setUpdater };
