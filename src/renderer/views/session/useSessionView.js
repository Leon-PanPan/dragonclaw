import { ref, computed, reactive, watch, nextTick } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { parseMessageContent, extractTextFromContent, getTextContentFromContent, parseAssistantContent } from '@/utils/messageParser'
import { wsManager, ConnectionState } from '@/core/websocket/manager'
import { openExternal } from '@/core/ipc'
import { useModelStore } from '@/stores/modelStore'

// ==================== 模块级共享响应式状态 ====================

// 统一从 modelStore 读取模型数据；模块级懒加载避免 Pinia 初始化顺序问题
let _modelStore = null
const getModelStore = () => {
  if (!_modelStore) _modelStore = useModelStore()
  return _modelStore
}

export const hoveredSessionId = ref(null)
export const dropdownOpenSessionId = ref(null)
export const showRenameModal = ref(false)
export const renamingSession = ref(null)
export const renameInputValue = ref('')
export const renameSaving = ref(false)
export const dbSessionTitles = reactive({})

export const agentList = ref([])
export const unreadCount = ref(0)
export const agentUnreadMap = reactive({})
export const sessionUnreadMap = reactive({})

export const sessions = ref([])
export const currentSessionId = ref(null)
export const selectedNewSessionAgent = ref('')

export const childSessions = ref([])
export const selectedSubagentKey = ref('')

export const messages = ref([])
export const hasMoreHistory = ref(true)
export const historyLimit = ref(50)

export const currentThinkingMsgId = ref(null)
export const showStreamingThinking = ref(true)
export const sessionTasks = ref([])
export const showStreamingTools = ref(false)
export const showRightPanel = ref(false)

export const showResultDrawer = ref(false)
export const currentResultTitle = ref('')
export const currentResultTool = ref('')
export const currentResultStatus = ref('')
export const currentResultStatusText = ref('')
export const currentResultThinking = ref('')
export const currentResultArgs = ref('')
export const currentResultHtml = ref('')

export const selectedModel = ref('')
export const modelSelectorRef = ref(null)
export const selectedThinkingLevel = ref('')
export const STORAGE_KEY_REASONING = 'dragonclaw_reasoning_visible'

export const workspaceInstructionPending = ref(false)
export const inputText = ref('')
export const streamingResponse = ref('')
export const isStreaming = ref(false)
export const isThinking = ref(false)
export const isStreamingError = ref(false)
export const isLoadingMessages = ref(false)
export const isLoadingHistory = ref(false)
export const pendingMessages = ref([])
export const sending = ref(false)
export const messageListRef = ref(null)
export const inputTextareaRef = ref(null)

export const getModelName = (modelId) => {
  if (!modelId) return ''
  const m = getModelStore().getModelById(modelId)
  return m ? m.name : modelId
}

export const selectedModelName = computed(() => {
  if (!selectedModel.value) return '选择模型'
  const m = getModelStore().getModelById(selectedModel.value)
  return m ? m.name : ''
})

export const thinkingLevelOptions = computed(() => {
  const efforts = modelSelectorRef.value?.selectedReasoningEfforts
  if (!efforts || !Array.isArray(efforts)) return []
  return efforts
})

export const showThinkingLevelSelect = computed(() => thinkingLevelOptions.value.length > 0)

export const onThinkingLevelChange = (value) => {
  selectedThinkingLevel.value = value
  if (!currentSession.value?.key) return
  const updates = {}
  if (value) updates.thinkingLevel = value
  else updates.thinkingLevel = null
  wsManager.updateSession(currentSession.value.key, updates)
}

export const workspaceLabel = computed(() => {
  const p = currentSession.value?.projectSpace
  if (!p) return '设置工作区'
  const segs = p.replace(/[/\\]+$/, '').split(/[/\\]/)
  return segs[segs.length - 1] || p
})

export const workspaceIsSet = computed(() => !!currentSession.value?.projectSpace)

export const verboseEnabled = ref(false)
export const reasoningVisibleEnabled = ref(
  (() => { try { return localStorage.getItem(STORAGE_KEY_REASONING) === 'true'; } catch (_) { return false; } })()
)

export const isAtBottom = ref(true)
export const currentRunId = ref(null)

export const toolExpandedMap = reactive({})
export const thinkingExpandedMap = reactive({})
export const sessionRankMap = reactive({})
export const groupShowLimit = reactive({})

export const activeToolKeys = ref([])

export const sessionStats = ref({
  totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
  totalThinkingCount: 0, totalToolCallCount: 0,
  totalToolSuccessCount: 0, totalToolErrorCount: 0, totalRuns: 0,
})
export const showSessionStats = ref(false)
export const currentRunStats = ref({
  thinkingCount: 0, toolCallCount: 0, toolSuccessCount: 0, toolErrorCount: 0,
  tokenInput: 0, tokenOutput: 0, tokenTotal: 0,
})

// 各会话"切走时未完成 run"的暂存：key = sessionId，value = 暂存的 messages 数组深拷贝。
// 实时回复（isStreaming / isThinking）期间切换会话时，客户端累积的消息（user/thinkingMsg/toolUse）
// 不会被 server 持久化（server 通常只在 chat.state=final 后才落库），
// 切走直接清空 messages 会导致这些累积内容丢失。切回来时与 server 历史合并恢复。
export const sessionDraftMap = reactive({})

// ==================== Computed ====================

export const currentSession = computed(() =>
  sessions.value.find(s => s.id === currentSessionId.value)
)

export const currentSessionModel = computed(() => {
  if (!currentSession.value) return ''
  const model = currentSession.value.model
  if (!model) return ''
  if (typeof model === 'object' && model.primary) return model.primary
  if (typeof model === 'string' && model.startsWith('{')) {
    try { const p = JSON.parse(model); if (p?.primary) return p.primary } catch (e) {}
  }
  return model
})

export const extractModelId = (model) => {
  if (model == null) return ''
  if (typeof model === 'object') return model.primary || model.id || ''
  if (typeof model === 'string') {
    if (model.startsWith('{')) {
      try {
        const parsed = JSON.parse(model)
        if (parsed && typeof parsed === 'object') return parsed.primary || parsed.id || ''
      } catch (e) {}
    }
    return model
  }
  return ''
}

export const currentSessionModelName = computed(() => {
  const id = currentSessionModel.value
  if (!id) return ''
  const m = getModelStore().getModelById(id)
  return m ? m.name : id
})

export const getTimeString = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const filteredSessions = computed(() => sessions.value)

export const sortedSessions = computed(() => {
  return [...filteredSessions.value].sort((a, b) => {
    const rankA = sessionRankMap[a.id] || 0
    const rankB = sessionRankMap[b.id] || 0
    if (rankB !== rankA) return rankB - rankA
    return new Date(b.updatedAt) - new Date(a.updatedAt)
  })
})

export const groupedSessions = computed(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)

  const pinned = []
  const today = []
  const thisWeek = []
  const thisMonth = []
  const older = []

  for (const s of sortedSessions.value) {
    if (sessionRankMap[s.id]) {
      pinned.push(s)
    } else {
      const updated = new Date(s.updatedAt)
      if (updated >= todayStart) today.push(s)
      else if (updated >= weekAgo) thisWeek.push(s)
      else if (updated >= monthAgo) thisMonth.push(s)
      else older.push(s)
    }
  }

  return [
    { label: '置顶', sessions: pinned },
    { label: '今天', sessions: today },
    { label: '一周内', sessions: thisWeek },
    { label: '一个月内', sessions: thisMonth },
    { label: '更久', sessions: older },
  ]
})

export const currentAgentName = computed(() => {
  if (currentSession.value?.agentName) return currentSession.value.agentName
  return '助手'
})

export const sessionHasMessages = computed(() => messages.value.length > 0)

export const wsConnected = computed(() => wsManager?.state?.value === ConnectionState.CONNECTED)

