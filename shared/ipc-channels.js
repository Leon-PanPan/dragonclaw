/**
 * IPC Channels — single source of truth for all IPC communication.
 * Both main process (ipcMain.handle) and renderer (ipcRenderer.invoke) use these constants.
 */

module.exports = {
  // ── Agent Database ──
  AGENT_LIST: 'agentDb:list',
  AGENT_GET: 'agentDb:get',
  AGENT_CREATE: 'agentDb:create',
  AGENT_UPDATE: 'agentDb:update',
  AGENT_DELETE: 'agentDb:delete',
  AGENT_LIST_BY_TYPE: 'agentDb:listByType',

  // ── Agent Assets & Dialogs ──
  SHOW_OPEN_DIRECTORY: 'show-open-directory',
  SAVE_AVATAR: 'save-avatar',

  // ── Session Database ──
  SESSION_RENAME: 'db-rename-session',
  SESSION_GET_TITLES: 'db-get-session-titles',
  SESSION_DELETE_TITLE: 'db-delete-session-title',
  SESSION_PIN: 'db-pin-session',
  SESSION_UNPIN: 'db-unpin-session',
  SESSION_GET_RANKS: 'db-get-session-ranks',
  SESSION_GET_ALL: 'db-get-all-sessions',
  SESSION_SET_PROJECT_SPACE: 'db-set-session-project-space',

  // ── Session Files ──
  SESSIONS_LIST: 'get-sessions',
  SESSION_MESSAGES: 'get-session-messages',
  SAVE_SESSION: 'save-session',
  DELETE_SESSION: 'delete-session',
  SEND_CHAT_MESSAGE: 'send-chat-message',

  // ── Gateway & Environment ──
  GET_OPENCLAW_STATUS: 'get-openclaw-status',
  GET_OPENCLAW_HOME: 'get-openclaw-home',
  QUICK_ENV_CHECK: 'quick-env-check',
  CHECK_GATEWAY_RUNNING: 'check-gateway-running',
  GET_GATEWAY_STATUS: 'get-gateway-status',
  START_OPENCLAW: 'start-openclaw',
  STOP_OPENCLAW: 'stop-openclaw',
  RESTART_OPENCLAW: 'restart-openclaw',

  // ── Config ──
  READ_CONFIG: 'read-config',
  WRITE_CONFIG: 'write-config',
  GET_AGENTS_CONFIG: 'get-agents-config',
  CHECK_OPENCLAW_CONFIG: 'check-openclaw-config',
  SAVE_REMOTE_CONFIG: 'save-remote-config',
  LOAD_REMOTE_CONFIG: 'load-remote-config',
  CLEAR_REMOTE_CONFIG: 'clear-remote-config',

  // ── System ──
  GET_SYSTEM_INFO: 'get-system-info',
  GET_MACHINE_ID: 'get-machine-id',
  GET_APP_VERSION: 'get-app-version',
  SHOW_CONFIRMATION_DIALOG: 'show-confirmation-dialog',
  EXECUTE_COMMAND: 'execute-command',
  WRITE_WS_LOG: 'write-ws-log',
  OPEN_EXTERNAL: 'open-external',

  // ── File Operations ──
  SAVE_FILE: 'save-file',
  READ_FILE: 'read-file',
  FILE_EXISTS: 'file-exists',
  FILE_MTIME: 'file-mtime',
  WORKSPACE_READ: 'openclaw-read-workspace-file',
  WORKSPACE_WRITE: 'openclaw-write-workspace-file',

  // ── Skills ──
  GET_INSTALLED_SKILLS: 'get-installed-skills',
  GET_AGENT_SKILLS: 'get-agent-skills',
  INSTALL_SKILL: 'install-skill',
  UNINSTALL_SKILL: 'uninstall-skill',
  CLAWHUB_LOGIN: 'clawhub-login',

  // ── Installer & Environment ──
  CHECK_ENVIRONMENT: 'check-environment',
  INSTALL_OPENCLAW: 'install-openclaw',
  INSTALL_CLAWHUB: 'install-clawhub',
  FINISH_SETUP: 'finish-setup',
  TEST_FEISHU_CONNECTION: 'test-feishu-connection',
  TEST_MODEL_CONNECTION: 'test-model-connection',
  FETCH_VERSION_CHECK: 'fetch-version-check',
  FETCH_INSTALL_SCRIPT: 'fetch-install-script',
  EXECUTE_INSTALL_STEP: 'execute-install-step',
  REQUEST_NATIVE_PASSWORD: 'request-native-password',
  DOWNLOAD_FILE: 'download-file',
  RECHECK_ENV_VERSIONS: 'recheck-env-versions',
  RESTART_APP: 'restart-app',

  // ── Updater ──
  CHECK_FOR_UPDATES: 'check-for-updates',
  CHECK_FOR_UPDATES_ASYNC: 'check-for-updates-async',
  DOWNLOAD_UPDATE: 'download-update',
  INSTALL_EXE_UPDATE: 'install-exe-update',
  FETCH_API: 'fetch-api',

  // ── Software Manager ──
  SCAN_SOFTWARE: 'software:scan',
  STOP_SCAN_SOFTWARE: 'software:stop-scan',
  TOGGLE_AUTOSTART: 'software:toggle-autostart',
  UNINSTALL_SOFTWARE: 'software:uninstall',
  LAUNCH_SOFTWARE: 'software:launch',
  SOFTWARE_ICON_UPDATE: 'software:icon-update',
  SOFTWARE_SIZE_UPDATE: 'software:size-update',
  SOFTWARE_LASTUSED_UPDATE: 'software:lastused-update',

  // ── Disk Cleanup ──
  CLEANUP_SCAN: 'cleanup:scan',
  CLEANUP_STOP_SCAN: 'cleanup:stop-scan',
  CLEANUP_DELETE: 'cleanup:delete',
  CLEANUP_MOVE: 'cleanup:move',
  CLEANUP_PICK_DIR: 'cleanup:pick-dir',
  CLEANUP_PREVIEW: 'cleanup:preview',
  CLEANUP_REVEAL: 'cleanup:reveal',
  CLEANUP_PROGRESS: 'cleanup:progress',
  CLEANUP_DONE: 'cleanup:done',
  CLEANUP_ERROR: 'cleanup:error',
};
