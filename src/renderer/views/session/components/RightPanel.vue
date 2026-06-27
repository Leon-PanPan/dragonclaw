<template>
  <div class="right-panel-area">
    <div class="right-panel-toggle" @click="emit('toggle-panel')">
      <icon-interaction />
    </div>
    <div class="right-panel-slide" :class="{ collapsed: !showRightPanel }">
      <div v-if="currentSession && childSessions.length > 0" class="subsession-column">
        <div class="subsession-col-inner">
          <div class="subsession-col-header">子会话</div>
          <div class="subsession-col-list">
            <div
              v-for="sub in childSessions"
              :key="sub.key"
              :class="['subsession-col-item', { active: selectedSubagentKey === sub.key }]"
              @click="emit('select-subagent', sub.key)"
            >
              <div class="subsession-dot" :class="sub.role"></div>
              <div class="subsession-col-name">{{ sub.displayName }}</div>
            </div>
            <div
              v-if="selectedSubagentKey"
              :class="['subsession-col-item', 'back-to-main']"
              @click="emit('select-subagent', '')"
            >
              <div class="subsession-dot main"></div>
              <div class="subsession-col-name">← 主会话</div>
            </div>
          </div>
          <div v-if="sessionTasks.length > 0" class="subtask-col-section">
            <div class="subtask-col-header">子任务</div>
            <div class="subtask-col-list">
              <div v-for="task in sessionTasks.filter(t => t)" :key="task.id" class="subtask-col-item" :class="{ done: task.status === 'done' }">
                <div class="subsession-dot" :class="task.status === 'done' ? 'leaf' : 'main'"></div>
                <div class="subtask-col-name">{{ getTaskAgentName(task.agentId) }}</div>
                <div class="subtask-col-status">{{ task.status === 'done' ? '✓' : '...' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const props = defineProps({
  showRightPanel: { type: Boolean, default: false },
  childSessions: { type: Array, default: () => [] },
  selectedSubagentKey: { type: String, default: '' },
  sessionTasks: { type: Array, default: () => [] },
  currentSession: { type: Object, default: null },
})

const emit = defineEmits([
  'toggle-panel',
  'select-subagent',
])

const A = inject('sessionActions')
const getTaskAgentName = A.getTaskAgentName
</script>

<style scoped lang="scss">
.right-panel-area {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: visible;
  position: relative;
}

.right-panel-toggle {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  cursor: pointer;
  color: var(--color-text-3);
  font-size: 18px;
  transition: color 0.15s;
}

.right-panel-toggle:hover {
  color: #165dff;
}

.right-panel-slide {
  width: 150px;
  min-width: 150px;
  padding: 0 6px 8px 0;
  overflow: hidden;
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, opacity 0.2s ease;
}

.right-panel-slide.collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
}

.subsession-column {
  width: 100%;
  height: 100%;
}

.subsession-col-inner {
  background: var(--color-bg-2);
  border: 1px solid #E5E6EB;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-height: 200px;
  max-height: 340px;
  display: flex;
  flex-direction: column;
}

.subsession-col-header {
  padding: 10px 10px 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  flex-shrink: 0;
}

.subsession-col-list {
  overflow-y: auto;
  padding: 0 4px 6px 4px;
  flex: 1;
}

.subsession-col-list::-webkit-scrollbar {
  width: 3px;
}
.subsession-col-list::-webkit-scrollbar-track {
  background: transparent;
}
.subsession-col-list::-webkit-scrollbar-thumb {
  background: #D0D5DD;
  border-radius: 2px;
}
.subsession-col-list::-webkit-scrollbar-thumb:hover {
  background: #B0B5BD;
}

.subsession-col-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.15s;
  color: var(--text-secondary);
}

.subsession-col-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.subsession-col-item.active {
  background: #e8f3ff;
  color: #165dff;
}

.subsession-col-item.back-to-main {
  margin-top: 4px;
  border-top: 1px solid #E5E6EB;
  padding-top: 6px;
}

.subsession-col-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subsession-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--color-text-4);
}

.subsession-dot.orchestrator { background-color: #722ED1; }
.subsession-dot.leaf { background-color: #0FC6C2; }
.subsession-dot.main { background-color: #165dff; }

.subtask-col-section {
  border-top: 1px solid #E5E6EB;
  padding-top: 4px;
}

.subtask-col-header {
  padding: 6px 10px 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  flex-shrink: 0;
}

.subtask-col-list {
  overflow-y: auto;
  max-height: 80px;
  padding: 0 4px 4px 4px;
}

.subtask-col-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.subtask-col-item.done {
  opacity: 0.7;
}

.subtask-col-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtask-col-status {
  font-size: 12px;
  flex-shrink: 0;
}
</style>