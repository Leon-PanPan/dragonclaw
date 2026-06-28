<template>
  <div class="message-list" ref="messageListRef" @scroll="onScroll">
    <div v-if="isLoadingMessages" class="loading-messages">
      <a-spin :size="36" />
      <p>加载对话中...</p>
    </div>

    <div v-else-if="messages.length === 0 && !streamingResponse && !isThinking && !isStreaming" class="empty-messages">
      <div class="brand-logo">
        <img src="@/assets/images/openclaw-logo.svg" alt="OpenClaw" class="brand-logo-img" />
        <div class="logo-pulse-ring"></div>
      </div>
      <h3>开始对话</h3>
      <p>输入消息开始与{{ currentAgentName || '助手' }}对话</p>
    </div>

    <template
      v-for="(group, index) in displayGroupedMessages"
      :key="group.id || index"
    >
      <div
        v-if="group.item && group.item.role === 'user'"
        class="message-item user"
      >
        <div class="message-content">
          <div class="message-header">
            <span class="message-role">我</span>
            <span class="message-time">{{ group.item.time }}</span>
          </div>
          <div class="message-text markdown-content" v-html="getMessageHtml(group.item)" @click="handleMessageClick"></div>
        </div>
      </div>

      <div
        v-else-if="group.type === 'assistantReply'"
        class="assistant-group"
      >
        <div v-if="reasoningVisibleEnabled && group.toolItems && group.toolItems.length > 0" class="tool-summary-bar tool-summary-top">
          <div class="tool-summary-header" @click="toggleToolSummary(group)">
            <span class="tool-summary-text">
              <span class="tool-agent-badge">{{ currentAgentName || '助手' }}</span>
              <span style="margin-left:5px;">思考 {{ group.toolThinkingCount }} 次 · 🔧 {{ group.toolItems.length }} 次工具调用</span>
            </span>
            <span class="tool-summary-toggle">{{ isToolExpanded(group) ? '▼' : '▶' }}</span>
          </div>
          <div v-if="isToolExpanded(group)" class="tool-summary-body">
            <div
              v-for="msg in group.toolItems"
              :key="msg.id"
              class="timeline-item timeline-item-clickable"
              @click.stop="onTimelineClick(msg)"
            >
              <div class="timeline-left">
                <div :class="['timeline-dot', getTimelineDotClass(msg)]"></div>
                <div class="timeline-line"></div>
              </div>
              <div class="timeline-content">
                <div v-if="msg.thinkingText" class="timeline-thinking">{{ msg.thinkingText }}</div>
                <div :class="['timeline-card', getTimelineCardClass(msg)]">
                  <span class="timeline-icon">{{ getTimelineIcon(msg) }}</span>
                  <span class="timeline-tool">{{ getToolNameCN(msg.toolName) }}</span>
                  <span class="timeline-desc">{{ getToolCmdDisplay(msg) || (msg.isError ? '执行失败' : '执行成功') }}</span>
                  <span class="timeline-arrow">›</span>
                  <span class="timeline-time">{{ msg.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="message-item assistant">
          <div class="message-content">
            <div v-if="reasoningVisibleEnabled && group.thinkingMsg && (!group.toolItems || group.toolItems.length === 0)" class="thinking-inline">
              <div class="thinking-inline-header" @click="toggleThinkingInline(group)">
                <icon-command style="font-size:12px;color:var(--color-text-3);flex-shrink:0;" />
                <span class="thinking-inline-status">
                  {{ currentAgentName || '助手' }}
                  <template v-if="group.thinkingMsg.thinkingDone">
                    · 已思考（{{ group.thinkingMsg.thinkingDuration }}秒）
                  </template>
                  <template v-else>
                    · <icon-loading :size="12" style="margin-right:4px;" />思考中...
                  </template>
                </span>
                <span class="thinking-inline-toggle">{{ isThinkingExpanded(group) ? '▼' : '▶' }}</span>
              </div>
              <div v-if="isThinkingExpanded(group)" class="thinking-inline-body">
                <div class="thinking-inline-content" v-html="getThinkingHtml(group.thinkingMsg)"></div>
              </div>
            </div>

            <div v-if="getMessageHtml(group.item)" class="message-text markdown-content" v-html="getMessageHtml(group.item)" @click="handleMessageClick"></div>

            <div v-if="getGroupSubTasks(group).length > 0" class="subtask-inline-list">
              <div v-for="task in getGroupSubTasks(group).filter(t => t)" :key="task.id" class="subtask-inline-item" :class="{ done: task.status === 'done' }">
                <span class="subtask-inline-dot" :style="{ color: task.status === 'done' ? '#00B42A' : '#165dff' }">{{ task.status === 'done' ? '✓' : '○' }}</span>
                <span class="subtask-inline-agent">{{ getTaskAgentName(task.agentId) }}</span>
                <span class="subtask-inline-title">{{ task.title }}</span>
              </div>
            </div>

            <div v-if="group.runStats && group.runStats.tokenTotal > 0" class="message-stats-row">
              <span class="stats-context">{{ getContextInfo(group) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="reasoningVisibleEnabled && group.item && getMessageHtml(group.item)"
        :class="['message-item', group.item.role]"
      >
        <div class="message-avatar">
          <a-avatar :style="{ backgroundColor: '#94A3B8' }">
            <icon-robot />
          </a-avatar>
        </div>
        <div class="message-content">
          <div class="message-text" v-html="getMessageHtml(group.item)"></div>
        </div>
      </div>
    </template>

    <!-- 实时回复区域：仅在流式/思考中时显示，紧跟历史消息之后 -->
    <div v-if="isStreaming || isThinking" class="assistant-group streaming-block">
      <div v-if="reasoningVisibleEnabled && streamingToolItems.length > 0" class="tool-summary-bar tool-summary-top streaming-tools">
        <div class="tool-summary-header" @click="emit('update:showStreamingTools', !showStreamingTools)">
          <span class="tool-summary-text">
            <span class="tool-agent-badge">{{ currentAgentName || '助手' }}</span>
            <span style="margin-left:5px;">思考 {{ streamingThinkingCount }} 次 · 🔧 {{ streamingToolItems.length }} 次工具调用</span>
          </span>
          <span class="tool-summary-toggle">{{ showStreamingTools ? '▼' : '▶' }}</span>
        </div>
        <div v-if="showStreamingTools" class="tool-summary-body">
          <div
            v-for="msg in streamingToolItems"
            :key="msg.id"
            class="timeline-item timeline-item-clickable"
            @click.stop="onTimelineClick(msg)"
          >
            <div class="timeline-left">
              <div :class="['timeline-dot', getTimelineDotClass(msg)]"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div v-if="msg.thinkingText" class="timeline-thinking">{{ msg.thinkingText }}</div>
              <div :class="['timeline-card', getTimelineCardClass(msg)]">
                <span class="timeline-icon">{{ getTimelineIcon(msg) }}</span>
                <span class="timeline-tool">{{ getToolNameCN(msg.toolName) }}</span>
                <span class="timeline-desc">{{ getToolCmdDisplay(msg) || (msg.isError ? '执行失败' : msg.hasResult ? '执行成功' : '正在执行...') }}</span>
                <span class="timeline-arrow">›</span>
                <span class="timeline-time">{{ msg.time }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="message-item assistant">
        <div class="message-content">
          <div v-if="reasoningVisibleEnabled && latestThinkingMsg && streamingToolItems.length === 0" class="thinking-inline streaming-thinking">
            <div class="thinking-inline-header" @click="emit('update:showStreamingThinking', !showStreamingThinking)">
              <icon-command style="font-size:12px;color:var(--color-text-3);flex-shrink:0;" />
              <span class="thinking-inline-status">
                {{ currentAgentName || '助手' }}
                <template v-if="latestThinkingMsg.thinkingDone">
                  · 已思考（{{ latestThinkingMsg.thinkingDuration }}秒）
                </template>
                <template v-else>
                  · <icon-loading :size="12" style="margin-right:4px;" />思考中...
                </template>
              </span>
              <span class="thinking-inline-toggle">{{ showStreamingThinking ? '▼' : '▶' }}</span>
            </div>
            <div v-if="showStreamingThinking" class="thinking-inline-body">
              <div class="thinking-inline-content" v-html="getThinkingHtml(latestThinkingMsg)"></div>
            </div>
          </div>

          <div v-if="streamingResponse" :class="['message-text', isStreamingError ? 'streaming-text-error' : 'streaming-text', 'markdown-content']" v-html="throttledStreamingHtml"></div>

          <div v-if="!streamingResponse && !latestThinkingMsg && isThinking" class="message-text thinking-text">
            <a-spin size="small" /><span>正在思考中，请稍候...</span>
          </div>

          <!-- <div class="streaming-indicator" v-if="isStreaming">
            <icon-loading :size="12" style="margin-right:4px;" />正在生成...
          </div> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'

const props = defineProps({
  // 历史消息
  messages: { type: Array, required: true },
  groupedMessages: { type: Array, required: true },
  isLoadingMessages: { type: Boolean, default: false },
  isLoadingHistory: { type: Boolean, default: false },
  currentAgentName: { type: String, default: '' },
  sessionHasMessages: { type: Boolean, default: false },
  reasoningVisibleEnabled: { type: Boolean, default: false },
  // 流式回复（v-model）
  streamingResponse: { type: String, default: '' },
  throttledStreamingHtml: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  isThinking: { type: Boolean, default: false },
  isStreamingError: { type: Boolean, default: false },
  latestThinkingMsg: { type: Object, default: null },
  streamingToolItems: { type: Array, default: () => [] },
  streamingThinkingCount: { type: Number, default: 0 },
  showStreamingThinking: { type: Boolean, default: true },
  showStreamingTools: { type: Boolean, default: false },
})

const emit = defineEmits([
  'load-more',
  'scroll',
  'timeline-click',
  'update:showStreamingThinking',
  'update:showStreamingTools',
])

// 实时回复（流式/思考中）时，groupedMessages 的最后一项 assistantReply
// 与下方 streaming-block 渲染的是同一份内容（thinkingMsg/toolUse/stop），
// 会造成重复显示。隐藏最后一项 assistantReply，仅在 streaming-block 中渲染，
// 待回复结束后该项会随 messages 更新自动重新出现。
const displayGroupedMessages = computed(() => {
  const list = props.groupedMessages
  if (!list || list.length === 0) return list
  if (!(props.isStreaming || props.isThinking)) return list
  const last = list[list.length - 1]
  if (last && last.type === 'assistantReply') return list.slice(0, -1)
  return list
})

const messageListRef = ref(null)

const scrollToBottomInternal = () => {
  const el = messageListRef.value
  if (!el) return
  nextTick(() => {
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => [props.messages.length, props.streamingResponse, props.isThinking, props.latestThinkingMsg?.thinkingBuffer?.length || 0, props.streamingToolItems.length],
  () => { scrollToBottomInternal() }
)

const A = inject('sessionActions')
const {
  getMessageHtml,
  handleMessageClick,
  getThinkingHtml,
  getTimelineDotClass,
  getTimelineCardClass,
  getTimelineIcon,
  getToolNameCN,
  getToolCmdDisplay,
  isToolExpanded,
  toggleToolSummary,
  isThinkingExpanded,
  toggleThinkingInline,
  getGroupSubTasks,
  getTaskAgentName,
  getContextInfo,
  handleTimelineClick,
} = A

defineExpose({ messageListRef })

function onScroll(e) {
  emit('scroll', e)
  const el = e.target
  if (el.scrollTop < 50) {
    emit('load-more')
  }
}

function onTimelineClick(msg) {
  // 同时触发 emit 和 inject 调用，确保抽屉打开
  emit('timeline-click', msg)
  if (handleTimelineClick) handleTimelineClick(msg)
}
</script>

<style scoped lang="scss">
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  min-height: 0;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.message-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.empty-messages {
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  text-align: center;
}

.empty-messages h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--text-primary);
}

.empty-messages p {
  font-size: var(--font-size-body-2);
  margin: 0;
}

/* ========== Logo 动画（与 VersionInstallAndUpdate.vue 保持一致） ========== */
.empty-messages .brand-logo {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.empty-messages .brand-logo-img {
  width: 64px;
  height: 64px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 4px 10px rgba(255, 77, 77, 0.25));
  animation: mh-logo-float 4s ease-in-out infinite;
}
.empty-messages .logo-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 77, 77, 0.35);
  opacity: 0;
  z-index: 1;
  animation: mh-logo-pulse 1.6s ease-out infinite;
}
@keyframes mh-logo-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes mh-logo-pulse {
  0% { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}

.loading-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  text-align: center;
}

.loading-messages p {
  margin: 12px 0 0;
  font-size: var(--font-size-body-2);
}

.message-item {
  display: flex;
  margin-bottom: 15px;
  animation: fadeInUp 0.4s ease;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-item.user .message-content {
  align-items: flex-end;
}

.message-item.assistant .message-content {
  width: fit-content;
  max-width: 80%;
}

.message-item.assistant {
  flex-wrap: wrap;
}

.message-avatar {
  margin: 0 12px;
}

.message-content {
  width: fit-content;
  max-width: 80%;
  display: flex;
  flex-direction: column;
}

.message-header {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-role {
  font-weight: 600;
  font-size: 12px;
  color: rgb(var(--primary-6));
  letter-spacing: 0;
}

.message-item.assistant .message-role {
  color: rgb(var(--primary-6));
}

.message-time {
  font-size: 11px;
  color: var(--color-text-4);
}

.message-text {
  word-break: normal;
  overflow-wrap: break-word;
  width: fit-content;
}

.message-item.assistant .message-text {
  background: #FFFFFF;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: var(--font-size-body-1);
  line-height: 1.7;
  color: var(--color-text-1);
}

.message-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0 0;
  font-size: 11px;
  color: var(--color-text-3);
  gap: 8px;
  min-height: unset;
}

.stats-context {
  font-size: 11px;
  color: var(--color-text-3);
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: -0.3px;
}

.markdown-content {
  background-color: transparent;
}

.markdown-content :deep(pre) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  max-height: 200px;
}

.markdown-content :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  font-size: var(--font-size-body-3);
}

.markdown-content :deep(p) {
  margin: 3px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.markdown-content :deep(li) {
  margin: 3px 0;
}

.markdown-content :deep(blockquote) {
  margin: 6px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--border-color);
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 0 4px 4px 0;
}

.markdown-content :deep(.md-table),
.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
  font-size: var(--font-size-body-3);
}

.markdown-content :deep(.md-table th),
.markdown-content :deep(.md-table td),
.markdown-content :deep(table th),
.markdown-content :deep(table td) {
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  text-align: left;
}

.markdown-content :deep(.md-table th),
.markdown-content :deep(table th) {
  background-color: var(--bg-tertiary);
  font-weight: 600;
}

.markdown-content :deep(.md-table tr:nth-child(even)),
.markdown-content :deep(table tr:nth-child(even)) {
  background-color: rgba(0, 0, 0, 0.02);
}

.message-item.user .message-text {
  background-color: #E8F7FF;
  color: var(--color-text-1);
  border-radius: 18px;
  padding: 10px 16px;
  font-size: var(--font-size-body-1);
  line-height: 1.6;
  box-sizing: border-box;
}

.message-item.user .markdown-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3);
}