// 节流流式 Markdown 解析（每 80ms 最多解析一次，减少高频重渲染）
export const throttledStreamingHtml = ref('')
let _throttleTimer = null
watch(streamingResponse, (val) => {
  if (!val) {
    throttledStreamingHtml.value = ''
    if (_throttleTimer) { clearTimeout(_throttleTimer); _throttleTimer = null }
    return
  }
  if (_throttleTimer) return
  _throttleTimer = setTimeout(() => {
    const parsed = parseMessageContent(val)
    throttledStreamingHtml.value = parsed.html || ''
    _throttleTimer = null
  }, 80)
}, { immediate: true })

export const parsedStreamingContent = computed(() => parseMessageContent(streamingResponse.value))

export const streamingToolItems = computed(() => {
  let lastStopIdx = -1
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].stopReason === 'stop') { lastStopIdx = i; break }
  }
  return messages.value.filter((m, idx) =>
    idx > lastStopIdx && m.role === 'assistant' && m.stopReason === 'toolUse'
  )
})

export const streamingThinkingCount = computed(() => {
  return streamingToolItems.value.filter(m => m.thinkingText).length
})

export const latestThinkingMsg = computed(() => {
  // 只返回"当前 run"的思考消息（由 currentThinkingMsgId 标识），
  // 避免在用户发送新消息、lifecycle:start 事件尚未到达时显示上一次的思考内容
  if (!currentThinkingMsgId.value) return null
  const current = messages.value.find(m => m.id === currentThinkingMsgId.value)
  return current || null
})

export const groupedMessages = computed(() => {
  const result = []
  let pendingThinking = null
  let pendingToolItems = []

  const flushPending = (syntheticId) => {
    if (pendingThinking || pendingToolItems.length > 0) {
      const toolThinkingCount = pendingThinking ? pendingToolItems.length : 0
      const syntheticItem = {
        role: 'assistant',
        stopReason: 'stop',
        content: [],
        id: syntheticId || `pending_flush_${result.length}`,
        isPendingFlush: true,
      }
      result.push({
        type: 'assistantReply',
        item: syntheticItem,
        thinkingMsg: pendingThinking,
        toolItems: [...pendingToolItems],
        toolThinkingCount,
        id: syntheticItem.id,
      })
      pendingThinking = null
      pendingToolItems = []
    }
  }

  for (let i = 0; i < messages.value.length; i++) {
    const msg = messages.value[i]
    if (msg.role === 'assistant' && msg.stopReason === 'thinking') {
      pendingThinking = msg
    } else if (msg.role === 'assistant' && msg.stopReason === 'toolUse') {
      pendingToolItems.push(msg)
    } else if (msg.role === 'assistant' && msg.stopReason === 'stop') {
      // 总是把累积的 pendingThinking / pendingToolItems 合并到本 stop 消息。
      // 原因：
      // 1. 实时回复期间，messages 累积了 thinkingMsg + 多个 toolUse（来自 agent/* 事件），
      //    chat.state=final 给的 stop.content 通常是纯文本（不含 toolCall），
      //    若不合并会导致工具调用被 split 成独立的 assistantReply，与 stop 自身分离显示。
      // 2. 历史加载（_loadChatHistory / loadMoreHistory）已经把 stop.content 中的
      //    thinking/toolCall 拆出到独立消息，合并后即在最后一项 assistantReply 上呈现工具栏。
      const toolThinkingCount = pendingThinking ? pendingToolItems.length : 0
      result.push({
        type: 'assistantReply',
        item: msg,
        thinkingMsg: pendingThinking,
        toolItems: [...pendingToolItems],
        toolThinkingCount,
        id: msg.id || `reply_${i}`,
      })
      pendingThinking = null
      pendingToolItems = []
    } else if (msg.role === 'toolResult') {
      // toolResult 的数据已经在 _loadChatHistory 中合并到对应 toolUse 消息的
      // hasResult/result/resultContent 字段上，无需在 groupedMessages 中单独渲染
      // 这里跳过即可
    } else {
      // 其他类型（user 消息等）：先 flush 累积的 pending，再 push 当前消息
      // 这样 user 消息之前未合并的 toolUse/思考消息不会丢失
      flushPending(`before_other_${i}`)
      result.push({ type: 'message', item: msg, id: msg.id || `msg_${i}` })
    }
  }

  // 末尾 flush：当历史以 toolUse 结尾（无 stop 消息）时，把累积的 pendingToolItems 也输出为 assistantReply
  flushPending('end_flush')

  return result
})

// ==================== 工具函数 ====================

const toolIcons = {
  web_search: '\u{1F50D}', web_fetch: '\u{1F310}', read: '\u{1F4D6}', write: '\u270F\uFE0F',
  edit: '\u{1F4DD}', exec: '\u26A1', memory_search: '\u{1F52E}', default: '\u{1F527}'
}

const toolNameCNMap = {
  read: '读取文件 read', edit: '修改文件 edit', write: '写入文件 write', exec: '执行命令 exec',
  sessions_spawn: '创建子智能体 sessions_spawn', subagents: '创建子智能体 subagents',
  web_search: '搜索网络 web_search', web_fetch: '获取网页 web_fetch', browser: '浏览器控制 browser',
  memory_search: '记忆搜索 memory_search', memory_get: '获取记忆 memory_get',
  sessions_list: '列出会话 sessions_list', sessions_history: '获取历史 sessions_history',
  sessions_send: '发送消息 sessions_send', process: '管理进程 process', apply_patch: '应用补丁 apply_patch',
  gateway: '网关控制 gateway', cron: '定时任务 cron', nodes: '节点管理 nodes',
  canvas: 'Canvas控制 canvas', image: '图像分析 image', message: '发送消息 message',
}

export const getToolIcon = (toolName) => toolIcons[toolName] || toolIcons['default']
export const getToolNameCN = (toolName) => {
  if (!toolName) return '思考'
  return toolNameCNMap[toolName] || toolName
}

export const getToolArgsSummary = (msg) => {
  if (msg.toolName === 'exec') {
    try {
      const argsObj = typeof msg.args === 'string' ? JSON.parse(msg.args) : msg.args
      if (argsObj?.command) { const cmd = argsObj.command; return cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd }
    } catch (e) {}
  }
  if (msg.args) {
    try {
      const argsObj = typeof msg.args === 'string' ? JSON.parse(msg.args) : msg.args
      if (msg.toolName === 'write' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
        const sizeInfo = argsObj.content ? ` (${argsObj.content.length} bytes)` : ''
        return `写入 ${fileName}${sizeInfo}`
      }
      if (msg.toolName === 'edit' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
        return `编辑 ${fileName}`
      }
      if (msg.toolName === 'read' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
        return `读取 ${fileName}`
      }
    } catch (e) {}
  }
  if (msg.toolName === 'web_search' && msg.args) {
    try {
      const argsObj = typeof msg.args === 'string' ? JSON.parse(msg.args) : msg.args
      if (argsObj?.query) return `\u{1F50D} ${argsObj.query}`
    } catch (e) {}
  }
  if (msg.args) {
    const args = typeof msg.args === 'string' ? msg.args : JSON.stringify(msg.args)
    return args.length > 50 ? args.substring(0, 50) + '...' : args
  }
  if (!msg.hasResult) return '执行中...'
  if (msg.result) {
    const r = typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result)
    if (msg.isError) return `\u274C ${r.substring(0, 50)}`
    return r.length > 50 ? r.substring(0, 50) + '...' : r
  }
  if (msg.isError) return '执行失败'
  return '执行成功'
}

