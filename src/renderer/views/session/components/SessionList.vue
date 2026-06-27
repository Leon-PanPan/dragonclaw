<template>
  <div class="session-sidebar">
    <div class="session-list">
      <template v-for="(group, gIdx) in groupedSessions" :key="gIdx">
        <div v-if="group.sessions.length > 0" class="session-group">
          <div class="session-group-header">{{ group.label }}</div>
          <template v-for="(session, sIdx) in group.sessions" :key="session.id">
            <div
              v-if="sIdx < (groupShowLimit[gIdx] ?? 5)"
              :class="['session-item', { active: currentSessionId === session.id }]"
              @click="emit('select-session', session.id)"
              @mouseenter="setHovered(session.id)"
              @mouseleave="setHovered(null)"
            >
              <div class="session-icon">
                <a-avatar
                  v-if="!(currentSessionId === session.id && isCurrentStreaming)"
                  :style="{ backgroundColor: getSessionAgentColor(session) }"
                  :size="22"
                  shape="square"
                  :sizeStyle="{ fontSize: '11px' }"
                >
                  {{ getSessionAgentInitial(session) }}
                </a-avatar>
                <a-avatar
                  v-else
                  :style="{ backgroundColor: getSessionAgentColor(session) }"
                  :size="22"
                  shape="square"
                  class="session-icon-loading"
                >
                  <icon-loading :size="14" />
                </a-avatar>
              </div>
              <div class="session-title" :class="{ 'session-title-marquee': (currentSessionId === session.id || hoveredSessionId === session.id) && needsMarquee(session) }">
                <span class="session-title-inner">{{ getSessionTitle(session) }}</span>
              </div>
              <div class="session-badge" v-if="sessionUnreadMap[session.id] > 0">
                {{ sessionUnreadMap[session.id] > 99 ? '99+' : sessionUnreadMap[session.id] }}
              </div>
              <div class="session-actions" v-show="currentSessionId === session.id || hoveredSessionId === session.id || dropdownOpenSessionId === session.id" @click.stop>
                <a-dropdown
                  trigger="click"
                  position="top"
                  :popup-visible="dropdownOpenSessionId === session.id"
                  @popup-visible-change="(visible) => setDropdownOpen(visible ? session.id : null)"
                  @select="(value) => onMenuSelect(value, session)"
                >
                  <icon-more class="session-more-icon" />
                  <template #content>
                    <a-doption value="rename">
                      <template #icon><icon-edit /></template>
                      重命名
                    </a-doption>
                    <a-doption value="pin" v-if="!isSessionPinned(session.id)">
                      <template #icon><icon-pushpin /></template>
                      置顶
                    </a-doption>
                    <a-doption value="unpin" v-if="isSessionPinned(session.id)">
                      <template #icon><icon-pushpin /></template>
                      取消置顶
                    </a-doption>
                    <a-doption value="delete">
                      <template #icon><icon-delete /></template>
                      删除
                    </a-doption>
                  </template>
                </a-dropdown>
              </div>
            </div>
          </template>
          <div
            v-if="group.sessions.length > 5 && (groupShowLimit[gIdx] ?? 5) < group.sessions.length"
            class="session-expand-btn"
            @click="emit('expand-group', gIdx)"
          >
            <icon-down class="expand-icon" />
            展开更多 ({{ group.sessions.length - (groupShowLimit[gIdx] ?? 5) }})
          </div>
          <div
            v-else-if="group.sessions.length > 5 && (groupShowLimit[gIdx] ?? 5) >= group.sessions.length"
            class="session-expand-btn"
            @click="emit('collapse-group', gIdx)"
          >
            <icon-up class="expand-icon" />
            收起
          </div>
        </div>
      </template>

      <div v-if="sortedSessions.length === 0" class="empty-sessions">
        <icon-message style="font-size: 32px; color: var(--text-secondary);" />
        <p>暂无会话</p>
        <a-button type="text" size="mini" @click="emit('create-session')">创建第一个会话</a-button>
      </div>
    </div>

    <div class="session-new-bottom">
      <a-button type="primary" long @click="emit('create-session')">
        <template #icon><icon-plus /></template>
        新建会话
      </a-button>
    </div>
  </div>

  <a-modal
    :visible="showRenameModal"
    @update:visible="(v) => emit('update:showRenameModal', v)"
    title="重命名会话"
    :ok-text="'保存'"
    :ok-loading="renameSaving"
    @ok="emit('rename-confirm')"
    @cancel="emit('rename-cancel')"
    :width="420"
  >
    <a-input
      :model-value="renameInputValue"
      @update:model-value="(v) => emit('update:renameInputValue', v)"
      placeholder="输入会话名称"
      :max-length="100"
      @keydown.enter="emit('rename-confirm')"
      allow-clear
    />
  </a-modal>