.message-item.user .markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 流式输出 */
.streaming-text {
  background: #FFFFFF;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: var(--font-size-body-1);
  line-height: 1.7;
  color: var(--color-text-1);
  word-break: break-word;
  animation: fadeInUp 0.3s ease;
}

.streaming-text-error {
  background: #FFF0F0;
  border: 1px solid #FFCCC7;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: var(--font-size-body-1);
  line-height: 1.7;
  color: #f53f3f;
  word-break: break-word;
  animation: fadeInUp 0.3s ease;
}

.streaming-text :deep(pre) {
  background-color: #1e1e1e !important;
  color: #d4d4d4 !important;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  max-height: 200px;
}

.streaming-text :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.streaming-text :deep(pre code) {
  background-color: transparent !important;
  padding: 0;
  font-size: var(--font-size-body-3);
}

.streaming-indicator {
  display: flex;
  align-items: center;
  margin-top: 6px;
  color: var(--color-text-4);
  font-size: 12px;
}

.thinking-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

/* 流式回复块（紧跟历史消息后） */
.streaming-block {
  margin-top: 4px;
}

.streaming-block > .message-item.assistant {
  padding: 0;
  margin: 0;
}

/* Timeline */
.timeline-item {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  position: relative;
}

.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
  padding-top: 6px;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-dot.dot-loading {
  background-color: rgb(var(--warning-6));
  box-shadow: 0 0 0 3px rgba(var(--warning-6), 0.2);
}

