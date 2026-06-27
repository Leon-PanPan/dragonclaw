/**
 * API modules — wrap window.electronAPI.xxx() calls from preload.
 * All API methods delegate directly to the preload's flat API.
 */
const api = () => window.electronAPI;

export const gatewayApi = {
  status()            { return api().getGatewayStatus(); },
  start()             { return api().startOpenClaw(); },
  stop()              { return api().stopOpenClaw(); },
  restart()           { return api().restartOpenClaw(); },
  checkRunning(port)  { return api().checkGatewayRunning(port); },
};

export const configApi = {
  read()              { return api().readConfig(); },
  write(config)       { return api().writeConfig(config); },
  getAgents()         { return api().getAgentsConfig(); },
  remoteSave(c)       { return api().saveRemoteConfig(c); },
  remoteLoad()        { return api().loadRemoteConfig(); },
  remoteClear()       { return api().clearRemoteConfig(); },
  check()             { return api().checkOpenClawConfig(); },
  finishSetup()       { return api().finishSetup(); },
};

export const systemApi = {
  info()              { return api().getSystemInfo(); },
  machineId()         { return api().getMachineId(); },
  appVersion()        { return api().getAppVersion(); },
  executeCommand(cmd) { return api().executeCommand(cmd); },
  envCheck()          { return api().quickEnvCheck(); },
  testModel(model)    { return api().testModelConnection(model); },
  openclawStatus()    { return api().getOpenClawStatus(); },
  openclawHome()      { return api().getOpenClawHome(); },
  writeWsLog(data)    { return api().writeWsLog(data); },
};

export const fileApi = {
  read(opts)          { return api().readFile(opts); },
  write(opts)         { return api().saveFile(opts); },
  exists(opts)        { return api().fileExists(opts); },
  mtime(opts)         { return api().fileMtime(opts); },
  workspaceRead(opts) { return api().openclawReadWorkspaceFile(opts); },
  workspaceWrite(opts){ return api().openclawWriteWorkspaceFile(opts); },
  download(url, name) { return api().downloadFile(url, name); },
  fetch(opts)         { return api().fetchApi(opts); },
};

export const skillApi = {
  // 注：installed() / agentSkills() 当前未被任何调用方使用，
  // 渲染层已切换为 WS `skills.status`。保留以备未来可能复用。
  installed()         { return api().getInstalledSkills(); },
  agentSkills()       { return api().getAgentSkills(); },
  install(opts)       { return api().installSkill(opts); },
  uninstall(opts)     { return api().uninstallSkill(opts); },
  clawhubLogin()      { return api().clawhubLogin(); },
};

export const envApi = {
  check()             { return api().checkEnvironment(); },
  installOpenClaw(m)  { return api().installOpenClaw(m); },
  installClawhub()    { return api().installClawhub(); },
  recheck()           { return api().recheckEnvVersions(); },
};

export const updaterApi = {
  check()             { return api().checkForUpdates(); },
  checkAsync()        { return api().checkForUpdatesAsync?.(); },
  download()          { return api().downloadUpdate(); },
  install(path)       { return api().installExeUpdate(path); },
};

export const eventsApi = {
  onSetMode(cb)       { return api().onSetMode(cb); },
  onInitialEnv(cb)    { return api().onInitialEnvStatus(cb); },
  onGatewayStatus(cb) { return api().onGatewayStatus?.(cb); },
  onInstallOutput(cb) { return api().onInstallOutput?.(cb); },
  onInstallProgress(cb) { return api().onInstallProgress?.(cb); },
  onUpdateAvailable(cb) { return api().onUpdateAvailable?.(cb); },
  onUpdateProgress(cb)  { return api().onUpdateProgress?.(cb); },
  onComponentUpdate(cb) { return api().onComponentUpdateAvailable?.(cb); },
  onUpdateCheckStatus(cb) { return api().onUpdateCheckStatus?.(cb); },
};
