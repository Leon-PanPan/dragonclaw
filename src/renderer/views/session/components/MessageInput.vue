<template>
  <div class="input-area">
    <div class="input-container">
      <a-textarea
        ref="inputTextareaRef"
        :model-value="inputText"
        @update:model-value="(v) => emit('update:inputText', v)"
        placeholder="输入消息，按Enter发送，Shift+Enter换行..."
        :auto-size="{ minRows: 2, maxRows: 8 }"
        @keydown.enter.exact.prevent="emit('send')"
        @keydown.shift.enter.prevent="onNewLine"
        :disabled="!selectedModel || !wsConnected"
      />

      <div class="input-toolbar-inline">
        <div class="toolbar-left">
          <!-- 智能体选择器：仅在新会话（未发消息）时可选择；发出消息后只读显示 -->
          <a-dropdown
            trigger="click"
            position="top"
            :disabled="!canSelectAgent"
          >
            <a-button
              type="outline"
              size="small"
              :disabled="!wsConnected"
              class="agent-btn"
              :class="{ 'agent-btn-readonly': !canSelectAgent }"
            >
              <a-avatar
                v-if="currentAgent"
                :style="{ backgroundColor: getAgentColor(currentAgent.id) }"
                :size="18"
                shape="circle"
                class="agent-btn-avatar"
              >
                {{ getAgentInitial(currentAgent) }}
              </a-avatar>
              <span class="agent-btn-text">{{ currentAgentName || '选择智能体' }}</span>
              <icon-down v-if="canSelectAgent" class="agent-btn-arrow" />
              <icon-lock v-else class="agent-btn-lock" />
            </a-button>
            <template #content>
              <div class="agent-dropdown">
                <a-doption
                  v-for="agent in agentList"
                  :key="agent.id"
                  :class="{ 'agent-option-active': selectedNewSessionAgent === agent.id }"
                  @click="emit('select-agent', agent)"
                >
                  <div class="agent-option">
                    <a-avatar
                      :style="{ backgroundColor: getAgentColor(agent.id) }"
                      :size="22"
                      shape="circle"
                    >
                      {{ getAgentInitial(agent) }}
                    </a-avatar>
                    <div class="agent-option-text">
                      <div class="agent-option-name">{{ agent.identity?.name || agent.name || agent.id }}</div>
                      <div class="agent-option-model" v-if="getAgentDefaultModel(agent)">
                        {{ getAgentDefaultModel(agent) }}
                      </div>
                    </div>
                    <icon-check
                      v-if="selectedNewSessionAgent === agent.id"
                      class="agent-option-check"
                    />
                  </div>
                </a-doption>
                <div v-if="agentList.length === 0" class="agent-dropdown-empty">
                  暂无可用智能体
                </div>
              </div>
            </template>
          </a-dropdown>

          <a-popover
            v-if="workspaceIsSet"
            trigger="hover"
            position="top"
            :content="`当前工作空间：${currentSession?.projectSpace || ''}`"
          >
            <a-button
              type="outline"
              size="small"
              @click="emit('open-workspace')"
              :disabled="!wsConnected"
              class="workspace-btn"
            >
              <template #icon><icon-folder-add /></template>
              <span class="workspace-btn-text">{{ workspaceLabel }}</span>
            </a-button>
          </a-popover>
          <a-button
            v-else
            type="outline"
            size="small"
            @click="emit('open-workspace')"
            :disabled="!wsConnected"
            class="workspace-btn"
          >
            <template #icon><icon-folder-add /></template>
            <span class="workspace-btn-text">{{ workspaceLabel }}</span>
          </a-button>

          <a-dropdown trigger="click" position="top">
            <a-button type="outline" size="small" :disabled="!selectedModel || !wsConnected">
              <template #icon><icon-settings /></template>
            </a-button>
            <template #content>
              <div class="advanced-dropdown">
                <div class="advanced-item" @click="emit('toggle-verbose')">
                  <div class="advanced-item-left">
                    <icon-code-square class="advanced-item-icon" />
                    <span>详细输出</span>
                  </div>
                  <a-switch :model-value="verboseEnabled" size="small" @click.stop="emit('toggle-verbose')" />
                </div>
                <div class="advanced-item" @click="emit('toggle-reasoning')">
                  <div class="advanced-item-left">
                    <icon-eye class="advanced-item-icon" />
                    <span>推理可见</span>
                  </div>
                  <a-switch :model-value="reasoningVisibleEnabled" size="small" @click.stop="emit('toggle-reasoning')" />
                </div>
                <div class="advanced-divider"></div>
                <div class="advanced-item" @click="emit('compact-session')">
                  <div class="advanced-item-left">
                    <icon-shrink class="advanced-item-icon" />
                    <span>压缩会话</span>
                  </div>
                  <span class="advanced-item-hint">清理上下文</span>
                </div>
              </div>
            </template>
          </a-dropdown>
        </div>

        <div class="toolbar-right">
          <ModelSelector ref="modelSelectorRef" :model-value="selectedModel" @update:model-value="(v) => emit('update:selectedModel', v)">
            <template #trigger>
              <span class="model-dropdown-label">
                <img
                  v-if="modelSelectorRef?.activeProvider"
                  :src="`https://models.dev/logos/${modelSelectorRef.activeProvider}.svg`"
                  class="model-dropdown-logo"
                  @error="e => e.target.style.display = 'none'"
                />
                {{ selectedModelName }}
                <icon-down class="model-dropdown-arrow" />
              </span>
            </template>
          </ModelSelector>
          <a-dropdown
            v-if="showThinkingLevelSelect"
            trigger="click"
            position="top"
          >
            <span class="thinking-level-trigger">
              <span class="thinking-level-current">{{ selectedThinkingLevel || '默认' }}</span>
              <icon-down class="thinking-level-arrow" />
            </span>
            <template #content>
              <div class="thinking-level-dropdown">
                <a-doption
                  :class="{ 'tl-active': !selectedThinkingLevel }"
                  @click="emit('thinking-level-change', '')"
                >默认</a-doption>
                <a-doption
                  v-for="level in thinkingLevelOptions"
                  :key="level"
                  :class="{ 'tl-active': selectedThinkingLevel === level }"
                  @click="emit('thinking-level-change', level)"
                >{{ level }}</a-doption>
              </div>
            </template>
          </a-dropdown>
          <a-button
            class="send-btn"
            type="primary"
            size="small"
            @click="emit('send')"
            :loading="sending"
            :disabled="!inputText.trim() || !selectedModel || !wsConnected"
          >
            <template #icon><icon-send /></template>
          </a-button>
        </div>
      </div>
    </div>

    <div class="connection-status">
      <a-tag :color="wsConnected ? 'green' : 'red'" size="small">
        <template #icon>
          <icon-wifi v-if="wsConnected" />
          <icon-close-circle v-else />
        </template>
        {{ wsConnected ? '已连接' : '未连接' }}
      </a-tag>
      <div class="status-info">
        <span class="model-info">{{ currentAgentName || '未选择智能体' }}</span>
        <a-button type="text" size="mini" @click="emit('reconnect')" v-if="!wsConnected">
          重新连接
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref, computed } from 'vue'
import ModelSelector from '@/components/ModelSelector.vue'