export const getToolCmdDisplay = (msg) => {
  if (!msg.toolName || !msg.args) return ''
  try {
    const argsObj = typeof msg.args === 'string' ? JSON.parse(msg.args) : msg.args
    let display = ''
    if (msg.toolName === 'exec' && argsObj.command) display = `\u26A1 ${argsObj.command}`
    else if (msg.toolName === 'write' && (argsObj.path || argsObj.file_path)) {
      const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
      const sizeInfo = argsObj.content ? ` (${argsObj.content.length} bytes)` : ''
      display = `\u270F\uFE0F 写入 ${fileName}${sizeInfo}`
    } else if (msg.toolName === 'edit' && (argsObj.path || argsObj.file_path)) {
      const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
      display = `\u{1F4DD} 编辑 ${fileName}`
    } else if (msg.toolName === 'read' && (argsObj.path || argsObj.file_path)) {
      const p = argsObj.path || argsObj.file_path; const fileName = p.split('/').pop()
      display = `\u{1F4D6} 读取 ${fileName}`
    } else if (msg.toolName === 'web_search' && argsObj.query) display = `\u{1F50D} 搜索: ${argsObj.query}`
    else if (msg.toolName === 'web_fetch' && argsObj.url) display = `\u{1F310} 获取 ${argsObj.url}`
    else if (msg.toolName === 'memory_search' && argsObj.query) display = `\u{1F52E} 记忆搜索: ${argsObj.query}`
    else return ''
    if (display.length > 40) return display.substring(0, 40) + '...'
    return display
  } catch (e) {}
  return ''
}

export const getTimelineDotClass = (msg) => {
  if (msg.hasResult === false) return 'dot-loading'
  if (msg.isError) return 'dot-error'
  return 'dot-success'
}

export const getTimelineCardClass = (msg) => {
  if (msg.hasResult === false) return 'card-loading'
  if (msg.isError) return 'card-error'
  return 'card-success'
}

export const getTimelineIcon = (msg) => {
  if (msg.hasResult === false) return '\u{1F504}'
  if (msg.isError) return '\u274C'
  return '\u2705'
}

export const handleTimelineClick = (msg) => {
  const toolCallId = msg.toolCallId
  if (!toolCallId) return
  currentResultTitle.value = getToolCmdDisplay(msg) || getToolNameCN(msg.toolName)
  currentResultTool.value = getToolNameCN(msg.toolName)
  if (!msg.hasResult) {
    currentResultStatus.value = 'loading'; currentResultStatusText.value = '\u{1F504} 执行中...'
  } else if (msg.isError) {
    currentResultStatus.value = 'error'; currentResultStatusText.value = '\u274C 执行失败'
  } else {
    currentResultStatus.value = 'success'; currentResultStatusText.value = '\u2705 执行成功'
  }
  currentResultThinking.value = msg.thinkingText || ''
  currentResultArgs.value = ''
  if (msg.args) {
    try {
      const argsObj = typeof msg.args === 'string' ? JSON.parse(msg.args) : msg.args
      if (msg.toolName === 'write' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path
        currentResultArgs.value = JSON.stringify({ path: p, content: `[${(argsObj.content || '').length} 字符]` }, null, 2)
      } else if (msg.toolName === 'edit' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path
        currentResultArgs.value = JSON.stringify({ path: p, old_string: argsObj.old_string, new_string: argsObj.new_string }, null, 2)
      } else if (msg.toolName === 'read' && (argsObj.path || argsObj.file_path)) {
        const p = argsObj.path || argsObj.file_path
        currentResultArgs.value = JSON.stringify({ path: p, offset: argsObj.offset, limit: argsObj.limit }, null, 2)
      } else if (msg.toolName === 'exec' && argsObj.command) {
        currentResultArgs.value = JSON.stringify({ command: argsObj.command, workdir: argsObj.workdir || '' }, null, 2)
      } else { currentResultArgs.value = JSON.stringify(argsObj, null, 2) }
    } catch (e) { currentResultArgs.value = typeof msg.args === 'string' ? msg.args : JSON.stringify(msg.args) }
  }
  let toolResultContent = ''
  let found = !!msg.resultContent
  if (msg.resultContent) { toolResultContent = msg.resultContent }
  else {
    const currentIndex = messages.value.findIndex(m => m.id === msg.id)
    if (currentIndex !== -1) {
      for (let i = currentIndex + 1; i < messages.value.length; i++) {
        const nextMsg = messages.value[i]
        if (nextMsg.role === 'toolResult' && nextMsg.toolCallId === toolCallId) {
          toolResultContent = nextMsg.content
            ? (typeof nextMsg.content === 'string' ? nextMsg.content : extractTextFromContent(nextMsg.content))
            : (nextMsg.result || '')
          found = true; break
        }
        if (nextMsg.role === 'user' || (nextMsg.role === 'assistant' && nextMsg.stopReason === 'stop')) break
      }
    }
  }
  currentResultHtml.value = found && toolResultContent ? parseMessageContent(toolResultContent).html : ''
  showResultDrawer.value = true
}

export const getMessageHtml = (msg) => {
  if (msg.role === 'user') {
    const text = typeof msg.content === 'string' ? msg.content : extractTextFromContent(msg.content)
    return parseMessageContent(text).html || text
  } else if (msg.role === 'assistant' && msg.stopReason === 'stop') {
    const text = extractTextFromContent(msg.content)
    return parseMessageContent(text).html || text
  } else if (msg.role === 'assistant' && msg.stopReason === 'thinking') {
    const text = msg.thinkingBuffer || '思考中...'
    return '<span style="color: var(--color-text-4); font-size: 12px;">' + text.substring(0, 100) + '</span>'
  } else if (msg.role === 'assistant' && msg.stopReason === 'toolUse') {
    const toolName = msg.toolName || '未知工具'
    const desc = msg.thinkingSummary || ''
    return '<span style="color: var(--color-text-3); font-size: 12px;">\u{1F527} ' + toolName + (desc ? ': ' + desc.substring(0, 50) : '') + '</span>'
  } else if (msg.role === 'assistant' && msg.stopReason === 'error') {
    // 错误消息气泡：与 stop 消息相同样式，红色背景突出显示
    const text = extractTextFromContent(msg.content)
    const html = parseMessageContent(text).html || text
    // 注入错误样式：红色左边框 + 浅红背景
    return '<div style="border-left: 3px solid #f53f3f; background: rgba(245, 63, 63, 0.06); padding: 4px 10px; border-radius: 4px; color: #f53f3f;">\u26A0 ' + html + '</div>'
  }
  return ''
}

export const handleMessageClick = (event) => {
  const target = event.target
  if (target.tagName === 'A' || target.closest('a')) {
    event.preventDefault()
    const link = target.tagName === 'A' ? target : target.closest('a')
    const href = link.getAttribute('href')
    if (href) {
      try { openExternal(href) }
      catch (e) { window.open(href, '_blank') }
    }
  }
}

export const formatToolArgs = (args) => {
  if (!args) return ''
  if (typeof args === 'string') return args
  try { return JSON.stringify(args, null, 2) } catch (e) { return String(args) }
}

export const getThinkingHtml = (msg) => {
  if (!msg.thinkingBuffer) return ''
  try { const parsed = parseMessageContent(msg.thinkingBuffer); return parsed.html || msg.thinkingBuffer }
  catch (e) { return msg.thinkingBuffer }
}

export const isToolExpanded = (group) => !!toolExpandedMap[group.id]
export const toggleToolSummary = (group) => { toolExpandedMap[group.id] = !toolExpandedMap[group.id] }

export const isThinkingExpanded = (group) => !!thinkingExpandedMap[group.id]
export const toggleThinkingInline = (group) => { thinkingExpandedMap[group.id] = !thinkingExpandedMap[group.id] }

export const hasGroupStats = (group) => {
  if (!group) return false
  return group.toolThinkingCount > 0 || (group.toolItems && group.toolItems.length > 0)
}

export const formatTokens = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

export const getContextInfo = (group) => {
  if (!group.runStats) return ''
  const rs = group.runStats
  const input = formatTokens(rs.tokenInput || 0)
  const output = formatTokens(rs.tokenOutput || 0)
  const total = formatTokens(rs.tokenTotal || 0)
  const parts = []
  if (rs.tokenInput > 0) parts.push('↑' + input)
  if (rs.tokenOutput > 0) parts.push('↓' + output)
  if (rs.tokenTotal > 0) parts.push('R' + total)
  const model = rs.model ? ' ctx ' + rs.model : ''
  return parts.join(' ') + model
}

