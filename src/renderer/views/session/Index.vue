<template>
  <div class="session-view">
    <SessionList
      :sessions="sessions"
      :current-session-id="currentSessionId"
      :grouped-sessions="groupedSessions"
      :sorted-sessions="sortedSessions"
      :session-unread-map="sessionUnreadMap"
      :group-show-limit="groupShowLimit"
      :hovered-session-id="hoveredSessionId"
      :dropdown-open-session-id="dropdownOpenSessionId"
      :show-rename-modal="showRenameModal"
      :renaming-session="renamingSession"
      :rename-input-value="renameInputValue"
      :rename-saving="renameSaving"
      :is-current-streaming="isStreaming || isThinking"
      @select-session="switchSession"
      @create-session="openCreateSessionModal"
      @session-menu-action="handleSessionMenuAction"
      @expand-group="expandGroup"
      @collapse-group="collapseGroup"
      @rename-confirm="handleRenameConfirm"
      @rename-cancel="handleRenameCancel"
      @hover-change="(id) => (hoveredSessionId = id)"
      @dropdown-change="(id) => (dropdownOpenSessionId = id)"
      @update:showRenameModal="(v) => (showRenameModal = v)"
      @update:renameInputValue="(v) => (renameInputValue = v)"
    />

    <div class="chat-main">
      <div class="chat-content">
        <div class="chat-header">
          <div class="header-left">
            <h3 class="chat-title">{{ currentSession ? getSessionTitle(currentSession) : '新会话' }}</h3>
            <a-tag size="small" v-if="currentSessionModel">{{ currentSessionModelName || currentSessionModel }}</a-tag>
            <span class="message-count">{{ messages.length }} 条消息</span>
          </div>
        </div>

        <MessageHistory
          ref="messageHistoryRef"
          :messages="messages"
          :grouped-messages="groupedMessages"
          :is-loading-messages="isLoadingMessages"
          :is-loading-history="isLoadingHistory"
          :streaming-response="streamingResponse"
          :throttled-streaming-html="throttledStreamingHtml"
          :is-streaming="isStreaming"
          :is-thinking="isThinking"
          :is-streaming-error="isStreamingError"
          :current-agent-name="currentAgentName"
          :session-has-messages="sessionHasMessages"
          :reasoning-visible-enabled="reasoningVisibleEnabled"
          :latest-thinking-msg="latestThinkingMsg"
          :streaming-tool-items="streamingToolItems"
          :streaming-thinking-count="streamingThinkingCount"
          :streaming-content-items="streamingContentItems"
          :streaming-live-text="streamingLiveText"
          :show-streaming-thinking="showStreamingThinking"
          :show-streaming-tools="showStreamingTools"
          :is-at-bottom="isAtBottom"
          @load-more="loadMoreHistory"
          @scroll="handleScroll"
          @timeline-click="handleTimelineClick"
          @update:showStreamingThinking="(v) => (showStreamingThinking = v)"
          @update:showStreamingTools="(v) => (showStreamingTools = v)"
        />

        <div class="scroll-buttons">
          <div v-if="isAtBottom && messages.length > 0" class="scroll-btn" @click="scrollToTop" title="滚动到顶部">
            <icon-up />
          </div>
          <div v-if="!isAtBottom && messages.length > 0" class="scroll-btn" @click="scrollToBottom(true)" title="滚动到底部">
            <icon-down />
          </div>
        </div>

        <MessageInput
          :input-text="inputText"
          :selected-model="selectedModel"
          :selected-thinking-level="selectedThinkingLevel"
          :thinking-level-options="thinkingLevelOptions"
          :show-thinking-level-select="showThinkingLevelSelect"
          :selected-model-name="selectedModelName"
          :sending="sending"
          :verbose-enabled="verboseEnabled"
          :reasoning-visible-enabled="reasoningVisibleEnabled"
          :workspace-label="workspaceLabel"
          :workspace-is-set="workspaceIsSet"
          :current-session="currentSession"
          :current-agent-name="currentAgentName"
          :ws-connected="wsConnected"
          :agent-list="agentList"
          :selected-new-session-agent="selectedNewSessionAgent"
          :session-has-messages="sessionHasMessages"
          @update:inputText="(v) => (inputText = v)"
          @update:selectedModel="(v) => (selectedModel = v)"
          @send="handleSendMessage"
          @new-line="handleNewLine"
          @toggle-verbose="toggleVerbose"
          @toggle-reasoning="toggleReasoningVisible"
          @open-workspace="handleOpenWorkspace"
          @compact-session="handleCompactSession"
          @reconnect="reconnectAPI"
          @thinking-level-change="onThinkingLevelChange"
          @select-agent="selectNewSessionAgent"
        />
      </div>
    </div>

    <RightPanel
      :show-right-panel="showRightPanel"
      :child-sessions="childSessions"
      :selected-subagent-key="selectedSubagentKey"
      :session-tasks="sessionTasks"
      :current-session="currentSession"
      @toggle-panel="showRightPanel = !showRightPanel"
      @select-subagent="selectSubagent"
    />

    <ToolResultDrawer
      :show-result-drawer="showResultDrawer"
      :current-result-title="currentResultTitle"
      :current-result-tool="currentResultTool"
      :current-result-status="currentResultStatus"
      :current-result-status-text="currentResultStatusText"
      :current-result-thinking="currentResultThinking"
      :current-result-args="currentResultArgs"
      :current-result-html="currentResultHtml"
      @update:showResultDrawer="(v) => (showResultDrawer = v)"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick, provide } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { parseMessageContent, extractTextFromContent, getTextContentFromContent, parseAssistantContent } from '@/utils/messageParser'