const props = defineProps({
  inputText: { type: String, default: '' },
  selectedModel: { type: String, default: '' },
  selectedThinkingLevel: { type: String, default: '' },
  thinkingLevelOptions: { type: Array, default: () => [] },
  showThinkingLevelSelect: { type: Boolean, default: false },
  selectedModelName: { type: String, default: '' },
  sending: { type: Boolean, default: false },
  verboseEnabled: { type: Boolean, default: false },
  reasoningVisibleEnabled: { type: Boolean, default: false },
  workspaceLabel: { type: String, default: '设置工作区' },
  workspaceIsSet: { type: Boolean, default: false },
  currentSession: { type: Object, default: null },
  currentAgentName: { type: String, default: '' },
  wsConnected: { type: Boolean, default: false },
  // 智能体选择相关
  agentList: { type: Array, default: () => [] },
  selectedNewSessionAgent: { type: String, default: '' },
  sessionHasMessages: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:inputText',
  'update:selectedModel',
  'send',
  'new-line',
  'toggle-verbose',
  'toggle-reasoning',
  'open-workspace',
  'compact-session',
  'reconnect',
  'thinking-level-change',
  'select-agent',
])

const inputTextareaRef = ref(null)
const modelSelectorRef = ref(null)

const A = inject('sessionActions')
const handleNewLine = A.handleNewLine
const getAgentColor = A.getAgentColor
const getAgentInitial = A.getAgentInitial
const getAgentDefaultModel = A.getAgentDefaultModel

// 当前智能体对象（从 agentList 中按 selectedNewSessionAgent 或 currentSession.agentId 查找）
const currentAgent = computed(() => {
  const id = props.selectedNewSessionAgent || props.currentSession?.agentId
  if (!id) return null
  return props.agentList.find(a => a.id === id) || null
})