export const formatTokenCount = (count) => {
  if (!count || count < 1000) return String(count || 0)
  if (count < 1000000) return (count / 1000).toFixed(1) + 'K'
  return (count / 1000000).toFixed(1) + 'M'
}

export const formatMessageTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export const findAgentIdBySessionKey = (sessionKey) => {
  if (!sessionKey) return null
  const session = sessions.value.find(s => s.key === sessionKey)
  return session?.agentId || null
}

export const clearUnread = (sessionId) => {
  const count = sessionUnreadMap[sessionId] || 0
  if (count > 0) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session?.agentId) {
      const hasOtherUnread = sessions.value.some(s =>
        s.agentId === session.agentId && s.id !== sessionId && sessionUnreadMap[s.id] > 0
      )
      if (!hasOtherUnread) delete agentUnreadMap[session.agentId]
    }
    delete sessionUnreadMap[sessionId]
  }
}

export const getAgentName = (agent) => agent?.identity?.name || agent?.name || agent?.id || '未知'
export const getAgentInitial = (agent) => { const name = getAgentName(agent); return name.charAt(0).toUpperCase() }

export const getAgentColor = (agentId) => {
  const colors = ['rgb(var(--primary-6))', 'rgb(var(--success-6))', 'rgb(var(--warning-6))', 'rgb(var(--danger-6))', '#722ED1', '#EB0AA4', '#0FC6C2', '#B6A500']
  let hash = 0
  for (let i = 0; i < (agentId || '').length; i++) { hash = ((hash << 5) - hash) + (agentId || '').charCodeAt(i); hash = hash & hash }
  return colors[Math.abs(hash) % colors.length]
}

export const getAgentDefaultModel = (agent) => {
  const store = getModelStore()
  if (agent?.defaultModel) { const model = store.getModelById(agent.defaultModel); return model ? model.name : agent.defaultModel }
  if (agent?.modelProvider && agent?.model) {
    const model = agent.model
    if (typeof model === 'object' && model?.primary) return model.primary
    if (typeof model === 'string' && model.startsWith('{')) { try { const p = JSON.parse(model); if (p?.primary) return p.primary } catch (e) {} }
    return model
  }
  const defaultModel = store.models[0]
  return defaultModel ? defaultModel.name : '未配置'
}

export const getAgentDefaultModelId = (agent) => {
  const store = getModelStore()
  if (agent?.defaultModel) { const found = store.getModelById(agent.defaultModel); if (found) return agent.defaultModel }
  if (agent?.model) {
    if (typeof agent.model === 'object' && agent.model?.primary) return agent.model.primary
    if (typeof agent.model === 'string') {
      if (agent.model.startsWith('{')) { try { const p = JSON.parse(agent.model); if (p?.primary) return p.primary } catch (e) {} }
      return agent.model
    }
  }
  return store.models[0]?.id || ''
}

export const getSessionAgentColor = (session) => {
  const agent = agentList.value.find(a => a.id === session.agentId)
  if (agent) return getAgentColor(agent.id)
  return '#94A3B8'
}

export const getSessionAgentInitial = (session) => {
  if (session.agentName && session.agentName !== '助手') return session.agentName.charAt(0).toUpperCase()
  const agent = agentList.value.find(a => a.id === session.agentId)
  if (agent) return getAgentInitial(agent)
  return '?'
}

export const selectNewSessionAgentFn = (agent) => {
  selectedNewSessionAgent.value = agent.id
  if (currentSession.value) {
    currentSession.value.agentId = agent.id
    currentSession.value.agentName = agent.identity?.name || agent.name || agent.id
    currentSession.value.key = `agent:${agent.id}:main:${Date.now()}`
  }
  // 解析默认模型：与 autoCreateSession 保持一致，格式化为 provider/modelId
  const rawModelId = getAgentDefaultModelId(agent)
  if (rawModelId) {
    const store = getModelStore()
    const matched = store.getModelById(rawModelId)
    if (matched) selectedModel.value = `${matched.provider}/${matched.id}`
    else selectedModel.value = rawModelId
  }
}

export const isSessionPinned = (sessionId) => !!sessionRankMap[sessionId]
export const needsMarquee = (session) => { const title = getSessionTitle(session); return title && title.length > 15 }

export const getSessionTitle = (session) => {
  if (!session) return '新会话'
  const dbTitle = dbSessionTitles[session.id] || dbSessionTitles[session.sessionId] || dbSessionTitles[session.key]
  if (dbTitle) return dbTitle
  if (session.lastUserMessage) return session.lastUserMessage
  if (session.lastMessage) return session.lastMessage.substring(0, 20)
  if (session.agentName && session.agentName !== '助手') return session.channel ? `${session.agentName}[${session.channel}]` : session.agentName
  return session.title || '会话'
}

export const handlePinSession = async (session) => {
  try {
    const result = await window.electronAPI?.dbPinSession(session.id)
    if (result?.success) { sessionRankMap[session.id] = result.rank; Message.success('已置顶') }
    else Message.error('置顶失败')
  } catch (e) { Message.error('置顶失败: ' + e.message) }
}

export const handleUnpinSession = async (session) => {
  try {
    const result = await window.electronAPI?.dbUnpinSession(session.id)
    if (result?.success) { delete sessionRankMap[session.id]; Message.success('已取消置顶') }
    else Message.error('取消置顶失败')
  } catch (e) { Message.error('取消置顶失败: ' + e.message) }
}

export const startRename = (session) => {
  renamingSession.value = session
  renameInputValue.value = getSessionTitle(session)
  showRenameModal.value = true
}

export const handleRenameConfirm = async () => {
  const title = renameInputValue.value?.trim()
  if (!title) { Message.warning('请输入会话名称'); return }
  if (!renamingSession.value) return
  renameSaving.value = true
  try {
    const sessionId = renamingSession.value.id || renamingSession.value.sessionId || renamingSession.value.key
    const result = await window.electronAPI?.dbRenameSession(sessionId, title)
    if (result?.success) {
      dbSessionTitles[sessionId] = title
      Message.success('重命名成功')
      showRenameModal.value = false
    } else { Message.error('重命名失败: ' + (result?.error || '未知错误')) }
  } catch (e) { Message.error('重命名失败: ' + (e.message || '未知错误')) }
  finally { renameSaving.value = false }
}

export const handleRenameCancel = () => {
  showRenameModal.value = false
  renamingSession.value = null
  renameInputValue.value = ''
}

export const handleSessionMenuAction = (value, session) => {
  if (value === 'rename') startRename(session)
  else if (value === 'pin') handlePinSession(session)
  else if (value === 'unpin') handleUnpinSession(session)
  else if (value === 'delete') deleteSessionFn(session.id)
}

export const deleteSessionFn = async (sessionId) => {
  const session = sessions.value.find(s => s.id === sessionId)
  const sessionTitle = session ? getSessionTitle(session) : '此会话'
  Modal.confirm({
    title: '确认删除', content: `确定要删除会话"${sessionTitle}"吗？删除后无法恢复。`,
    okText: '删除', cancelText: '取消', okType: 'primary', okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        if (wsManager && wsConnected.value && session?.key) { await wsManager.request('sessions.delete', { key: session.key }) }
        const index = sessions.value.findIndex(s => s.id === sessionId)
        if (index !== -1) sessions.value.splice(index, 1)
        if (sessionId === currentSessionId.value) {
          if (sessions.value.length > 0) { currentSessionId.value = sessions.value[0]?.id || ''; switchSessionFn(currentSessionId.value) }
          else { currentSessionId.value = ''; messages.value = [] }
        }
        const sid = session.id || session.sessionId || session.key
        if (sid) { window.electronAPI?.dbDeleteSessionTitle(sid); delete dbSessionTitles[sid] }
        Message.success('会话已删除')
      } catch (error) { Message.error('删除会话失败: ' + (error.message || '未知错误')) }
    }
  })
}