</template>

<script setup>
import { inject } from 'vue'

const props = defineProps({
  sessions: { type: Array, required: true },
  currentSessionId: { type: String, default: null },
  groupedSessions: { type: Array, required: true },
  sortedSessions: { type: Array, required: true },
  sessionUnreadMap: { type: Object, default: () => ({}) },
  groupShowLimit: { type: Object, default: () => ({}) },
  hoveredSessionId: { type: String, default: null },
  dropdownOpenSessionId: { type: String, default: null },
  showRenameModal: { type: Boolean, default: false },
  renamingSession: { type: Object, default: null },
  renameInputValue: { type: String, default: '' },
  renameSaving: { type: Boolean, default: false },
  isCurrentStreaming: { type: Boolean, default: false },
})

const emit = defineEmits([
  'select-session',
  'create-session',
  'session-menu-action',
  'expand-group',
  'collapse-group',
  'rename-confirm',
  'rename-cancel',
  'hover-change',
  'dropdown-change',
  'update:showRenameModal',
  'update:renameInputValue',
])

const A = inject('sessionActions')
const getSessionAgentColor = A.getSessionAgentColor
const getSessionAgentInitial = A.getSessionAgentInitial
const getSessionTitle = A.getSessionTitle
const needsMarquee = A.needsMarquee
const isSessionPinned = A.isSessionPinned

function setHovered(id) {
  emit('hover-change', id)
}

function setDropdownOpen(id) {
  emit('dropdown-change', id)
}

function onMenuSelect(value, session) {
  setDropdownOpen(null)
  emit('session-menu-action', value, session)
}
</script>

<style scoped lang="scss">
.session-sidebar {
  width: 208px;
  min-width: 208px;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex-shrink: 0;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.session-list::-webkit-scrollbar {
  width: 3px;
}
.session-list::-webkit-scrollbar-track {
  background: transparent;
}
.session-list::-webkit-scrollbar-thumb {
  background: #D0D5DD;
  border-radius: 2px;
}
.session-list::-webkit-scrollbar-thumb:hover {
  background: #B0B5DD;
}

.session-group:nth-child(n+3) .session-item { opacity: 0.75; }
.session-group:nth-child(n+4) .session-item { opacity: 0.55; }
.session-group:nth-child(n+5) .session-item { opacity: 0.40; }

.session-group {
  margin-bottom: 2px;
}

.session-group-header {
  padding: 6px 12px 3px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-item {
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  position: relative;
  margin: 0 4px;
  border-radius: 6px;
  min-height: 36px;
}
.session-item:hover {
  background-color: #f2f3f5;
  color: #1d2129;
}

.session-item.active {
  background-color: #e8f3ff;
  color: #165dff;
}

.session-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background-color: #f53f3f;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  padding: 0 3px;
  flex-shrink: 0;
  z-index: 2;
}

.session-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.session-icon-loading {
  animation: sessionIconPulse 1.5s ease-in-out infinite;
}

@keyframes sessionIconPulse {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}

.session-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  position: relative;
}

.session-title-marquee {
  overflow: hidden;
}

.session-title-marquee .session-title-inner {
  display: inline-block;
  white-space: nowrap;
  animation: title-marquee 8s linear infinite;
}

@keyframes title-marquee {
  0% { transform: translateX(0); }
  10% { transform: translateX(0); }
  90% { transform: translateX(calc(-100% + 120px)); }
  100% { transform: translateX(calc(-100% + 120px)); }
}

.session-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}

.session-more-icon {
  font-size: 22px;
  color: var(--color-text-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.session-more-icon:hover {
  color: var(--color-text-1);
}

.session-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--color-text-3);
  cursor: pointer;
  text-align: center;
  border-radius: 4px;
  margin: 0 8px;
  transition: color 0.15s;
}

.session-expand-btn:hover {
  color: #165dff;
}

.session-new-bottom {
  padding: 8px 10px;
  flex-shrink: 0;
  border-top: 1px solid #E5E6EB;
}

.expand-icon {
  font-size: 12px;
}

.empty-sessions {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-sessions p {
  margin: 8px 0 12px;
  font-size: 12px;
}
</style>