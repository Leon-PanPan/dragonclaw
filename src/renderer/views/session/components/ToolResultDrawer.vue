<template>
  <a-drawer
    :visible="showResultDrawer"
    @update:visible="(v) => emit('update:showResultDrawer', v)"
    :title="currentResultTitle"
    :width="620"
    :footer="null"
    placement="right"
    @close="onClose"
  >
    <div v-if="currentResultStatus" :class="['drawer-status-badge', `status-${currentResultStatus}`]">
      {{ currentResultStatusText }}
    </div>

    <div v-if="currentResultThinking" class="drawer-section">
      <div class="drawer-section-title">💭 思考内容</div>
      <div class="drawer-thinking">{{ currentResultThinking }}</div>
    </div>

    <div v-if="currentResultArgs" class="drawer-section">
      <div class="drawer-section-title">📋 执行指令</div>
      <div class="drawer-args">
        <pre>{{ currentResultArgs }}</pre>
      </div>
    </div>

    <div v-if="currentResultHtml" class="drawer-section">
      <div class="drawer-section-title">📄 执行结果</div>
      <div class="drawer-result" v-html="currentResultHtml"></div>
    </div>

    <div v-else class="drawer-executing">
      🔄 正在执行中，请稍候...
    </div>
  </a-drawer>
</template>

<script setup>
defineProps({
  showResultDrawer: { type: Boolean, default: false },
  currentResultTitle: { type: String, default: '' },
  currentResultTool: { type: String, default: '' },
  currentResultStatus: { type: String, default: '' },
  currentResultStatusText: { type: String, default: '' },
  currentResultThinking: { type: String, default: '' },
  currentResultArgs: { type: String, default: '' },
  currentResultHtml: { type: String, default: '' },
})

const emit = defineEmits(['update:showResultDrawer'])

function onClose() {
  emit('update:showResultDrawer', false)
}
</script>

<style scoped lang="scss">
.drawer-status-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 50px;
  font-size: var(--font-size-body-2);
  font-weight: 500;
  margin-bottom: 16px;
  letter-spacing: 0.3px;
}
.drawer-status-badge.status-loading {
  background-color: rgba(var(--primary-color-rgb), 0.1);
  color: var(--primary-color);
}
.drawer-status-badge.status-success {
  background-color: rgba(var(--success-6), 0.1);
  color: rgb(var(--success-6));
}
.drawer-status-badge.status-error {
  background-color: rgba(var(--danger-6), 0.1);
  color: rgb(var(--danger-6));
}

.drawer-section {
  margin-bottom: 16px;
}
.drawer-section-title {
  font-size: var(--font-size-body-3);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.drawer-thinking {
  background: linear-gradient(180deg, rgba(var(--warning-6), 0.06) 0%, var(--color-bg-1) 100%);
  border-radius: var(--border-radius-large);
  padding: 12px;
  font-size: var(--font-size-body-1);
  color: var(--color-text-1);
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  border-left: 4px solid rgb(var(--warning-6));
}
.drawer-args {
  background-color: #1e1e1e;
  border-radius: var(--border-radius-large);
  padding: 12px;
  overflow: auto;
  max-height: 250px;
}
.drawer-args pre {
  margin: 0;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #d4d4d4;
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-result {
  background-color: var(--bg-secondary);
  border-radius: 6px;
  padding: 12px;
  max-height: 400px;
  overflow: auto;
  font-size: var(--font-size-body-2);
  line-height: 1.5715;
}
.drawer-result :deep(pre) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
.drawer-result :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
.drawer-executing {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
  font-size: var(--font-size-body-1);
}
</style>