// ==================== 子智能体 ====================
export const getSubagentDisplayName = (agentId, role, sessionData) => {
  const agent = agentList.value.find(a => a.id === agentId)
  if (agent) { const name = agent.identity?.name || agent.name || agentId; return `${name}[${role}]` }
  return `${agentId}[${role}]`
}

export const fetchChildSessions = async () => {
  const session = currentSession.value
  if (!session?.key) { childSessions.value = []; return }
  const childKeys = session.childSessions || []
  if (childKeys.length > 0) {
    const parsed = childKeys.map(key => {
      const parts = key.split(':')
      return { key, agentId: parts[1] || '', role: parts[3] || '' }
    })
    childSessions.value = parsed.map(sub => ({
      key: sub.key, agentId: sub.agentId, role: sub.role,
      displayName: getSubagentDisplayName(sub.agentId, sub.role, null),
    }))
  } else { childSessions.value = [] }
}

export const selectSubagent = async (subagentKey) => {
  selectedSubagentKey.value = subagentKey
  if (!subagentKey) await _loadChatHistory(currentSession.value.key)
  else await _loadChatHistory(subagentKey)
}

// ==================== 子任务 ====================
export const addSubTask = (taskInfo) => {
  if (!taskInfo || !taskInfo.sessionKey || !taskInfo.id) return
  const existing = sessionTasks.value.find(t => t && t.sessionKey === taskInfo.sessionKey)
  if (existing) existing.status = taskInfo.status
  else sessionTasks.value.push(taskInfo)
}

export const getGroupSubTasks = (group) => {
  if (!group || !group.item || !group.item.time || sessionTasks.value.length === 0) return []
  const groupTime = new Date(group.item.time).getTime()
  return sessionTasks.value.filter(t => {
    if (!t || !t.timestamp) return false
    return Math.abs(t.timestamp - groupTime) < 60000
  })
}

export const getTaskAgentName = (agentId) => {
  const nameMap = { frontdevelop: '向前', backdevelop: '笨笨', main: '小张', coo: '小美', ceo: '史蒂夫', cio: 'CIO' }
  return nameMap[agentId] || agentId
}

export const parseInternalTaskMessage = (text) => {
  const sessionKeyMatch = text.match(/sessionKey:\s*(.+)/) || text.match(/session_key:\s*(.+)/)
  const sessionKey = sessionKeyMatch ? sessionKeyMatch[1].trim() : ''
  const taskMatch = text.match(/task:\s*(.+)/)
  const taskDesc = taskMatch ? taskMatch[1].trim() : '未知任务'
  let title = taskDesc.split('\n')[0].replace(/^\/think\s+(high|medium|low)\s+/i, '').substring(0, 60)
  const statusMatch = text.match(/status:\s*(.+)/)
  const status = statusMatch ? statusMatch[1].trim() : 'unknown'
  const agentMatch = sessionKey.match(/agent:([^:]+):subagent:/) || sessionKey.match(/agent:([^:]+):/)
  const agentId = agentMatch ? agentMatch[1] : ''
  if (!sessionKey || !title || title === '未知任务') return null
  return { id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, sessionKey, agentId, title, status: status.includes('completed') ? 'done' : 'pending', timestamp: Date.now() }
}

// ==================== 会话/消息管理函数 ====================

export const loadAllDbSessions = async () => {
  try {
    const result = await window.electronAPI?.dbGetAllSessions()
    if (!result?.success || !result.data) return
    Object.keys(dbSessionTitles).forEach(k => delete dbSessionTitles[k])
    Object.keys(sessionRankMap).forEach(k => delete sessionRankMap[k])
    Object.entries(result.data).forEach(([sessionId, item]) => {
      if (item.title) dbSessionTitles[sessionId] = item.title
      if (item.rank > 0) sessionRankMap[sessionId] = item.rank
    })
    sessions.value.forEach(session => {
      const entry = result.data[session.id] || result.data[session.sessionId] || result.data[session.key]
      if (entry) { if (entry.title) session.title = entry.title; if (entry.rank > 0) sessionRankMap[session.id] = entry.rank }
    })
  } catch (e) { console.error('[DB] 加载会话数据失败:', e) }
}

export const loadSessions = async () => {
  if (wsManager.state.value !== ConnectionState.CONNECTED) return
  try {
    const result = await wsManager.listSessions()
    const filtered = (result?.sessions || []).filter(s => !s.subagentRole && !s.key?.includes(':subagent:'))
    if (filtered.length > 0) {
      sessions.value = filtered.map(s => {
        let agentId = 'main', channel = ''
        if (s.key) { const parts = s.key.split(':'); if (parts.length >= 2) agentId = parts[1]; if (parts.length >= 4) channel = parts[3] || '' }
        const agent = agentList.value.find(a => a.id === agentId)
        let agentName = '助手'
        if (agent) agentName = agent.identity?.name || agent.name || agent.id
        const updatedAt = s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString()
        return {
          id: s.sessionId || s.key, title: s.lastMessagePreview ? s.lastMessagePreview.substring(0, 20) + '...' : '会话',
          key: s.key, sessionId: s.sessionId, agentId, agentName, channel,
          model: typeof s.model === 'object' && s.model?.primary ? s.model.primary
            : (typeof s.model === 'string' && s.model.startsWith('{') ? (() => { try { const p = JSON.parse(s.model); return p?.primary || s.model } catch(e) { return s.model } })() : (s.model || '')),
          childSessions: s.childSessions || [], lastMessage: s.lastMessagePreview || '',
          lastUserMessage: '', lastAgentTime: s.updatedAt ? formatMessageTime(s.updatedAt) : '',
          createdAt: updatedAt, updatedAt,
        }
      })
    } else { sessions.value = [] }
  } catch (error) {
    sessions.value = []
  }
  await loadAllDbSessions()
}

export const loadDbSessionTitles = async () => {
  try {
    const result = await window.electronAPI?.dbGetSessionTitles()
    if (result?.success && result.titles) {
      Object.keys(dbSessionTitles).forEach(k => delete dbSessionTitles[k])
      Object.assign(dbSessionTitles, result.titles)
    }
  } catch (e) { console.error('[DB] 加载会话标题失败:', e.message) }
}

export const loadAgentList = async () => {
  if (wsManager.state.value !== ConnectionState.CONNECTED) return
  try {
    const result = await wsManager.listAgents()
    if (result?.agents) agentList.value = result.agents
  } catch (error) {
    // 忽略
  }
}

export const autoCreateSession = async (agentId) => {
  if (!agentId) return
  // 自动建会话前先确保模型列表就绪；如果首次拉取失败过这里会自动重试
  await getModelStore().ensureLoaded()
  const agent = agentList.value.find(a => a.id === agentId)
  const agentName = agent ? (agent.identity?.name || agent.name || agent.id) : '助手'
  const sessionKey = `agent:${agentId}:main`
  const uniqueId = sessionKey + ':' + Date.now()

  // 解析默认模型：优先使用 getAgentDefaultModelId（已经处理 agent.defaultModel / agent.model / 模型列表首项 / 兜底）
  // getAgentDefaultModelId 返回的是纯 modelId，需进一步解析为 provider/modelId 格式供 ModelSelector 显示
  let rawModelId = getAgentDefaultModelId(agent)
  if (!rawModelId) rawModelId = 'deepseek-v4-pro'
  const store = getModelStore()
  let matchedModel = store.getModelById(rawModelId)
  // 兜底：纯 id 匹配不到时取模型列表第一项
  if (!matchedModel && store.models.length > 0) matchedModel = store.models[0]
  // 格式化为 provider/modelId（ModelSelector 内部以此作为 modelValue 协议格式）
  const defaultModel = matchedModel ? `${matchedModel.provider}/${matchedModel.id}` : rawModelId

  const newSession = {
    id: uniqueId, title: `与${agentName}的会话`, key: uniqueId, sessionId: uniqueId,
    agentId, agentName, channel: '', model: defaultModel,
    lastMessage: '', lastUserMessage: '', lastAgentTime: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isNew: true,
  }
  sessions.value.unshift(newSession)
  currentSessionId.value = uniqueId
  messages.value = []; streamingResponse.value = ''; isThinking.value = false; isStreaming.value = false
  inputText.value = ''; hasMoreHistory.value = false; selectedNewSessionAgent.value = agentId
  sessionStats.value = { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalThinkingCount: 0, totalToolCallCount: 0, totalToolSuccessCount: 0, totalToolErrorCount: 0, totalRuns: 0 }
  showSessionStats.value = false
  if (defaultModel) selectedModel.value = defaultModel
}