import { wsManager, ConnectionState } from '@/core/websocket/manager'
import { useSessionView } from './useSessionView.js'

import SessionList from './components/SessionList.vue'
import MessageInput from './components/MessageInput.vue'
import RightPanel from './components/RightPanel.vue'
import MessageHistory from './components/MessageHistory.vue'
import ToolResultDrawer from './components/ToolResultDrawer.vue'

const messageHistoryRef = ref(null)

const {
  hoveredSessionId, dropdownOpenSessionId, showRenameModal, renamingSession, renameInputValue, renameSaving,
  agentList, sessions, currentSessionId, childSessions, selectedSubagentKey, selectedNewSessionAgent,
  messages, hasMoreHistory, historyLimit, currentThinkingMsgId, showStreamingThinking, sessionTasks, showStreamingTools,
  showRightPanel, showResultDrawer, currentResultTitle, currentResultTool, currentResultStatus, currentResultStatusText,
  currentResultThinking, currentResultArgs, currentResultHtml,
  selectedModel, selectedThinkingLevel, inputText, streamingResponse, isStreaming, isThinking, isStreamingError, isLoadingMessages, isLoadingHistory,
  pendingMessages, sending, messageListRef,
  verboseEnabled, reasoningVisibleEnabled, isAtBottom,
  currentRunId, currentRunStats, sessionStats,
  dbSessionTitles, agentUnreadMap, sessionUnreadMap, sessionRankMap, groupShowLimit,
  toolExpandedMap, thinkingExpandedMap,
  currentAgentName, sessionHasMessages, currentSession, currentSessionModel, currentSessionModelName,
  groupedSessions, sortedSessions,
  streamingToolItems, streamingThinkingCount, streamingContentItems, streamingLiveText, latestThinkingMsg, throttledStreamingHtml,
  selectedModelName, thinkingLevelOptions, showThinkingLevelSelect,
  workspaceLabel, workspaceIsSet, workspaceInstructionPending,
  wsConnected, groupedMessages,
  clearUnread, getAgentColor, getAgentInitial, getAgentDefaultModel,
  selectNewSessionAgent: selectNewSessionAgentFn, fetchChildSessions, selectSubagent,
  handlePinSession, handleUnpinSession, expandGroup, collapseGroup,
  getSessionTitle, loadSessions, loadAgentList, autoCreateSession,
  openCreateSessionModal, switchSession: switchSessionFn, handleSessionMenuAction, startRename,
  handleRenameConfirm, handleRenameCancel, deleteSession: deleteSessionFn,
  getModelName, extractModelId, onThinkingLevelChange,
  addSubTask, getGroupSubTasks, getTaskAgentName, parseInternalTaskMessage,
  getToolIcon, getToolNameCN, getToolArgsSummary, getToolCmdDisplay, getTimelineDotClass, getTimelineCardClass,
  getTimelineIcon, handleTimelineClick, getMessageHtml, handleMessageClick, getThinkingHtml,
  isToolExpanded, toggleToolSummary, isThinkingExpanded, toggleThinkingInline,
  hasGroupStats, formatTokens, getContextInfo, formatTokenCount, computeSessionStatsFromMessages,
  updateSessionLastMessage, pushMessage,
  toggleVerbose, toggleReasoningVisible, handleOpenWorkspace, handleCompactSession,
  formatMessageTime, copyMessageContent, loadMoreHistory, handleScroll, scrollToBottom, scrollToTop,
  handleNewLine, handleSlashCommand, handleSendMessage, clearMessages,
  reconnectAPI, getTimeString,
} = useSessionView()

