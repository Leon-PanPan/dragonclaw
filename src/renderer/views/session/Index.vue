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
          :show-streaming-thinking="showStreamingThinking"
          :show-streaming-tools="showStreamingTools"
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
          <div v-if="!isAtBottom && messages.length > 0" class="scroll-btn" @click="scrollToBottom" title="滚动到底部">
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
  streamingToolItems, streamingThinkingCount, latestThinkingMsg, throttledStreamingHtml,
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

        for (let i = messages.value.length - 1; i >= 0; i--) {
          const m = messages.value[i]
          if (m.stopReason === 'thinking' && !m.thinkingDone) {
            m.isCollapsed = true
            m.thinkingDone = true
            const st = m._startTime || Date.now()
            m.thinkingDuration = Math.max(1, Math.round((Date.now() - st) / 1000))
            break
          }
        }

        currentRunStats.value = {
          thinkingCount: 0, toolCallCount: 0, toolSuccessCount: 0, toolErrorCount: 0,
          tokenInput: 0, tokenOutput: 0, tokenTotal: 0,
        }

        currentThinkingMsgId.value = `thinking_${Date.now()}`
        const thinkingMsg = {
          id: currentThinkingMsgId.value,
          role: 'assistant',
          stopReason: 'thinking',
          thinkingBuffer: '',
          isCollapsed: false,
          thinkingDone: false,
          thinkingDuration: 0,
          _startTime: Date.now(),
          time: getTimeString(),
        }
        messages.value.push(thinkingMsg)
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
            messages.value[idx].isCollapsed = true
            messages.value[idx].thinkingDone = true
            const startTime = messages.value[idx]._startTime || Date.now()
            messages.value[idx].thinkingDuration = Math.max(1, Math.round((Date.now() - startTime) / 1000))
          }
          currentThinkingMsgId.value = null
        }

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
            messages.value[idx].isCollapsed = true
            messages.value[idx].thinkingDone = true
            const st = messages.value[idx]._startTime || Date.now()
            messages.value[idx].thinkingDuration = Math.max(1, Math.round((Date.now() - st) / 1000))
          }
          currentThinkingMsgId.value = null
        }

        // 清理流式状态
        isThinking.value = false
        isStreaming.value = false
        isStreamingError.value = true
        streamingResponse.value = errMsg
        sending.value = false

        // 写入对话气泡
        pushMessage({
          id: `lifecycle_error_${Date.now()}`,
          role: 'assistant',
          content: errMsg,
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

        if (currentThinkingMsgId.value) {
          let idx = messages.value.findIndex(m => m.id === currentThinkingMsgId.value)
          if (idx >= 0) {
            messages.value[idx].thinkingBuffer += delta
          } else {
            idx = pendingMessages.value.findIndex(m => m.id === currentThinkingMsgId.value)
            if (idx >= 0) {
              pendingMessages.value[idx].thinkingBuffer += delta
            }
          }
        }

        nextTick(() => scrollToBottom())
      }
      return
    }

    if (eventType === 'agent' && stream === 'item') {
      const phase = data.payload?.data?.phase
      const toolName = data.payload?.data?.name || 'unknown'
      const toolCallId = data.payload?.data?.toolCallId
      const args = data.payload?.data?.meta
      const title = data.payload?.data?.title
      const msgRunId = runId

      if (phase === 'start') {
        currentThinkingToolName = toolName
        currentThinkingToolCallId = toolCallId
        const savedThinking = currentThinkingBuffer.trim()
        const summary = `调用 ${toolName}`
        currentThinkingBuffer = ''
        currentRunStats.value.toolCallCount++

        const existingEntry = messages.value.find(
          m => m.role === 'assistant' && m.stopReason === 'toolUse' && m.toolCallId === toolCallId
        )

        if (existingEntry) {
          existingEntry.toolName = toolName
          existingEntry.args = args
          existingEntry.thinkingSummary = summary
          existingEntry.thinkingText = savedThinking || existingEntry.thinkingText
          existingEntry.runId = msgRunId
        } else {
          pushMessage({
            id: `toolcall_${toolCallId}_${Date.now()}`,
            role: 'assistant',
            stopReason: 'toolUse',
            toolCallId: toolCallId,
            runId: msgRunId,
            toolName: toolName,
            args: args,
            thinkingSummary: summary,
            thinkingText: savedThinking || null,
            hasResult: false,
            isError: false,
            time: getTimeString(),
          })
        }

        nextTick(() => scrollToBottom())
      } else if (phase === 'update') {
        nextTick(() => scrollToBottom())
      } else if (phase === 'end') {
        nextTick(() => scrollToBottom())
      }
      return
    }

    if (eventType === 'agent' && stream === 'tool') {
      const phase = data.payload?.data?.phase
      const toolName = data.payload?.data?.name || 'unknown'
      const toolCallId = data.payload?.data?.toolCallId
      const msgRunId = runId

      if (phase === 'result') {
        const isError = data.isError === true
        if (isError) currentRunStats.value.toolErrorCount++
        else currentRunStats.value.toolSuccessCount++
        const resultData = data.payload?.data?.result || data.result
        const resultStr = typeof resultData === 'string' ? resultData : JSON.stringify(resultData)

        const toolCallEntry = messages.value.find(
          m => m.role === 'assistant' && m.stopReason === 'toolUse' && m.toolCallId === toolCallId
        )

        if (toolCallEntry) {
          toolCallEntry.isError = isError
          toolCallEntry.result = resultStr
          toolCallEntry.resultContent = resultStr
          toolCallEntry.thinkingSummary = isError ? `${toolName} 执行失败` : `${toolName} 执行成功`
          toolCallEntry.hasResult = true
          const entryIdx = messages.value.findIndex(m => m.toolCallId === toolCallId)
          if (entryIdx >= 0) {
            messages.value[entryIdx] = { ...toolCallEntry }
          }
        } else {
          pushMessage({
            id: `toolresult_${toolCallId}_${Date.now()}`,
            role: 'toolResult',
            toolCallId: toolCallId,
            runId: msgRunId,
            toolName: toolName,
            result: resultStr,
            isError: isError,
            time: getTimeString(),
          })
        }

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

        const message = payload.message
        if (message && message.content && message.content.length > 0) {
          const stopReason = message.stopReason || 'stop'

          if (stopReason === 'stop') {
            const finalMessage = {
              id: `final_${Date.now()}`,
              role: 'assistant',
              content: message.content,
              stopReason: 'stop',
              time: formatMessageTime(Date.now()),
            }
            pushMessage(finalMessage)

            const session = sessions.value.find(s => s.id === currentSessionId.value)
            if (session) session.lastAgentTime = finalMessage.time
          }
        } else if (streamingResponse.value) {
          const finalMessage = {
            id: `final_${Date.now()}`,
            role: 'assistant',
            content: streamingResponse.value,
            stopReason: 'stop',
            time: formatMessageTime(Date.now()),
          }
          pushMessage(finalMessage)

          const session = sessions.value.find(s => s.id === currentSessionId.value)
          if (session) session.lastAgentTime = finalMessage.time
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
        pushMessage({
          id: `aborted_${Date.now()}`,
          role: 'assistant',
          content: '对话已中止',
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
        pushMessage({
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: errMsg,
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
    sending.value = false
    isThinking.value = false
    isStreaming.value = false
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
  background-color: #F7F8FA;
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