.timeline-dot.dot-success {
  background-color: rgb(var(--success-6));
  box-shadow: 0 0 0 3px rgba(var(--success-6), 0.15);
}

.timeline-dot.dot-error {
  background-color: rgb(var(--danger-6));
  box-shadow: 0 0 0 3px rgba(var(--danger-6), 0.15);
}

.timeline-line {
  width: 1px;
  flex: 1;
  background-color: var(--border-color);
  margin-top: 4px;
  min-height: 16px;
}

.timeline-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 5px;
}

.timeline-thinking {
  font-size: 10.5px;
  color: var(--color-text-3);
  margin-bottom: 4px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  opacity: 0.7;
  font-style: italic;
  letter-spacing: 0;
}

.timeline-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: var(--font-size-body-3);
  line-height: 1.4;
  max-width: 100%;
}

.timeline-card.card-loading {
  background-color: rgba(var(--warning-6), 0.08);
  border-left: 3px solid rgb(var(--warning-6));
  border-top: 1px solid rgba(var(--warning-6), 0.2);
  border-right: 1px solid rgba(var(--warning-6), 0.2);
  border-bottom: 1px solid rgba(var(--warning-6), 0.2);
  animation: loadingPulse 2s ease-in-out infinite;
}

.timeline-card.card-success {
  background-color: rgba(var(--success-6), 0.06);
  border-left: 3px solid rgb(var(--success-6));
  border-top: 1px solid rgba(var(--success-6), 0.15);
  border-right: 1px solid rgba(var(--success-6), 0.15);
  border-bottom: 1px solid rgba(var(--success-6), 0.15);
}