provide('sessionActions', {
  getMessageHtml, handleMessageClick, getThinkingHtml,
  getToolIcon, getToolNameCN, getToolArgsSummary, getToolCmdDisplay,
  getTimelineDotClass, getTimelineCardClass, getTimelineIcon,
  isToolExpanded, toggleToolSummary,
  isThinkingExpanded, toggleThinkingInline,
  formatToolArgs: (a) => a, getContextInfo, formatTokens, formatTokenCount,
  hasGroupStats, getAgentColor, getAgentInitial, getAgentDefaultModel,
  getSessionAgentColor: (s) => getAgentColor(s?.agentId) || '#94A3B8',
  getSessionAgentInitial: (s) => s?.agentName?.charAt(0)?.toUpperCase() || '?',
  getSessionTitle, needsMarquee: (s) => { const t = getSessionTitle(s); return t && t.length > 15 },
  isSessionPinned: (id) => !!sessionRankMap[id],
  getSubagentDisplayName: (agentId, role) => `${agentId}[${role}]`,
  getGroupSubTasks, getTaskAgentName, handleNewLine,
  handleTimelineClick,
})

const modelList = computed(() => modelStore.models)

function selectNewSessionAgent(agent) {
  selectNewSessionAgentFn(agent)
}

function switchSession(sessionId) {
  currentThinkingBuffer = ''
  switchSessionFn(sessionId)
}

function deleteSession(sessionId) {
  deleteSessionFn(sessionId)
}

// ==================== handleWsMessage（保留在 Index.vue）====================
let _sessionMsgSeq = 0
let currentThinkingBuffer = ''
let currentThinkingToolName = ''
let currentThinkingToolCallId = ''
let previousRunId = null
let _wsUnsubscribe = null
let _modelChanging = false
const toolArgsCache = new Map()

const findAgentIdBySessionKey = (sessionKey) => {
  if (!sessionKey) return null
  const session = sessions.value.find(s => s.key === sessionKey)
  return session?.agentId || null
}

watch(selectedModel, async (newModel, oldModel) => {
  if (!newModel || _modelChanging || newModel === oldModel) return
  const session = currentSession.value
  if (!session?.key) {
    console.debug('[SessionView] 模型切换跳过：无当前会话')
    return
  }
  if (newModel === session.model) {
    console.debug('[SessionView] 模型切换跳过：与会话模型相同')
    return
  }
  session.model = newModel
  if (session.isNew) {
    console.debug('[SessionView] 模型本地已切换（新会话，Gateway 同步将在首条消息后生效）:', newModel)
    return
  }
  console.debug('[SessionView] 模型切换:', oldModel, '→', newModel, 'sessionKey:', session.key)
  try {
    _modelChanging = true
    const newModelName = getModelName(newModel)
    const result = await wsManager.request('sessions.patch', { key: session.key, model: newModel })
    console.debug('[SessionView] sessions.patch 成功:', result)
    Message.success(`已切换到模型: ${newModelName}`)
  } catch (error) {
    console.error('[SessionView] 模型切换失败:', error)
    Message.error(`模型切换失败: ${error.message || '未知错误'}`)
    _modelChanging = false
    selectedModel.value = oldModel
    session.model = oldModel
    return
  } finally {
    _modelChanging = false
  }
})

watch(selectedModel, (newModel, oldModel) => {
  if (newModel && newModel !== oldModel) {
    selectedThinkingLevel.value = ''
  }
})

// 监听 WebSocket 连接状态，连接成功后加载数据
// 🔧 修复: 一次性触发 + watch 立即 stop。WS 重连抖动不会重复加载。
let _initDataTriggered = false
const triggerInitialDataLoad = async () => {
  if (_initDataTriggered) return
  _initDataTriggered = true
  await Promise.all([loadAgentList(), loadSessions()])
  if (sessions.value.length > 0) switchSession(sessions.value[0].id)
  else if (agentList.value.length > 0) autoCreateSession(agentList.value[0].id)
}
if (wsConnected.value) {
  triggerInitialDataLoad()
} else {
  const stopWatchConn = watch(wsConnected, (connected) => {
    if (!connected) return
    stopWatchConn()
    triggerInitialDataLoad()
  })
}