// 是否可选择智能体：仅新会话（无消息）时可选
const canSelectAgent = computed(() => !props.sessionHasMessages)

function onNewLine(e) {
  handleNewLine(e)
  emit('new-line', e)
}
</script>

<style scoped lang="scss">
.input-area {
  padding: 10px 12px;
  background: transparent;
  flex-shrink: 0;
}

.input-container {
  background-color: #fff;
  border: 1px solid #E5E6EB;
  border-radius: 12px;
  padding: 10px 12px 6px 12px;
}

.input-container :deep(.arco-textarea) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 2px 0 !important;
  min-height: 40px !important;
}

.input-container :deep(.arco-textarea:focus) {
  box-shadow: none !important;
}

.input-container :deep(.arco-textarea-wrapper) {
  border: none !important;
  background: transparent !important;
}

.input-toolbar-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-left :deep(.arco-btn-outline) {
  border-color: #E5E6EB;
  border-radius: 6px;
  font-size: 12px;
}

.workspace-btn {
  max-width: 160px;
  flex-shrink: 0;
}
.workspace-btn-text {
  display: inline-block;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

/* ========== 智能体选择按钮（输入框内） ========== */
.agent-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 160px;
  flex-shrink: 0;
  padding-left: 6px;
  padding-right: 8px;
  height: 28px;
}
.agent-btn :deep(.arco-btn-shape) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.agent-btn-avatar {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
}
.agent-btn-text {
  display: inline-block;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  font-size: 12px;
  font-weight: 500;
}
.agent-btn-arrow,
.agent-btn-lock {
  font-size: 10px;
  color: var(--color-text-4);
  flex-shrink: 0;
}
.agent-btn-readonly {
  cursor: default;
  background-color: var(--color-fill-2, #f7f8fa);
  opacity: 0.92;
}
.agent-btn-readonly:hover {
  background-color: var(--color-fill-2, #f7f8fa);
}

/* ========== 智能体下拉菜单 ========== */
.agent-dropdown {
  padding: 4px 0;
  overflow-y: auto;
}
.agent-dropdown-header {
  padding: 6px 12px 4px;
  font-size: 11px;
  color: var(--color-text-4);
  letter-spacing: 0.3px;
  text-transform: uppercase;
  font-weight: 600;
}
.agent-dropdown :deep(.arco-dropdown-option) {
  padding: 0;
  line-height: unset;
}
.agent-dropdown :deep(.arco-dropdown-option-content) {
  padding: 0 !important;
}
.agent-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  min-width: 220px;
  width: 100%;
}
.agent-option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.agent-option-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agent-option-model {
  font-size: 11px;
  color: var(--color-text-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agent-option-check {
  color: rgb(var(--primary-6));
  font-size: 14px;
  flex-shrink: 0;
}
.agent-option-active {
  background-color: rgba(22, 93, 255, 0.08) !important;
}
.agent-option-active .agent-option-name {
  color: rgb(var(--primary-6));
  font-weight: 600;
}
.agent-dropdown-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--color-text-4);
  text-align: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-dropdown-label {
  font-size: 13px;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 2px;
}

.model-dropdown-label:hover {
  color: var(--color-text-1);
  background: rgba(0, 0, 0, 0.04);
}

.model-dropdown-arrow {
  font-size: 10px;
  color: var(--color-text-4);
}

.model-dropdown-logo {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

.thinking-level-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-text-2);
  user-select: none;
}
.thinking-level-trigger:hover {
  background: rgba(0, 0, 0, 0.04);
}
.thinking-level-current {
  color: var(--color-text-1);
}
.thinking-level-arrow {
  font-size: 10px;
  color: var(--color-text-4);
}
.thinking-level-dropdown {
  min-width: 80px;
}
.tl-active {
  color: #165dff !important;
  background-color: #e8f3ff !important;
}

.advanced-dropdown {
  min-width: 200px;
  padding: 4px 0;
}

.advanced-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.advanced-item:hover {
  background: var(--color-fill-2);
}

.advanced-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.advanced-item-icon {
  font-size: 16px;
  color: var(--color-text-3);
}

.advanced-item-hint {
  font-size: 11px;
  color: var(--color-text-4);
}

.advanced-divider {
  height: 1px;
  background: var(--color-border-2);
  margin: 4px 8px;
}

.send-btn {
  flex-shrink: 0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  min-width: 36px;
  padding: 0;
}

.send-btn :deep(.arco-btn-icon) {
  font-size: 18px;
  margin-right: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 0 4px;
  font-size: 13px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.model-info {
  font-weight: 500;
}
</style>