.timeline-card.card-error {
  background-color: rgba(var(--danger-6), 0.06);
  border-left: 3px solid rgb(var(--danger-6));
  border-top: 1px solid rgba(var(--danger-6), 0.15);
  border-right: 1px solid rgba(var(--danger-6), 0.15);
  border-bottom: 1px solid rgba(var(--danger-6), 0.15);
}

.timeline-icon {
  font-size: var(--font-size-body-1);
  flex-shrink: 0;
}

.timeline-tool {
  font-weight: 500;
  color: var(--color-text-2);
  font-size: 12px;
  flex-shrink: 0;
}

.timeline-desc {
  color: var(--color-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-size: 11px;
}

.timeline-time {
  font-size: 10px;
  color: var(--color-text-4);
  flex-shrink: 0;
}

.timeline-item-clickable {
  cursor: pointer;
  transition: transform 0.2s ease;
  border-radius: 6px;
  margin: -4px -8px;
  padding: 4px 8px;
}

.timeline-item-clickable:hover .timeline-arrow {
  opacity: 1;
  transform: translateX(3px);
  color: rgb(var(--primary-6));
}

.timeline-arrow {
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease, color 0.2s ease;
  color: var(--text-secondary);
  font-size: 18px;
  font-weight: bold;
  flex-shrink: 0;
}

/* Assistant 消息外层容器 */
.assistant-group {
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}

.assistant-group > .message-item.assistant {
  padding: 0;
  margin: 0;
}

/* 工具调用栏 */
.tool-summary-bar.tool-summary-top {
  margin: 0 0 4px 0;
  width: auto;
}
.tool-summary-bar {
  width: 100%;
  margin: 0 0 4px 54px;
  border-radius: 8px;
  background: #F7F8FA;
  overflow: hidden;
}

.tool-summary-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 7px 0;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.tool-summary-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-2);
  letter-spacing: 0;
}