export const openCreateSessionModal = async () => {
  const mainAgent = agentList.value.find(a => a.id === 'main')
  if (mainAgent) await autoCreateSession('main')
  else if (agentList.value.length > 0) await autoCreateSession(agentList.value[0].id)
  else { Message.warning('暂无智能体'); return }
  selectedNewSessionAgent.value = 'main'
}

export const switchSessionFn = (sessionId) => {
  if (!sessionId) return
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return
  const oldSessionId = currentSessionId.value
  // 实时回复（尚未收到 final）期间切换会话：把当前累积的 messages 深拷贝暂存，
  // 切回来时与 server 历史合并恢复（避免"之前的回复内容丢失"）。
  if (oldSessionId && oldSessionId !== sessionId && (isStreaming.value || isThinking.value) && messages.value.length > 0) {
    sessionDraftMap[oldSessionId] = JSON.parse(JSON.stringify(messages.value))
  }
  // 切换会话时确保模型列表是最新的；如果首次加载失败过这里会自动重试
  getModelStore().ensureLoaded()
  sending.value = false
  currentSessionId.value = sessionId
  clearUnread(sessionId)
  sessionTasks.value.splice(0, sessionTasks.value.length)
  sessionStats.value = { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalThinkingCount: 0, totalToolCallCount: 0, totalToolSuccessCount: 0, totalToolErrorCount: 0, totalRuns: 0 }
  showSessionStats.value = false
  if (session.model) selectedModel.value = session.model
  else if (getModelStore().models.length > 0 && !selectedModel.value) selectedModel.value = getModelStore().models[0].id
  messages.value = []
  nextTick(() => scrollToBottom())
  streamingResponse.value = ''; isThinking.value = false; isStreaming.value = false
  inputText.value = ''; hasMoreHistory.value = true; historyLimit.value = 50
  if (session.isNew) return
  if (session.id) loadSessionMessages(session.id)
  fetchChildSessions()
}

export const updateSessionLastMessage = (message) => {
  const session = sessions.value.find(s => s.id === currentSessionId.value)
  if (session) {
    if (message.role === 'user') {
      const text = typeof message.content === 'string' ? message.content : extractTextFromContent(message.content)
      session.lastUserMessage = text.substring(0, 30) + (text.length > 30 ? '...' : '')
    }
    session.updatedAt = new Date().toISOString()
  }
}

export const toggleVerbose = () => { verboseEnabled.value = !verboseEnabled.value }
export const toggleReasoningVisible = () => { reasoningVisibleEnabled.value = !reasoningVisibleEnabled.value }

export const handleOpenWorkspace = async () => {
  if (!currentSession.value?.id) {
    Message.warning('请先创建或选择一个会话')
    return
  }
  try {
    const result = await window.electronAPI?.showOpenDialog({ title: '选择工作区文件夹' })
    if (!result || result.canceled || !result.filePaths?.length) return
    const folderPath = result.filePaths[0]
    const baseKey = currentSession.value.key ? currentSession.value.key.split(':').slice(0, 3).join(':') : currentSession.value.id
    await window.electronAPI?.dbSetSessionProjectSpace(baseKey, folderPath)
    currentSession.value.projectSpace = folderPath
    workspaceInstructionPending.value = true
    Message.success(`工作区已设为：${folderPath}`)
  } catch (e) {
    console.error('[workspace] 设置工作区失败:', e)
    Message.error('设置工作区失败')
  }
}

export const handleCompactSession = () => {
  if (!currentSession.value?.key) { Message.warning('请先选择一个会话'); return }
  wsManager.sendChat('/compact', currentSession.value.key)
  Message.info('已发送会话压缩指令')
}

export const copyMessageContent = async (content) => {
  try { await navigator.clipboard.writeText(content); Message.success('已复制到剪贴板') }
  catch (err) { Message.error('复制失败') }
}

export const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value
    if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  })
}

export const scrollToTop = () => {
  if (messageListRef.value) messageListRef.value.scrollTo({ top: 0, behavior: 'smooth' })
}

export const handleScroll = (e) => {
  const el = e.target
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  if (el.scrollTop < 50 && hasMoreHistory.value && !isLoadingMessages.value) loadMoreHistory()
}

export const handleNewLine = (e) => {
  e.preventDefault()
  const textarea = e.target
  const start = textarea.selectionStart, end = textarea.selectionEnd
  inputText.value = inputText.value.substring(0, start) + '\n' + inputText.value.substring(end)
  setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + 1 }, 0)
}

export const handleSlashCommand = (text) => {
  const match = text.match(/^\/model\s+(.+)$/i)
  if (match) {
    const modelName = match[1].trim()
    const model = getModelStore().models.find(m => m.name.toLowerCase() === modelName.toLowerCase() || m.id.toLowerCase() === modelName.toLowerCase())
    if (model) { selectedModel.value = model.id; Message.success(`已切换到模型: ${model.name}`); return true }
    else { Message.warning(`未找到模型: ${modelName}`); return true }
  }
  return false
}

export const handleSendMessage = async () => {
  const text = inputText.value?.trim() || ''
  if (!text) { Message.warning('请输入消息'); return }
  if (handleSlashCommand(text)) { inputText.value = ''; return }
  if (!selectedModel.value) { Message.warning('请先选择模型'); return }
  if (!wsConnected.value) { Message.warning('未连接到 Gateway，请检查连接状态'); return }
  if (!currentSessionId.value) { Message.warning('请先创建会话'); return }
  await nextTick()
  const sessionKey = currentSession.value?.key
  if (!sessionKey) { Message.error('会话不存在，请重新创建'); return }
  streamingResponse.value = ''; showStreamingTools.value = false
  isThinking.value = true; isStreaming.value = true
  scrollToBottom()
  const userMessage = { id: `user_${Date.now()}`, role: 'user', content: text, time: formatMessageTime(Date.now()) }
  messages.value.push(userMessage)
  updateSessionLastMessage(userMessage)
  scrollToBottom()
  if (verboseEnabled.value || reasoningVisibleEnabled.value) {
    const updates = {}
    if (verboseEnabled.value) updates.verboseLevel = 'full'
    if (reasoningVisibleEnabled.value) updates.reasoningLevel = 'stream'
    wsManager.updateSession(sessionKey, updates)
  }
  wsManager.sendChat(text, sessionKey)
  sending.value = true; inputText.value = ''
}

export const clearMessages = () => {
  messages.value = [{ id: `clear_${Date.now()}`, role: 'assistant', content: '你好！我是' + (currentAgentName.value || '助手') + '，有什么可以帮助你的吗？', stopReason: 'stop', time: formatMessageTime(Date.now()) }]
  streamingResponse.value = ''; isThinking.value = false; isStreaming.value = false
  sessionStats.value = { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalThinkingCount: 0, totalToolCallCount: 0, totalToolSuccessCount: 0, totalToolErrorCount: 0, totalRuns: 0 }
  showSessionStats.value = false
  Message.success('消息已清空'); scrollToBottom()
}

export const downloadFile = (message) => { Message.info('下载文件: ' + message.fileName) }

export const pushMessage = (msg) => {
  if (isLoadingHistory.value) pendingMessages.value.push(msg)
  else messages.value.push(msg)
}

