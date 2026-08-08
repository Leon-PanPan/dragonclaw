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
        <template v-if="currentResultArgsKind === 'command'">
          <div v-if="currentResultArgsHtml" class="drawer-cmd-html-wrap">
            <div class="drawer-cmd-html" v-html="currentResultArgsHtml"></div>
            <a-tooltip v-if="currentResultArgsDetail" position="top" class="drawer-args-tip">
              <icon-exclamation-circle-fill class="drawer-args-info" />
              <template #content>
                <pre class="drawer-args-detail">{{ currentResultArgsDetail }}</pre>
              </template>
            </a-tooltip>
          </div>
          <div v-else class="drawer-cmd">
            <span class="drawer-cmd-prompt">$</span>
            <span class="drawer-cmd-text">{{ currentResultArgs }}</span>
            <a-tooltip v-if="currentResultArgsDetail" position="top" class="drawer-args-tip">
              <icon-exclamation-circle-fill class="drawer-args-info" />
              <template #content>
                <pre class="drawer-args-detail">{{ currentResultArgsDetail }}</pre>
              </template>
            </a-tooltip>
          </div>
        </template>
        <div v-else class="drawer-args-summary">
          <span class="drawer-args-summary-text">{{ currentResultArgs }}</span>
          <a-tooltip v-if="currentResultArgsDetail" position="top" class="drawer-args-tip">
            <icon-exclamation-circle-fill class="drawer-args-info" />
            <template #content>
              <pre class="drawer-args-detail">{{ currentResultArgsDetail }}</pre>
            </template>
          </a-tooltip>
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
  currentResultArgsKind: { type: String, default: '' },
  currentResultArgsDetail: { type: String, default: '' },
  currentResultArgsHtml: { type: String, default: '' },
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
.drawer-cmd {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background-color: #1e1e1e;
  border-radius: var(--border-radius-large);
  padding: 10px 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
.drawer-cmd-prompt {
  color: #4ec9b0;
  font-weight: 700;
  flex-shrink: 0;
  user-select: none;
}
.drawer-cmd-text {
  flex: 1;
  font-size: var(--font-size-body-3);
  color: #d4d4d4;
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-args-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-large);
  padding: 8px 12px;
}
.drawer-args-summary-text {
  flex: 1;
  font-size: var(--font-size-body-3);
  color: var(--color-text-1);
  word-break: break-word;
}
.drawer-args-tip {
  display: inline-flex;
  flex-shrink: 0;
}
.drawer-args-info {
  flex-shrink: 0;
  font-size: 15px;
  color: var(--text-tertiary);
  cursor: help;
  transition: color 0.15s;
}
.drawer-args-info:hover {
  color: var(--primary-color);
}
.drawer-args-detail {
  margin: 0;
  max-width: 480px;
  max-height: 320px;
  overflow: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  color: #e6e6e6;
}
.drawer-cmd-html-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.drawer-cmd-html {
  flex: 1;
  min-width: 0;
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
.drawer-result :deep(.result-text) {
  margin: 0;
  padding: 0;
  background-color: transparent;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text-1);
}
.drawer-result :deep(.result-error) {
  border-left: 3px solid rgb(var(--danger-6));
  background: rgba(var(--danger-6), 0.06);
  border-radius: var(--border-radius-large);
  padding: 10px 12px;
  overflow: auto;
  max-height: 420px;
}
.drawer-result :deep(.result-error .codeblock) {
  background-color: transparent;
  border-radius: 0;
  padding: 0;
  max-height: none;
}
.drawer-result :deep(.code-line-content.term-error) {
  color: #f53f3f;
}
.drawer-result :deep(.result-error pre) {
  margin: 0;
  padding: 0;
  background-color: transparent;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #f53f3f;
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-result :deep(.result-image) {
  display: block;
  max-width: 100%;
  max-height: 480px;
  border-radius: var(--border-radius-large);
  margin: 0 auto;
}
.drawer-result :deep(.term-block) {
  background-color: #1e1e1e;
  border-radius: var(--border-radius-large);
  padding: 12px;
  overflow: auto;
  max-height: 420px;
}
.drawer-result :deep(.term-block .codeblock) {
  background-color: transparent;
  border-radius: 0;
  padding: 0;
  max-height: none;
}
.drawer-result :deep(.term-line-title) {
  font-size: 12px;
  font-weight: 600;
  color: #9d9d9d;
  margin: 8px 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.drawer-result :deep(.term-line-title:first-child) {
  margin-top: 0;
}
.drawer-result :deep(.term-stdout),
.drawer-result :deep(.term-stderr) {
  margin: 0;
  padding: 0;
  background-color: transparent;
  font-size: var(--font-size-body-3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5715;
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-result :deep(.term-stdout) {
  color: #d4d4d4;
}
.drawer-result :deep(.code-line-content.term-stderr) {
  color: #ff7d00;
}
.drawer-result :deep(.term-exit) {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.drawer-result :deep(.term-exit-ok) {
  background: rgba(78, 201, 176, 0.15);
  color: #4ec9b0;
}
.drawer-result :deep(.term-exit-err) {
  background: rgba(255, 125, 0, 0.15);
  color: #ff7d00;
}

/* 带行号的代码块 */
.drawer-result :deep(.codeblock),
.drawer-cmd-html :deep(.codeblock) {
  display: inline-block;
  min-width: 100%;
  background-color: #1e1e1e;
  border-radius: var(--border-radius-large);
  padding: 8px 0;
  overflow: auto;
  max-height: 420px;
  font-size: var(--font-size-body-3);
}
.drawer-result :deep(.code-line),
.drawer-cmd-html :deep(.code-line) {
  display: flex;
  width: max-content;
  min-width: 100%;
  line-height: 1.5715;
}
.drawer-result :deep(.code-line-num),
.drawer-cmd-html :deep(.code-line-num) {
  flex-shrink: 0;
  width: 44px;
  text-align: right;
  padding-right: 12px;
  color: #6a737d;
  user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.drawer-result :deep(.code-line-content),
.drawer-cmd-html :deep(.code-line-content) {
  flex: 0 0 auto;
  padding: 0 12px;
  white-space: pre;
  color: #d4d4d4;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
.drawer-executing {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
  font-size: var(--font-size-body-1);
}
</style>