.tool-summary-toggle {
  font-size: 10px;
  color: var(--color-text-4);
  margin-left: 6px;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.tool-agent-badge {
  background: rgb(var(--primary-6));
  color: #fff;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
}
.tool-summary-header:hover .tool-summary-toggle {
  color: rgb(var(--primary-6));
}

.tool-summary-body {
  padding: 4px 12px 8px 12px;
}

/* 思考过程内联 */
.thinking-inline {
  margin: 4px 0 6px 0;
}

.thinking-inline-header {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  color: var(--color-text-3);
  font-size: 12px;
  transition: color 0.15s ease;
}
.thinking-inline-header:hover {
  color: rgb(var(--primary-6));
}

.thinking-inline-status {
  font-weight: 500;
  color: var(--color-text-3);
}

.thinking-inline-toggle {
  font-size: 10px;
  color: var(--color-text-4);
  margin-left: 2px;
}

.thinking-inline-body {
  padding: 8px 0 8px 14px;
  border-left: 2px solid var(--color-border-2);
  margin: 6px 0 8px 4px;
}

.thinking-inline-content {
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.6;
}

.thinking-inline-content :deep(pre) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  max-height: 200px;
}

.thinking-inline-content :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.thinking-inline-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  font-size: var(--font-size-body-3);
}

/* 子任务（紧凑单行） */
.subtask-inline-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.subtask-inline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #F7F8FA;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.subtask-inline-item.done {
  opacity: 0.7;
}

.subtask-inline-dot {
  font-size: 14px;
  flex-shrink: 0;
  line-height: 1;
}

.subtask-inline-agent {
  font-size: 11px;
  color: var(--color-text-3);
  background: #E8E9EB;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.subtask-inline-title {
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes loadingPulse {
  0%, 100% { opacity: 0.95; }
  50% { opacity: 1; }
}
</style>