// ==================== 内部函数(非导出) ====================
const _loadChatHistory = async (sessionKey) => {
  if (!sessionKey || !wsManager) { isLoadingMessages.value = false; return }
  isLoadingHistory.value = true
  let savedPendingMessages = []
  try {
    const history = await wsManager.getChatHistory(sessionKey, 50)
    savedPendingMessages = pendingMessages.value.splice(0)
    messages.value = []; hasMoreHistory.value = true; historyLimit.value = 50
    if (history?.messages) {
      const session = sessions.value.find(s => s.key === sessionKey)
      if (session && history.messages.length > 0) {
        for (let i = history.messages.length - 1; i >= 0; i--) {
          const msg = history.messages[i]
          if (msg.role === 'user') { session.lastUserMessage = extractTextFromContent(msg.content).substring(0, 30); break }
        }
        for (let i = history.messages.length - 1; i >= 0; i--) {
          const msg = history.messages[i]
          if (msg.role === 'assistant' && msg.stopReason === 'stop') {
            session.lastAgentTime = formatMessageTime(msg.timestamp); break
          }
        }
      }
      for (const msg of history.messages) {
        const time = formatMessageTime(msg.timestamp)
        if (msg.role === 'user') {
          const text = extractTextFromContent(msg.content)
          if (text?.includes('<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>')) {
            const taskInfo = parseInternalTaskMessage(text)
            if (taskInfo) addSubTask(taskInfo)
            continue
          }
          messages.value.push({ id: `history_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, role: 'user', content: msg.content || [], time })
        } else if (msg.role === 'assistant') {
          if (msg.stopReason === 'stop') {
            const { thinkingItems, toolCallItems } = parseAssistantContent(msg.content || [])
            const thinkingText = thinkingItems.map(t => t.content).join('\n') || null
            if (thinkingText) {
              messages.value.push({ id: `history_thinking_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, role: 'assistant', stopReason: 'thinking', thinkingBuffer: thinkingText, thinkingText, thinkingDone: true, thinkingDuration: 0, time })
            }
            for (const toolCall of toolCallItems) {
              messages.value.push({ id: `history_toolcall_${toolCall.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, role: 'assistant', stopReason: 'toolUse', toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments, thinkingSummary: thinkingText ? thinkingText.substring(0, 50) : `调用 ${toolCall.name}`, thinkingText, hasResult: false, isError: false, time })
            }
            // 只 push 一次完整的 stop 消息（content 已包含 text+toolCall），不要额外 push text-only stop
            messages.value.push({ id: `history_assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, role: 'assistant', content: msg.content || [], stopReason: 'stop', time })
          } else if (msg.stopReason === 'toolUse') {
            const { thinkingItems, toolCallItems } = parseAssistantContent(msg.content || [])
            const thinkingSummary = thinkingItems.map(t => t.content).join(' ').substring(0, 50)
            // 注意：toolUse 消息中的 text 内容会与同 run 的 stop 消息合并，
            // 不需要额外 push 独立的 text-only stop（避免重复显示）
            for (const toolCall of toolCallItems) {
              messages.value.push({ id: `history_toolcall_${toolCall.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, role: 'assistant', stopReason: 'toolUse', toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments, thinkingSummary: thinkingSummary || `调用 ${toolCall.name}`, hasResult: false, isError: false, time })
            }
          }
        } else if (msg.role === 'toolResult') {
          const toolCallId = msg.toolCallId
          const isError = msg.isError || false
          const toolCallEntry = messages.value.find(m => m.role === 'assistant' && m.stopReason === 'toolUse' && m.toolCallId === toolCallId)
          if (toolCallEntry) {
            toolCallEntry.isError = isError; toolCallEntry.resultSummary = isError ? '执行失败' : '执行成功'; toolCallEntry.hasResult = true
            if (msg.content) {
              const text = typeof msg.content === 'string' ? msg.content : extractTextFromContent(msg.content)
              toolCallEntry.result = text; toolCallEntry.resultContent = text
            }
          } else {
            messages.value.push({ id: `history_toolresult_${toolCallId}_${Date.now()}`, role: 'toolResult', toolCallId, toolName: msg.toolName || 'unknown', isError, time })
          }
        }
      }
    }
  } catch (error) { console.error('加载聊天记录失败:', error) }
  finally {
    if (savedPendingMessages?.length > 0) messages.value.push(...savedPendingMessages)

    // 合并切走时暂存的 draft（实时回复期间切换会话，未完成 run 的累积内容）
    // 合并策略：跳过 messages 中已存在的同 content 的 user 消息；thinkingMsg/toolUse/stop 直接追加。
    const draft = sessionDraftMap[sessionKey]
    if (draft && Array.isArray(draft) && draft.length > 0) {
      const existingUserKeys = new Set()
      for (const m of messages.value) {
        if (m.role === 'user') {
          const text = typeof m.content === 'string' ? m.content : extractTextFromContent(m.content || [])
          existingUserKeys.add(text)
        }
      }
      for (const m of draft) {
        if (m.role === 'user') {
          const text = typeof m.content === 'string' ? m.content : extractTextFromContent(m.content || [])
          if (existingUserKeys.has(text)) continue
          existingUserKeys.add(text)
        }
        messages.value.push(m)
      }
      delete sessionDraftMap[sessionKey]
    }

    isLoadingMessages.value = false
    sessionStats.value = computeSessionStatsFromMessages()
    isLoadingHistory.value = false

    // 检测会话是否仍在运行：最后一条 assistant 消息是 toolUse 或 thinking（无 stop），
    // 这种情况下设置 isThinking=true，UI 显示"等待中"，等待 WebSocket 推送新事件。
    const lastMsg = messages.value[messages.value.length - 1]
    const isLastIncomplete = lastMsg && lastMsg.role === 'assistant' && (lastMsg.stopReason === 'toolUse' || lastMsg.stopReason === 'thinking')
    if (isLastIncomplete && !currentRunId.value) {
      // 检查所有 toolCall 是否都有对应的 toolResult
      let allCompleted = true
      for (const m of messages.value) {
        if (m.role === 'assistant' && m.stopReason === 'toolUse' && !m.hasResult) {
          allCompleted = false
          break
        }
      }
      if (!allCompleted || lastMsg.stopReason === 'thinking') {
        isThinking.value = true
        isStreaming.value = true
      }
    }

    scrollToBottom()
  }
}

export const loadSessionMessages = (sessionId) => {
  isLoadingMessages.value = true; messages.value = []; streamingResponse.value = ''; inputText.value = ''
  const session = sessions.value.find(s => s.id === sessionId)
  if (session?.key) _loadChatHistory(session.key)
  else isLoadingMessages.value = false
}

export const loadMoreHistory = async () => {
  if (isLoadingMessages.value || !hasMoreHistory.value || !currentSession.value?.key) return
  const sessionKey = currentSession.value.key
  historyLimit.value += 50
  isLoadingMessages.value = true
  try {
    const history = await wsManager.getChatHistory(sessionKey, historyLimit.value)
    if (history?.messages?.length > 0) {
      messages.value = []; sessionTasks.value.splice(0, sessionTasks.value.length)
      for (const msg of history.messages) {
        const time = formatMessageTime(msg.timestamp)
        if (msg.role === 'user') {
          const text = extractTextFromContent(msg.content)
          if (text?.includes('<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>')) { const taskInfo = parseInternalTaskMessage(text); if (taskInfo) addSubTask(taskInfo); continue }
          messages.value.push({ id: `history_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, role: 'user', content: msg.content || [], time })
        } else if (msg.role === 'assistant') {
          if (msg.stopReason === 'stop') {
            // 与 _loadChatHistory 一致：拆 stop.content 中的 thinking/toolCall 块到独立消息，
            // 以便 groupedMessages 在 stop 上合并显示工具栏。
            const { thinkingItems, toolCallItems } = parseAssistantContent(msg.content || [])
            const thinkingText = thinkingItems.map(t => t.content).join('\n') || null
            if (thinkingText) {
              messages.value.push({ id: `history_thinking_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, role: 'assistant', stopReason: 'thinking', thinkingBuffer: thinkingText, thinkingText, thinkingDone: true, thinkingDuration: 0, time })
            }
            for (const toolCall of toolCallItems) {
              const thinkingSummary = thinkingText ? thinkingText.substring(0, 50) : `调用 ${toolCall.name}`
              messages.value.push({ id: `history_toolcall_${toolCall.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, role: 'assistant', stopReason: 'toolUse', toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments, thinkingSummary, thinkingText, hasResult: false, isError: false, time })
            }
            messages.value.push({ id: `history_assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, role: 'assistant', content: msg.content || [], stopReason: 'stop', time })
          } else if (msg.stopReason === 'toolUse') {
            const { thinkingItems, toolCallItems } = parseAssistantContent(msg.content || [])
            const thinkingSummary = thinkingItems.map(t => t.content).join(' ').substring(0, 50)
            const thinkingText = thinkingItems.map(t => t.content).join('\n') || null
            // 注意：toolUse 消息中的 text 内容会与同 run 的 stop 消息合并，
            // 不需要额外 push 独立的 text-only stop（避免重复显示）
            for (const toolCall of toolCallItems) {
              messages.value.push({ id: `history_toolcall_${toolCall.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, role: 'assistant', stopReason: 'toolUse', toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments, thinkingSummary: thinkingSummary || `调用 ${toolCall.name}`, thinkingText, hasResult: false, isError: false, time })
            }
          }
        } else if (msg.role === 'toolResult') {
          const toolCallId = msg.toolCallId; const isError = msg.isError || false
          const toolCallEntry = messages.value.find(m => m.role === 'assistant' && m.stopReason === 'toolUse' && m.toolCallId === toolCallId)
          if (toolCallEntry) { toolCallEntry.isError = isError; toolCallEntry.hasResult = true; if (msg.content) { const text = typeof msg.content === 'string' ? msg.content : extractTextFromContent(msg.content); toolCallEntry.result = text; toolCallEntry.resultContent = text } }
        }
      }
      if (history.messages.length < historyLimit.value) hasMoreHistory.value = false
    } else { hasMoreHistory.value = false }
  } catch (error) {
    console.error('加载更多历史消息失败:', error)
    Message.error('加载历史消息失败')
    historyLimit.value = Math.max(50, historyLimit.value - 50)
  } finally {
    isLoadingMessages.value = false
    sessionStats.value = computeSessionStatsFromMessages()
  }
}

export const computeSessionStatsFromMessages = () => {
  const stats = { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalThinkingCount: 0, totalToolCallCount: 0, totalToolSuccessCount: 0, totalToolErrorCount: 0, totalRuns: 0 }
  for (const msg of messages.value) {
    if (msg.stopReason === 'stop') {
      stats.totalRuns++
      if (msg.runStats) {
        stats.totalInputTokens += msg.runStats.tokenInput || 0; stats.totalOutputTokens += msg.runStats.tokenOutput || 0
        stats.totalTokens += msg.runStats.tokenTotal || 0; stats.totalThinkingCount += msg.runStats.thinkingCount || 0
        stats.totalToolCallCount += msg.runStats.toolCallCount || 0
        stats.totalToolSuccessCount += msg.runStats.toolSuccessCount || 0; stats.totalToolErrorCount += msg.runStats.toolErrorCount || 0
      }
    }
    if (msg.stopReason === 'thinking') stats.totalThinkingCount++
    if (msg.stopReason === 'toolUse') { stats.totalToolCallCount++; if (msg.isError) stats.totalToolErrorCount++; else if (msg.hasResult) stats.totalToolSuccessCount++ }
  }
  return stats
}

// ==================== expand/collapse helpers ====================
export const expandGroup = (gIdx) => {
  const group = groupedSessions.value[gIdx]
  if (group) groupShowLimit[gIdx] = Math.max(group.sessions.length, (groupShowLimit[gIdx] ?? 5) + 5)
}

export const collapseGroup = (gIdx) => { groupShowLimit[gIdx] = 5 }

export const reconnectAPI = async () => {}

// ==================== 初始化 ====================
let _modelChanging = false

export function useSessionView() {
  // 注意：watch 注册由调用方（Index.vue）负责，避免重复触发
  // 这里只导出状态/方法

  return {
    hoveredSessionId, dropdownOpenSessionId, showRenameModal, renamingSession, renameInputValue, renameSaving,
    agentList, unreadCount, sessions, currentSessionId, childSessions, selectedSubagentKey, selectedNewSessionAgent,
    messages, hasMoreHistory, historyLimit, currentThinkingMsgId, showStreamingThinking, sessionTasks, showStreamingTools,
    showRightPanel, showResultDrawer, currentResultTitle, currentResultTool, currentResultStatus, currentResultStatusText,
    currentResultThinking, currentResultArgs, currentResultHtml,
    selectedModel, modelSelectorRef, selectedThinkingLevel, STORAGE_KEY_REASONING,
    workspaceInstructionPending,
    inputText, streamingResponse, isStreaming, isThinking, isStreamingError, isLoadingMessages, isLoadingHistory,
    pendingMessages, sending, messageListRef, inputTextareaRef,
    verboseEnabled, reasoningVisibleEnabled, isAtBottom,
    currentRunId, currentRunStats, sessionStats, showSessionStats, activeToolKeys,
    dbSessionTitles, agentUnreadMap, sessionUnreadMap, sessionRankMap, groupShowLimit,
    toolExpandedMap, thinkingExpandedMap,
    currentAgentName, sessionHasMessages, currentSession, currentSessionModel, currentSessionModelName,
    filteredSessions, sortedSessions, groupedSessions,
    streamingToolItems, streamingThinkingCount, latestThinkingMsg, parsedStreamingContent, throttledStreamingHtml,
    selectedModelName, thinkingLevelOptions, showThinkingLevelSelect,
    workspaceLabel, workspaceIsSet,
    wsConnected, groupedMessages,
    findAgentIdBySessionKey, clearUnread, getAgentName, getAgentInitial, getAgentColor,
    getAgentDefaultModel, getAgentDefaultModelId, getSessionAgentColor, getSessionAgentInitial,
    selectNewSessionAgent: selectNewSessionAgentFn, fetchChildSessions, getSubagentDisplayName, selectSubagent,
    isSessionPinned, loadAllDbSessions, handlePinSession, handleUnpinSession, expandGroup, collapseGroup,
    needsMarquee, getSessionTitle, loadSessions, loadDbSessionTitles, loadAgentList, autoCreateSession,
    openCreateSessionModal, switchSession: switchSessionFn, handleSessionMenuAction, startRename,
    handleRenameConfirm, handleRenameCancel, deleteSession: deleteSessionFn,
    getTimeString, getModelName, extractModelId, onThinkingLevelChange,
    addSubTask, getGroupSubTasks, getTaskAgentName, parseInternalTaskMessage,
getToolIcon, getToolNameCN, getToolArgsSummary, getToolCmdDisplay, getTimelineDotClass, getTimelineCardClass,
    getTimelineIcon, handleTimelineClick, getMessageHtml, handleMessageClick, getThinkingHtml,
    loadChatHistory: _loadChatHistory, loadSessionMessages, updateSessionLastMessage,
    pushMessage, toggleVerbose, toggleReasoningVisible, handleOpenWorkspace, handleCompactSession,
    formatMessageTime, copyMessageContent, loadMoreHistory, handleScroll, scrollToBottom, scrollToTop,
    handleNewLine, handleSlashCommand, handleSendMessage, clearMessages, downloadFile,
    reconnectAPI, isToolExpanded, toggleToolSummary, isThinkingExpanded, toggleThinkingInline,
    hasGroupStats, formatTokens, getContextInfo, formatTokenCount, computeSessionStatsFromMessages,
  }
}