const handleWsMessage = (data) => {
  _sessionMsgSeq++
  console.debug(`[Session] #${_sessionMsgSeq} id=${data.id || data.seq || '-'} type=${data.type} event=${data.event || '-'} stream=${data.payload?.stream || '-'}`)

  const msgRunId = data.payload?.runId
  if (msgRunId && previousRunId && msgRunId === previousRunId) {
    console.debug(`[WS] 旧 run 事件已忽略: ${msgRunId}`)
    return
  }

  const msgRole = data.role || data.payload?.role || data.payload?.message?.role
  if (msgRole === 'user') {
    const msgContent = data.payload?.message?.content
    let textContent = ''
    if (typeof msgContent === 'string') {
      textContent = msgContent
    } else if (Array.isArray(msgContent)) {
      const textItem = msgContent.find(c => c.type === 'text')
      if (textItem) textContent = textItem.text || ''
    }
    if (textContent && textContent.includes('<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>')) {
      const taskInfo = parseInternalTaskMessage(textContent)
      if (taskInfo) addSubTask(taskInfo)
      return
    }
  }

  if (data.type === 'res' && data.id?.startsWith('chat_')) {
    if (data.ok && data.payload?.runId) {
      currentRunId.value = data.payload.runId
      console.debug('收到任务确认，runId:', data.payload.runId)
    }
    return
  }

  if (data.type === 'event' && !currentSession.value?.isNew) {
    const currentKey = currentSession.value?.key
    if (currentKey) {
      const msgSessionKey = data.sessionKey || data.payload?.sessionKey || data.payload?.key || ''
      const dataId = data.id?.toString() || ''
      const matches = msgSessionKey.includes(currentKey)
                    || dataId.startsWith(currentKey)
                    || dataId === currentKey
      if (!matches) {
        console.debug(`[Session] event 消息不属于当前会话 (${currentKey})，忽略 id=${data.id}`)
        return
      }
    }
  }

  if (data.type === 'event') {
    const runId = data.payload?.runId
    const eventType = data.event
    const stream = data.payload?.stream

    if (eventType === 'agent' && stream === 'lifecycle') {
      const phase = data.payload?.data?.phase

      if (phase === 'start') {
        console.debug('任务开始:', runId)
        currentRunId.value = runId
        previousRunId = null
        currentThinkingBuffer = ''
        showStreamingThinking.value = true
        currentThinkingToolName = ''
        currentThinkingToolCallId = ''
        isStreaming.value = true
        isThinking.value = true
        isStreamingError.value = false

        // 关闭前面未完成的思考
        for (let i = messages.value.length - 1; i >= 0; i--) {
          const m = messages.value[i]
          if (m.role === 'assistant' && m.thinkingDone === false) {
            m.thinkingDone = true
            m.thinkingDuration = Math.max(1, Math.round((Date.now() - (m._startTime || Date.now())) / 1000))
            break
          }
        }

        currentRunStats.value = {
          thinkingCount: 0, toolCallCount: 0, toolSuccessCount: 0, toolErrorCount: 0,
          tokenInput: 0, tokenOutput: 0, tokenTotal: 0,
        }

        // 创建流式 assistant 消息（content 数组格式，与历史一致）
        currentThinkingMsgId.value = `streaming_${Date.now()}`
        const streamingMsg = {
          id: currentThinkingMsgId.value,
          role: 'assistant',
          content: [],
          stopReason: null,
          toolResults: {},
          thinkingDone: false,
          thinkingDuration: 0,
          _startTime: Date.now(),
          time: getTimeString(),
        }
        messages.value.push(streamingMsg)
      } else if (phase === 'end') {
        const usage = data.payload?.data?.usage || {}
        currentRunStats.value.tokenInput = usage.input || 0
        currentRunStats.value.tokenOutput = usage.output || 0
        currentRunStats.value.tokenTotal = usage.total || 0

        const cs = currentRunStats.value
        sessionStats.value.totalInputTokens += cs.tokenInput
        sessionStats.value.totalOutputTokens += cs.tokenOutput
        sessionStats.value.totalTokens += cs.tokenTotal
        sessionStats.value.totalThinkingCount += cs.thinkingCount
        sessionStats.value.totalToolCallCount += cs.toolCallCount
        sessionStats.value.totalToolSuccessCount += cs.toolSuccessCount
        sessionStats.value.totalToolErrorCount += cs.toolErrorCount
        sessionStats.value.totalRuns++

        const lastAssistantMsg = [...messages.value].reverse().find(
          m => m.role === 'assistant' && m.stopReason === 'stop'
        )
        if (lastAssistantMsg) {
          lastAssistantMsg.runStats = { ...cs }
        }

        currentRunStats.value = {
          thinkingCount: 0, toolCallCount: 0, toolSuccessCount: 0, toolErrorCount: 0,
          tokenInput: 0, tokenOutput: 0, tokenTotal: 0,
        }

        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            messages.value[idx].thinkingDone = true
            const startTime = messages.value[idx]._startTime || Date.now()
            messages.value[idx].thinkingDuration = Math.max(1, Math.round((Date.now() - startTime) / 1000))
          }
        }

        toolArgsCache.clear()

        isThinking.value = false
        isStreaming.value = false
        sending.value = false
      } else if (phase === 'error') {
        // 智能体在 lifecycle 阶段报告错误（如 token 限额 429/422、模型不可用等）
        // 此类事件 payload.state 字段通常不存在，必须根据 phase === 'error' 识别
        // 错误描述在 payload.data.error（字符串）
        console.error('[lifecycle:error]', data)
        const errMsg = data.payload?.data?.error || '智能体执行错误'

        // 关闭未完成的思考气泡
        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            messages.value[idx].thinkingDone = true
            const st = messages.value[idx]._startTime || Date.now()
            messages.value[idx].thinkingDuration = Math.max(1, Math.round((Date.now() - st) / 1000))
          }
        }

        // 清理流式状态
        isThinking.value = false
        isStreaming.value = false
        isStreamingError.value = true
        streamingResponse.value = errMsg
        sending.value = false
        toolArgsCache.clear()

        // 写入对话气泡
        pushMessage({
          id: `lifecycle_error_${Date.now()}`,
          role: 'assistant',
          content: [{ type: 'error', text: errMsg }],
          stopReason: 'error',
          time: formatMessageTime(Date.now()),
        })
      }
      return
    }

    if (eventType === 'agent' && stream === 'assistant') {
      const delta = data.payload?.data?.delta
                 || data.payload?.delta
                 || data.payload?.deltaText
                 || data.payload?.text
      if (delta) {
        currentThinkingBuffer += delta
        currentRunStats.value.thinkingCount++

        nextTick(() => scrollToBottom())
      }
      return
    }

    if (eventType === 'agent' && stream === 'item') {
      const phase = data.payload?.data?.phase
      const kind = data.payload?.data?.kind
      const itemId = data.payload?.data?.itemId || ''
      const toolName = data.payload?.data?.name || 'unknown'
      const toolCallId = data.payload?.data?.toolCallId
      const args = data.payload?.data?.meta
      const title = data.payload?.data?.title
      const msgRunId = runId

      if (itemId && itemId.startsWith('command:')) return

      if (phase === 'start') {
        currentThinkingToolName = toolName
        currentThinkingToolCallId = toolCallId
        const savedThinking = currentThinkingBuffer.trim()
        currentThinkingBuffer = ''
        currentRunStats.value.toolCallCount++

        let finalArgs = args
        if ((!finalArgs || (typeof finalArgs === 'object' && Object.keys(finalArgs).length === 0)) && toolCallId && toolArgsCache.has(toolCallId)) {
          finalArgs = toolArgsCache.get(toolCallId)
        }

        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            const msg = messages.value[idx]
            if (savedThinking) {
              msg.content.push({ type: 'text', text: savedThinking })
            }
            msg.content.push({ type: 'toolCall', id: toolCallId, name: toolName, arguments: finalArgs })
          }
        }

        nextTick(() => scrollToBottom())
      } else if (phase === 'update') {
        nextTick(() => scrollToBottom())
      } else if (phase === 'end') {
        const summary = data.payload?.data?.summary
        const endedAt = data.payload?.data?.endedAt

        if (currentThinkingMsgId.value && toolCallId) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            const existing = messages.value[idx].toolResults[toolCallId]
            if (existing) {
              if (summary && !existing.content) existing.content = summary
              if (endedAt) existing.endedAt = endedAt
            }
          }
        }

        nextTick(() => scrollToBottom())
      }
      return
    }

    if (eventType === 'agent' && stream === 'tool') {
      const phase = data.payload?.data?.phase
      const toolName = data.payload?.data?.name || 'unknown'
      const toolCallId = data.payload?.data?.toolCallId
      const args = data.payload?.data?.args
      const msgRunId = runId

      if (phase === 'start') {
        if (toolCallId && args) {
          toolArgsCache.set(toolCallId, args)
          const idx = currentThinkingMsgId.value
            ? messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
            : -1
          if (idx >= 0) {
            const content = messages.value[idx].content
            for (const ci of content) {
              if (ci.type === 'toolCall' && ci.id === toolCallId) {
                ci.arguments = args
                break
              }
            }
          }
        }
      } else if (phase === 'result') {
        const isError = data.payload?.data?.isError === true
        if (isError) currentRunStats.value.toolErrorCount++
        else currentRunStats.value.toolSuccessCount++
        const resultData = data.payload?.data?.result || data.result
        const resultStr = typeof resultData === 'string' ? resultData : JSON.stringify(resultData)

        // 更新流式消息的 toolResults
        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            messages.value[idx].toolResults[toolCallId] = {
              isError,
              content: resultStr,
              toolName
            }
          }
        }

        if (toolCallId) toolArgsCache.delete(toolCallId)

        nextTick(() => scrollToBottom())
      }
      return
    }

    if (eventType === 'agent' && stream === 'command_output') {
      return
    }

    if (eventType === 'chat') {
      const payload = data.payload || {}

      if (payload.state === 'delta') {
        isStreaming.value = true

        if (payload.replace && payload.deltaText) {
          const replaceLen = payload.deltaText.length
          if (replaceLen >= streamingResponse.value.length) {
            streamingResponse.value = payload.deltaText
          } else {
            streamingResponse.value =
              streamingResponse.value.substring(0, streamingResponse.value.length - replaceLen) + payload.deltaText
          }
          nextTick(() => scrollToBottom())
          return
        }

        if (payload.deltaText) {
          streamingResponse.value += payload.deltaText
          nextTick(() => scrollToBottom())
          return
        }

        const message = payload.message
        if (message && message.content) {
          const textContent = message.content.find(c => c.type === 'text')
          if (textContent && textContent.text) {
            streamingResponse.value += textContent.text
            nextTick(() => scrollToBottom())
          }
        }
      } else if (payload.state === 'final') {
        console.debug('聊天完成')
        isStreaming.value = false
        isThinking.value = false

        const message = payload.message
        // 将流式累积的消息更新为最终状态
        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            const streamingMsg = messages.value[idx]
            streamingMsg.stopReason = message?.stopReason || 'stop'
            streamingMsg.usage = message?.usage || streamingMsg.usage
            streamingMsg.thinkingDone = true
            if (message && message.content && message.content.length > 0) {
              if (currentThinkingBuffer.trim()) {
                streamingMsg.content.push({ type: 'text', text: currentThinkingBuffer.trim() })
                currentThinkingBuffer = ''
              }
            } else if (streamingResponse.value) {
              streamingMsg.content.push({ type: 'text', text: streamingResponse.value })
            }
          }
          currentThinkingMsgId.value = null
        } else if (message && message.content && message.content.length > 0) {
          pushMessage({
            id: `final_${Date.now()}`,
            role: 'assistant',
            content: message.content,
            stopReason: message.stopReason || 'stop',
            toolResults: {},
            thinkingDone: true,
            time: formatMessageTime(Date.now()),
          })
        }

        streamingResponse.value = ''
        isStreamingError.value = false
        sending.value = false

        if (currentSession.value?.isNew) {
          const realKey = data.sessionKey || data.payload?.sessionKey || ''
          if (realKey) {
            currentSession.value.key = realKey
            currentSession.value.isNew = false
            console.debug('[Session] 新会话 key 已同步为 Gateway 真实 key:', realKey)
          }
        }

        const msgSessionKey = data.sessionKey || data.payload?.sessionKey || data.payload?.key || data.id || ''
        if (currentSession.value?.key !== msgSessionKey && msgSessionKey) {
          const agentId = findAgentIdBySessionKey(msgSessionKey)
          if (agentId) agentUnreadMap[agentId] = (agentUnreadMap[agentId] || 0) + 1
          const targetSession = sessions.value.find(s => s.key === msgSessionKey)
          if (targetSession) {
            sessionUnreadMap[targetSession.id] = (sessionUnreadMap[targetSession.id] || 0) + 1
          }
        }

        nextTick(() => scrollToBottom())
      } else if (payload.state === 'aborted') {
        console.debug('聊天已中止')
        isStreaming.value = false
        isThinking.value = false
        isStreamingError.value = true
        streamingResponse.value = '对话已中止'
        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) messages.value[idx].thinkingDone = true
          currentThinkingMsgId.value = null
        }
        pushMessage({
          id: `aborted_${Date.now()}`,
          role: 'assistant',
          content: [{ type: 'error', text: '对话已中止' }],
          stopReason: 'error',
          time: formatMessageTime(Date.now()),
        })
        sending.value = false
      } else if (payload.state === 'error') {
        console.error('聊天错误:', payload.errorMessage)
        const errMsg = payload.errorMessage || '发生错误'
        Message.error(errMsg)
        isStreaming.value = false
        isThinking.value = false
        isStreamingError.value = true
        streamingResponse.value = errMsg
        if (currentThinkingMsgId.value) {
          const idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) messages.value[idx].thinkingDone = true
          currentThinkingMsgId.value = null
        }
        pushMessage({
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: [{ type: 'error', text: errMsg }],
          stopReason: 'error',
          time: formatMessageTime(Date.now()),
        })
        sending.value = false
      }
      return
    }

    return
  }

  if (data.type === 'res' && data.ok && data.payload?.type === 'hello-ok') {
    console.debug('WebSocket 握手成功')
    return
  }

  if (data.type === 'res' && !data.ok) {
    console.error('WebSocket 请求失败:', data.error)
    if (data.id && data.id.startsWith('chat_')) {
      sending.value = false
      isThinking.value = false
      isStreaming.value = false
    }
  }
}

