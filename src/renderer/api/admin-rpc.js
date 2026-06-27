/**
 * Admin RPC API — Gateway RPC 封装
 *
 * 按功能域分组，通过 WebSocket 调用 Gateway API。
 * 所有方法内部调用 wsManager.request() 发送请求。
 *
 * 所有方法都通过 withConnection 包装：在 WS 未就绪时挂起等待
 * hello-ok 或握手完成，避免视图层在 onMounted 时因 WS 还在
 * CONNECTING 阶段就触发请求而 reject('WebSocket 未连接')。
 */

import { wsManager, ConnectionState } from '@/core/websocket/manager'

const CONNECT_WAIT_TIMEOUT_MS = 15000

// 包装一个返回 Promise 的调用：未连接时挂起等待握手完成再执行
function withConnection(promiseFactory) {
  return new Promise((resolve, reject) => {
    if (wsManager.state?.value === ConnectionState.CONNECTED) {
      promiseFactory().then(resolve, reject)
      return
    }
    let settled = false
    let unsubscribe = null
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      if (unsubscribe) unsubscribe()
      reject(new Error('WebSocket 未连接'))
    }, CONNECT_WAIT_TIMEOUT_MS)
    unsubscribe = wsManager.subscribe((data) => {
      if (data?.type === 'res' && data.payload?.type === 'hello-ok') {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (unsubscribe) unsubscribe()
        promiseFactory().then(resolve, reject)
      }
    })
  })
}

// ── 网关状态 / 健康 ──
export const healthAdminApi = {
  check()                  { return withConnection(() => wsManager.request('health')) },
  status()                 { return withConnection(() => wsManager.request('status')) },
  usageStatus()            { return withConnection(() => wsManager.request('usage.status')) },
  usageCost(opts)          { return withConnection(() => wsManager.request('usage.cost', opts || {})) },
}

// ── 日志 ──
export const logAdminApi = {
  async tail(opts) {
    const result = await withConnection(() => wsManager.request('logs.tail', opts || {}))
    // WS 返回 { file, cursor, lines: ["json-string", ...] }
    // 需要转换为 { logs: [obj, ...] }
    if (result?.lines) {
      return {
        logs: result.lines.map(line => {
          try { return JSON.parse(line) }
          catch { return { message: line } }
        }),
        cursor: result.cursor
      }
    }
    return result
  },
}

// ── 配置管理 ──
export function configFromSnapshot(snapshot) {
  return snapshot?.sourceConfig || snapshot?.resolved || snapshot?.config || null
}

export const configAdminApi = {
  get()                    { return withConnection(() => wsManager.request('config.get', {})) },
  set({ config, hash })    { return withConnection(() => wsManager.request('config.set', { raw: JSON.stringify(config), baseHash: hash })) },
  patch({ partial, hash }) { return withConnection(() => wsManager.request('config.patch', { raw: JSON.stringify(partial), baseHash: hash })) },
  apply({ config, hash })  { return withConnection(() => wsManager.request('config.apply', { raw: JSON.stringify(config), baseHash: hash })) },
  schema()                 { return withConnection(() => wsManager.request('config.schema')) },
  schemaLookup(path)       { return withConnection(() => wsManager.request('config.schema.lookup', { path })) },
}

// ── 智能体管理 ──
export const agentAdminApi = {
  list()                   { return withConnection(() => wsManager.request('agents.list')) },
  create(data)             { return withConnection(() => wsManager.request('agents.create', data)) },
  update(data)             { return withConnection(() => wsManager.request('agents.update', data)) },
  delete(data)             { return withConnection(() => wsManager.request('agents.delete', data)) },
}

// ── 智能体工作区文件管理（agents.files.*）──
//    全部走 WebSocket（避免本地/远程读写路径不对称）
export const agentFileAdminApi = {
  list(agentId)                  { return withConnection(() => wsManager.request('agents.files.list', { agentId })) },
  get({ agentId, name })         { return withConnection(() => wsManager.request('agents.files.get', { agentId, name })) },
  set({ agentId, name, content }) { return withConnection(() => wsManager.request('agents.files.set', { agentId, name, content })) },
}

