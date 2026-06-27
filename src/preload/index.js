const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取OpenClaw状态
  getOpenClawStatus: () => ipcRenderer.invoke('get-openclaw-status'),
  getOpenClawHome: () => ipcRenderer.invoke('get-openclaw-home'),
  
  // 快速环境检测（只用 -v 命令，启动时调用）
  quickEnvCheck: () => ipcRenderer.invoke('quick-env-check'),
  
  // 快速检查 Gateway 是否运行（端口检测）
  checkGatewayRunning: (port) => ipcRenderer.invoke('check-gateway-running', port),
  
  // 获取详细的 Gateway 状态（使用 --json）
  getGatewayStatus: () => ipcRenderer.invoke('get-gateway-status'),
  
  // 读写配置文件
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (config) => ipcRenderer.invoke('write-config', config),
  
  // 获取agents配置
  getAgentsConfig: () => ipcRenderer.invoke('get-agents-config'),

  // Agent 数据库
  agentDbList: () => ipcRenderer.invoke('agentDb:list'),
  agentDbGet: (id) => ipcRenderer.invoke('agentDb:get', id),
  agentDbCreate: (agent) => ipcRenderer.invoke('agentDb:create', agent),
  agentDbUpdate: (id, updates) => ipcRenderer.invoke('agentDb:update', { id, updates }),
  agentDbDelete: (id) => ipcRenderer.invoke('agentDb:delete', id),
  agentDbListByType: (type) => ipcRenderer.invoke('agentDb:listByType', type),

  // 智能体资源：选择目录、保存头像
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-directory', options),
  saveAvatar: (data) => ipcRenderer.invoke('save-avatar', data),

  // 启动/停止OpenClaw
  startOpenClaw: () => ipcRenderer.invoke('start-openclaw'),
  stopOpenClaw: () => ipcRenderer.invoke('stop-openclaw'),
  
  // 监听菜单模式切换
  onSetMode: (callback) => ipcRenderer.on('set-mode', (event, mode) => callback(mode)),
  removeSetModeListener: () => ipcRenderer.removeAllListeners('set-mode'),
  
  // 监听打开关于弹窗
  onOpenAboutModal: (callback) => ipcRenderer.on('open-about-modal', () => callback()),
  removeOpenAboutModalListener: () => ipcRenderer.removeAllListeners('open-about-modal'),
  
  // 监听技能安装过程输出
  onSkillInstallOutput: (callback) => ipcRenderer.on('skill-install-output', (event, data) => callback(data)),
  
  // 监听安装进度（OpenClaw安装）
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', (event, data) => callback(data)),
  
  // 移除安装进度监听
  removeInstallProgressListener: () => ipcRenderer.removeAllListeners('install-progress'),
  
  // 监听技能卸载过程输出
  onSkillUninstallOutput: (callback) => ipcRenderer.on('skill-uninstall-output', (event, data) => callback(data)),
  
  // 移除监听器
  removeSkillInstallOutputListener: () => ipcRenderer.removeAllListeners('skill-install-output'),
  removeSkillUninstallOutputListener: () => ipcRenderer.removeAllListeners('skill-uninstall-output'),
  
  // 平台信息
  platform: process.platform,
  
  // 环境变量
  env: {
    NODE_ENV: process.env.NODE_ENV,
  },
  
  // 对话框
  showConfirmationDialog: (title, message) => ipcRenderer.invoke('show-confirmation-dialog', { title, message }),
  
  // 打开外部链接 — 走 IPC，由主进程调用 shell.openExternal
  // （preload 中直接闭包 shell 会被 contextBridge 剥离，导致渲染端拿到 undefined）
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 获取系统信息
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // 获取机器唯一标识（与 main.js getMachineId 一致）
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  
  // 重启OpenClaw服务
  restartOpenClaw: () => ipcRenderer.invoke('restart-openclaw'),
  
  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  checkForUpdatesAsync: () => ipcRenderer.invoke('check-for-updates-async'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installExeUpdate: (exePath) => ipcRenderer.invoke('install-exe-update', exePath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-progress');
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-error');
  },
  onComponentUpdateAvailable: (callback) => {
    ipcRenderer.on('component-update-available', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('component-update-available');
  },
  onUpdateCheckStatus: (callback) => {
    ipcRenderer.on('update-check-status', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-check-status');
  },
  
  // 技能管理API
  getInstalledSkills: () => ipcRenderer.invoke('get-installed-skills'),
  getAgentSkills: () => ipcRenderer.invoke('get-agent-skills'),
  installSkill: ({ skillSlug, workdir }) => ipcRenderer.invoke('install-skill', { skillSlug, workdir }),
  uninstallSkill: ({ skillSlug, workdir }) => ipcRenderer.invoke('uninstall-skill', { skillSlug, workdir }),
  clawhubLogin: () => ipcRenderer.invoke('clawhub-login'),
  
  // Session 管理 API
  getSessions: (agentId) => ipcRenderer.invoke('get-sessions', agentId),
  getSessionMessages: ({ agentId, sessionKey }) => ipcRenderer.invoke('get-session-messages', { agentId, sessionKey }),
  saveSession: ({ agentId, sessionKey, sessionData }) => ipcRenderer.invoke('save-session', { agentId, sessionKey, sessionData }),
  deleteSession: ({ agentId, sessionKey }) => ipcRenderer.invoke('delete-session', { agentId, sessionKey }),
  sendChatMessage: ({ agentId, messages, stream }) => ipcRenderer.invoke('send-chat-message', { agentId, messages, stream }),
  
  // 测试模型连接
  testModelConnection: (model) => ipcRenderer.invoke('test-model-connection', model),
  
  // 环境检测和安装相关API
  checkEnvironment: () => ipcRenderer.invoke('check-environment'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  installOpenClaw: (method) => ipcRenderer.invoke('install-openclaw', method),
  installClawhub: () => ipcRenderer.invoke('install-clawhub'),
  checkOpenClawConfig: () => ipcRenderer.invoke('check-openclaw-config'),
  finishSetup: () => ipcRenderer.invoke('finish-setup'),
  
  // 文件操作API
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  readFile: (options) => ipcRenderer.invoke('read-file', options),
  fileExists: (options) => ipcRenderer.invoke('file-exists', options),
  fileMtime: (options) => ipcRenderer.invoke('file-mtime', options),

  // OpenClaw Workspace 文件操作
  openclawReadWorkspaceFile: (options) => ipcRenderer.invoke('openclaw-read-workspace-file', options),
  openclawWriteWorkspaceFile: (options) => ipcRenderer.invoke('openclaw-write-workspace-file', options),

  // 远程配置管理
  saveRemoteConfig: (config) => ipcRenderer.invoke('save-remote-config', config),
  loadRemoteConfig: () => ipcRenderer.invoke('load-remote-config'),
  clearRemoteConfig: () => ipcRenderer.invoke('clear-remote-config'),

  // 通用 API 请求（解决跨域问题）
  fetchApi: ({ url, method = 'GET', headers = {}, body = null }) => ipcRenderer.invoke('fetch-api', { url, method, headers, body }),

  // ==================== 一键安装（clawc API）====================
  fetchVersionCheck: () => ipcRenderer.invoke('fetch-version-check'),
  fetchInstallScript: (url) => ipcRenderer.invoke('fetch-install-script', { url }),
  executeInstallStep: (command, name, sudoPassword, envVars, key) => ipcRenderer.invoke('execute-install-step', { command, name, sudoPassword, envVars, key }),
  requestNativePassword: (title, message) => ipcRenderer.invoke('request-native-password', { title, message }),
  onInstallStepOutput: (callback) => {
    ipcRenderer.on('install-step-output', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('install-step-output');
  },
  // 下载文件（带进度）
  downloadFile: (url, tempName) => ipcRenderer.invoke('download-file', { url, tempName }),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('download-progress');
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download-error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('download-error');
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-error');
  },
  recheckEnvVersions: () => ipcRenderer.invoke('recheck-env-versions'),

  // 数据库操作（SQLite 会话标题）
  dbRenameSession: (sessionId, title) => ipcRenderer.invoke('db-rename-session', { sessionId, title }),
  dbGetSessionTitles: () => ipcRenderer.invoke('db-get-session-titles'),
  dbDeleteSessionTitle: (sessionId) => ipcRenderer.invoke('db-delete-session-title', sessionId),

  // 会话置顶/取消置顶
  dbPinSession: (sessionId) => ipcRenderer.invoke('db-pin-session', { sessionId }),
  dbUnpinSession: (sessionId) => ipcRenderer.invoke('db-unpin-session', { sessionId }),
  dbGetSessionRanks: () => ipcRenderer.invoke('db-get-session-ranks'),
  dbGetAllSessions: () => ipcRenderer.invoke('db-get-all-sessions'),
  dbSetSessionProjectSpace: (sessionId, projectSpace) => ipcRenderer.invoke('db-set-session-project-space', { sessionId, projectSpace }),

  // WebSocket 日志写入
  writeWsLog: ({ direction, data }) => ipcRenderer.invoke('write-ws-log', { direction, data }),

  // ── Software Manager ──
  scanSoftware: () => ipcRenderer.invoke('software:scan'),
  stopScanSoftware: () => ipcRenderer.invoke('software:stop-scan'),
  toggleAutostart: ({ app, enabled }) => ipcRenderer.invoke('software:toggle-autostart', { app, enabled }),
  uninstallSoftwareByApp: (app) => ipcRenderer.invoke('software:uninstall', { app }),
  launchSoftwareByApp: (app) => ipcRenderer.invoke('software:launch', { app }),
  onSoftwareScanProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:scan-progress', handler);
    return () => ipcRenderer.removeListener('software:scan-progress', handler);
  },
  onSoftwareScanDone: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:scan-done', handler);
    return () => ipcRenderer.removeListener('software:scan-done', handler);
  },
  onSoftwareScanError: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:scan-error', handler);
    return () => ipcRenderer.removeListener('software:scan-error', handler);
  },
  onSoftwareIconUpdate: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:icon-update', handler);
    return () => ipcRenderer.removeListener('software:icon-update', handler);
  },
  onSoftwareSizeUpdate: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:size-update', handler);
    return () => ipcRenderer.removeListener('software:size-update', handler);
  },
  onSoftwareLastUsedUpdate: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('software:lastused-update', handler);
    return () => ipcRenderer.removeListener('software:lastused-update', handler);
  },

  // ── Disk Cleanup ──
  cleanupScan: () => ipcRenderer.invoke('cleanup:scan'),
  cleanupStopScan: () => ipcRenderer.invoke('cleanup:stop-scan'),
  cleanupDelete: (paths) => ipcRenderer.invoke('cleanup:delete', { paths }),
  cleanupMove: (paths, targetDir) => ipcRenderer.invoke('cleanup:move', { paths, targetDir }),
  cleanupPickDir: (title) => ipcRenderer.invoke('cleanup:pick-dir', { title }),
  cleanupPreview: (filePath) => ipcRenderer.invoke('cleanup:preview', { path: filePath }),
  cleanupReveal: (filePath) => ipcRenderer.invoke('cleanup:reveal', { path: filePath }),
  onCleanupStarted: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:started', h);
    return () => ipcRenderer.removeListener('cleanup:started', h);
  },
  onCleanupRootStart: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:root-start', h);
    return () => ipcRenderer.removeListener('cleanup:root-start', h);
  },
  onCleanupRootDone: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:root-done', h);
    return () => ipcRenderer.removeListener('cleanup:root-done', h);
  },
  onCleanupProgress: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:progress', h);
    return () => ipcRenderer.removeListener('cleanup:progress', h);
  },
  onCleanupFiles: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:files', h);
    return () => ipcRenderer.removeListener('cleanup:files', h);
  },
  onCleanupDone: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:done', h);
    return () => ipcRenderer.removeListener('cleanup:done', h);
  },
  onCleanupError: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('cleanup:error', h);
    return () => ipcRenderer.removeListener('cleanup:error', h);
  },
});
