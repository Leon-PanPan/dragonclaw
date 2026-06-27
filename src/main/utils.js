/**
 * Main process utility functions — used by IPC handlers
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DRAGONCLAW_DIR = path.join(os.homedir(), '.dragonclaw');
const MACHINE_ID_PATH = path.join(DRAGONCLAW_DIR, 'machine-id');
const DRAGONCLAW_LOG_PATH = path.join(DRAGONCLAW_DIR, 'dragonclaw.log');
const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');

/**
 * 将一行文本同时输出到 stderr（dev 终端可见）和 ~/.dragonclaw/dragonclaw.log（持久化）
 * 写入采用 append + 同步 fs.appendFileSync，避免异步排队导致日志顺序错乱
 * 写入失败时静默降级到 stderr，不影响主流程
 *
 * @param {string} level  'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
 * @param {string} tag    模块/类别标签
 * @param {string} msg    消息内容
 */
function writeLog(level, tag, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] [${tag}] ${msg}\n`;
  try { process.stderr.write(line); } catch {}
  try {
    if (!fs.existsSync(DRAGONCLAW_DIR)) fs.mkdirSync(DRAGONCLAW_DIR, { recursive: true });
    fs.appendFileSync(DRAGONCLAW_LOG_PATH, line, 'utf-8');
  } catch {}
}

/**
 * 安装步骤日志：把命令/stdout/stderr/退出码追加到 dragonclaw.log
 * 所有 install-step-output 事件都会同时写一份日志
 */
function logInstallStep(payload) {
  if (!payload) return;
  const { key, type, name, message, code, command, envVars } = payload;
  const parts = [];
  if (key) parts.push(`[${key}]`);
  if (name) parts.push(`[${name}]`);
  if (type) parts.push(`<${type}>`);
  if (code !== undefined) parts.push(`<code=${code}>`);
  if (command) parts.push(`cmd=${command.substring(0, 200)}${command.length > 200 ? '...' : ''}`);
  if (envVars) parts.push(`env=${JSON.stringify(envVars)}`);
  if (message) parts.push(message);
  writeLog((type === 'stderr') ? 'ERROR' : 'INFO', 'install', parts.join(' '));
}

function getMachineId() {
  try {
    if (fs.existsSync(MACHINE_ID_PATH)) {
      const cached = fs.readFileSync(MACHINE_ID_PATH, 'utf-8').trim();
      if (cached.length === 32) return cached;
    }
  } catch {}
  const parts = [os.hostname(), process.platform, os.arch(), os.cpus().length.toString(), Math.round(os.totalmem() / (1024*1024*1024)).toString() + 'G'];
  const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  try { if (!fs.existsSync(DRAGONCLAW_DIR)) fs.mkdirSync(DRAGONCLAW_DIR, { recursive: true }); fs.writeFileSync(MACHINE_ID_PATH, hash); } catch {}
  return hash;
}

function extractOpenClawVersion(raw) {
  if (!raw) return '';
  const m = raw.trim().match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : raw.trim();
}

function parseJSONFromOutput(output) {
  try {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(output.substring(start, end + 1));
  } catch { return null; }
}

function getGatewayPort() {
  try {
    if (fs.existsSync(OPENCLAW_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
      return config?.gateway?.port || 18789;
    }
  } catch {}
  return 18789;
}

/**
 * 把常用可执行文件目录追加到 process.env.PATH。
 *
 * 在 macOS / Linux 上，从 Finder / Launch Services 启动的 Electron 应用
 * 不会继承用户 shell 的 PATH（只会有 /usr/bin:/bin 等精简路径），
 * 导致 `node` / `npm` / `openclaw` 这类通过 Homebrew 或 nvm 安装的
 * 命令无法解析。此函数用于在主进程启动早期补充这些常见目录。
 *
 * - 仅追加存在的目录（避免无效 PATH 项污染）
 * - 去重后保持顺序
 * - 同一个进程内多次调用幂等
 */
function augmentPath() {
  const isWin = process.platform === 'win32';
  const home = os.homedir();
  const candidates = isWin
    ? [
        path.join(home, 'AppData', 'Roaming', 'npm'),
        path.join(process.env.APPDATA || '', 'npm'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
      ]
    : [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        path.join(home, '.local', 'bin'),
        path.join(home, 'bin'),
        path.join(home, '.nvm', 'versions', 'node', 'current', 'bin'),
        path.join(home, '.npm-global', 'bin'),
        path.join(home, '.volta', 'bin'),
        path.join(home, '.asdf', 'shims'),
        '/opt/local/bin',
        '/opt/local/sbin',
      ];

  const seen = new Set();
  const merged = [];
  const current = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of [...candidates, ...current]) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    merged.push(dir);
  }
  process.env.PATH = merged.join(path.delimiter);
  return process.env.PATH;
}

/**
 * 构造一个 shell 命令前缀，确保 PATH 中包含常用安装目录。
 * 用于 `execSync(cmd, { shell: '/bin/bash' })` 这种场景，
 * 即使 augmentPath() 还没有在父进程设置 PATH 也能生效。
 */
function buildShellPathPrefix() {
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? []
    : [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        path.join(home, '.local', 'bin'),
        path.join(home, 'bin'),
        path.join(home, '.nvm', 'versions', 'node', 'current', 'bin'),
        path.join(home, '.npm-global', 'bin'),
      ];
  const existing = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const seen = new Set();
  const merged = [];
  for (const dir of [...candidates, ...existing]) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    merged.push(dir);
  }
  return `PATH="${merged.join(':')}" `;
}

module.exports = { getMachineId, extractOpenClawVersion, parseJSONFromOutput, getGatewayPort, writeLog, logInstallStep, augmentPath, buildShellPathPrefix };