// ── 模型管理 ──
export const modelAdminApi = {
  list(view)               { return withConnection(() => wsManager.request('models.list', view ? { view } : {})) },
  authStatus()             { return withConnection(() => wsManager.request('models.authStatus')) },
}

// ── 节点管理 ──
export const nodeAdminApi = {
  list()                   { return withConnection(() => wsManager.request('node.list')) },
  describe(deviceId)       { return withConnection(() => wsManager.request('node.describe', { deviceId })) },
  pairList()               { return withConnection(() => wsManager.request('node.pair.list')) },
  pairApprove(opts)        { return withConnection(() => wsManager.request('node.pair.approve', opts)) },
  pairReject(opts)         { return withConnection(() => wsManager.request('node.pair.reject', opts)) },
  pairRemove(opts)         { return withConnection(() => wsManager.request('node.pair.remove', opts)) },
  rename(opts)             { return withConnection(() => wsManager.request('node.rename', opts)) },
}

// ── 设备管理 ──
export const deviceAdminApi = {
  pairList()               { return withConnection(() => wsManager.request('device.pair.list')) },
  pairApprove(opts)        { return withConnection(() => wsManager.request('device.pair.approve', opts)) },
  pairReject(opts)         { return withConnection(() => wsManager.request('device.pair.reject', opts)) },
  pairRemove(opts)         { return withConnection(() => wsManager.request('device.pair.remove', opts)) },
}

// ── 频道管理 ──
export const channelAdminApi = {
  status()                 { return withConnection(() => wsManager.request('channels.status')) },
  start(name)              { return withConnection(() => wsManager.request('channels.start', { name })) },
  stop(name)               { return withConnection(() => wsManager.request('channels.stop', { name })) },
  logout(name)             { return withConnection(() => wsManager.request('channels.logout', { name })) },
}

// ── Web 登录 ──
export const webLoginAdminApi = {
  start()                  { return withConnection(() => wsManager.request('web.login.start')) },
  wait(token)              { return withConnection(() => wsManager.request('web.login.wait', { token })) },
}

// ── 审批管理 ──
export const approvalAdminApi = {
  execGet()                { return withConnection(() => wsManager.request('exec.approvals.get')) },
  execSet(policy)          { return withConnection(() => wsManager.request('exec.approvals.set', policy)) },
  execNodeGet()            { return withConnection(() => wsManager.request('exec.approvals.node.get')) },
  execNodeSet(policy)      { return withConnection(() => wsManager.request('exec.approvals.node.set', policy)) },
}

// ── 定时任务管理 ──
export const cronAdminApi = {
  status()                 { return withConnection(() => wsManager.request('cron.status')) },
  list()                   { return withConnection(() => wsManager.request('cron.list')) },
  get(id)                  { return withConnection(() => wsManager.request('cron.get', { id })) },
  runs(opts)               { return withConnection(() => wsManager.request('cron.runs', opts || {})) },
  add(job)                 { return withConnection(() => wsManager.request('cron.add', job)) },
  update(job)              { return withConnection(() => wsManager.request('cron.update', job)) },
  remove(id)               { return withConnection(() => wsManager.request('cron.remove', { id })) },
  run(id)                  { return withConnection(() => wsManager.request('cron.run', { id })) },
}

// ── 诊断 ──
export const diagAdminApi = {
  memoryStatus(opts)       { return withConnection(() => wsManager.request('doctor.memory.status', opts || {})) },
  updateStatus()           { return withConnection(() => wsManager.request('update.status')) },
}

// ── 命令发现 ──
export const commandAdminApi = {
  list()                   { return withConnection(() => wsManager.request('commands.list')) },
}

// ── 技能管理 ──
export const skillsAdminApi = {
  status(agentId) {
    return withConnection(() => wsManager.request('skills.status', agentId ? { agentId } : {}))
  },
  update({ skillKey, enabled, apiKey, env }) {
    return withConnection(() => wsManager.request('skills.update', { skillKey, enabled, apiKey, env }))
  },
  install(params) {
    // 支持两种格式：
    // 从 ClawHub 安装技能：{ source: 'clawhub', slug: '...' }
    // 安装技能依赖：{ name, installId, timeoutMs? }
    return withConnection(() => wsManager.request('skills.install', params))
  },
  bins() {
    return withConnection(() => wsManager.request('skills.bins'))
  },
}
