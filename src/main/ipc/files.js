const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const CH = require('../../../shared/ipc-channels');

// 文件操作API - 保存文件到应用数据目录
ipcMain.handle(CH.SAVE_FILE, async (event, { filename, content }) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename || 'skills-cache.json');

    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`文件保存成功: ${filePath}, 大小: ${content.length} 字节`);

    return { success: true, filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 简化版JSON文件读取(让渲染进程处理流式解析)
ipcMain.handle(CH.READ_FILE, async (event, { filename, filePath: customPath, maxBytes }) => {
  try {
    let filePath;

    if (customPath) {
      filePath = customPath;
    } else {
      const userDataPath = app.getPath('userData');
      filePath = path.join(userDataPath, filename || 'skills-cache.json');
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在', exists: false };
    }

    const stats = fs.statSync(filePath);
    console.log(`读取文件: ${filePath}, 大小: ${stats.size} 字节`);

    const maxSize = maxBytes || (stats.size > 5 * 1024 * 1024 ? 5 * 1024 * 1024 : stats.size);
    if (stats.size > 5 * 1024 * 1024) {
      console.warn(`警告: 检测到大文件,限制读取大小至 ${maxSize} 字节`);
    }

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(maxSize);
    const bytesRead = fs.readSync(fd, buffer, 0, maxSize, 0);
    fs.closeSync(fd);

    let contentBuffer = buffer.slice(0, bytesRead);

    if (contentBuffer.length >= 3 && contentBuffer[0] === 0xEF && contentBuffer[1] === 0xBB && contentBuffer[2] === 0xBF) {
      console.log('检测到UTF-8 BOM,已移除');
      contentBuffer = contentBuffer.slice(3);
    }

    const content = contentBuffer.toString('utf8');

    return {
      success: true,
      content: content,
      filePath,
      size: stats.size,
      truncated: maxSize < stats.size
    };
  } catch (error) {
    console.error('读取文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 检查文件是否存在
ipcMain.handle(CH.FILE_EXISTS, async (event, { filename }) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename || 'skills-cache.json');
    const exists = fs.existsSync(filePath);

    return { success: true, exists, filePath };
  } catch (error) {
    console.error('检查文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取文件最后修改时间
ipcMain.handle(CH.FILE_MTIME, async (event, { filename }) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename || 'skills-cache.json');

    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在', exists: false };
    }

    const stats = fs.statSync(filePath);
    return {
      success: true,
      mtime: stats.mtime.getTime(),
      mtimeISO: stats.mtime.toISOString(),
      size: stats.size
    };
  } catch (error) {
    console.error('获取文件信息失败:', error);
    return { success: false, error: error.message };
  }
});

// 读取 openclaw workspace 下的文件
ipcMain.handle(CH.WORKSPACE_READ, async (event, { workspace, filename }) => {
  try {
    const homedir = app.getPath('home');
    const dirName = (workspace === 'main') ? 'workspace' : `workspace-${workspace}`;
    const filePath = path.join(homedir, '.openclaw', dirName, filename);

    console.log(`[openclaw-read-workspace-file] 读取: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在', exists: false };
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    return {
      success: true,
      content,
      filePath,
      size: stats.size
    };
  } catch (error) {
    console.error('读取 openclaw workspace 文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 写入 openclaw workspace 文件
ipcMain.handle(CH.WORKSPACE_WRITE, async (event, { workspace, filename, content }) => {
  try {
    const homedir = app.getPath('home');
    const dirName = (workspace === 'main') ? 'workspace' : `workspace-${workspace}`;
    const dirPath = path.join(homedir, '.openclaw', dirName);
    const filePath = path.join(dirPath, filename);

    console.log(`[openclaw-write-workspace-file] 写入: ${filePath}`);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, filePath };
  } catch (error) {
    console.error('写入 openclaw workspace 文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 执行命令
ipcMain.handle(CH.EXECUTE_COMMAND, async (event, command) => {
  return new Promise((resolve) => {
    console.log('执行命令:', command);
    const { exec } = require('child_process');
    exec(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('命令执行失败:', error.message);
        resolve({
          success: false,
          error: error.message,
          stderr: stderr,
          stdout: stdout,
          code: error.code || 1
        });
      } else {
        resolve({
          success: true,
          output: stdout.trim(),
          stderr: stderr,
          code: 0
        });
      }
    });
  });
});

// WebSocket 通信日志写入
ipcMain.handle(CH.WRITE_WS_LOG, async (event, { direction, data }) => {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const logDir = path.join(homeDir, '.dragonclaw');
    const logFile = path.join(logDir, 'dragonclaw.log');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = {
      time: new Date().toISOString(),
      direction,
      data
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf-8');
    return { success: true };
  } catch (e) {
    console.error('[writeWsLog] 写入失败:', e.message);
    return { success: false, error: e.message };
  }
});