const initSessionView = async () => {
  try {
    _wsUnsubscribe = wsManager.subscribe(handleWsMessage)
    console.debug('SessionView 订阅 WebSocket 消息')

    // 🔧 修复: 数据加载交给上面的 _initDataTriggered 一次性 watch 来做（已连接就直接拉，
    //    否则挂在 wsConnected 上,触发后立即 stop）。这里不再重复加载,避免并发拉两份
    //    loadAgentList / loadSessions。

    scrollToBottom()
  } catch (error) {
    console.error('初始化会话视图失败:', error)
    Message.error('连接 Gateway 失败: ' + error.message)
  }
}

onMounted(async () => {
  // 模型列表由 ModelSelector 内部 onMounted 通过 modelStore.ensureLoaded() 触发；
  // 这里不重复加载，避免多次 refreshModels 之间的竞态
  // 把 MessageHistory 暴露的 messageListRef 同步到 useSessionView 的全局 ref，
  // 保证外部 scrollToBottom() / scrollToTop() 能正确操作 DOM
  const syncMessageListRef = () => {
    if (messageHistoryRef.value && messageHistoryRef.value.messageListRef) {
      messageListRef.value = messageHistoryRef.value.messageListRef
    }
  }
  syncMessageListRef()
  await nextTick()
  syncMessageListRef()
  initSessionView()
})

onUnmounted(() => {
  if (_wsUnsubscribe) {
    _wsUnsubscribe()
    _wsUnsubscribe = null
  }
})
</script>

<style scoped lang="scss">
.session-view {
  height: 100%;
  display: flex;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  background-color: #FFF;
  min-width: 0;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.scroll-buttons {
  flex-shrink: 0;
  height: 0;
  overflow: visible;
  position: relative;
  z-index: 10;
  pointer-events: none;
}

.scroll-btn {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #E5E6EB;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-3);
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  backdrop-filter: blur(4px);
  transition: color 0.15s, box-shadow 0.15s;
}

.scroll-btn:hover {
  background: #fff;
  color: var(--color-text-2);
  border-color: #165DFF;
}

.chat-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.chat-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-count {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 智能体选择器已迁移至 MessageInput 组件内部（input-toolbar-inline 的 toolbar-left），
   此处不再保留 .agent-selector-horizontal 相关样式。 */

/* 响应式 */
@media (max-width: 768px) {
  .chat-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .header-right {
    align-self: flex-end;
  }
}
</style>