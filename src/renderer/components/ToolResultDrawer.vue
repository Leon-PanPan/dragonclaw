<template>
  <a-drawer
    v-model:visible="visible"
    :title="title"
    :width="620"
    :footer="null"
    placement="right"
    @close="onClose"
  >
    <!-- 执行状态标签 -->
    <div v-if="status" :class="['drawer-status-badge', `status-${status}`]">
      {{ statusText }}
    </div>

    <!-- 思考内容 -->
    <div v-if="thinking" class="drawer-section">
      <div class="drawer-section-title">💭 思考内容</div>
      <div class="drawer-thinking">{{ thinking }}</div>
    </div>

    <!-- 调用参数（执行指令） -->
    <div v-if="args" class="drawer-section">
      <div class="drawer-section-title">📋 执行指令</div>
      <div class="drawer-args">
        <pre>{{ args }}</pre>
      </div>
    </div>

    <!-- 执行结果 -->
    <div v-if="resultHtml" class="drawer-section">
      <div class="drawer-section-title">📄 执行结果</div>
      <div class="drawer-result" v-html="resultHtml"></div>
    </div>

    <!-- 执行中状态 -->
    <div v-else-if="isLoading" class="drawer-executing">
      🔄 正在执行中，请稍候...
    </div>

    <!-- 空状态 -->
    <div v-else class="drawer-empty">
      暂无执行结果
    </div>
  </a-drawer>
</template>

<script setup>
import { ref, watch } from 'vue';
import { parseMessageContent } from '@/utils/messageParser';
import hljs from 'highlight.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '执行详情'
  }
});

const emit = defineEmits(['update:modelValue', 'close']);

// 内部状态
const visible = ref(props.modelValue);
const status = ref('');
const statusText = ref('');
const thinking = ref('');
const args = ref('');
const resultHtml = ref('');
const isLoading = ref(false);

// 监听 modelValue 变化
watch(() => props.modelValue, (val) => {
  visible.value = val;
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const onClose = () => {
  emit('close');
  emit('update:modelValue', false);
};

// 检测字符串是否为代码
const isCodeContent = (str) => {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  // 检测是否包含常见代码模式
  return (
    // 以代码块标记开头
    trimmed.startsWith('```') ||
    // 包含代码缩进（4空格或tab开头）
    /^[ ]{4,}\S/m.test(trimmed) ||
    // JSON 格式
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    // git diff 格式
    trimmed.includes('diff --git') ||
    // 行号模式
    /^\s*\d+:\s/m.test(trimmed) ||
    // 文件路径模式
    /^\/[^\s]+\.[a-z]+$/m.test(trimmed) ||
    // 命令行输出模式
    /^\s*\$|^\s*>/m.test(trimmed) ||
    // 包含多个换行且有代码特征
    (trimmed.includes('\n') && /[{}();]/.test(trimmed))
  );
};

// 格式化代码（使用 highlight.js）
const highlightCode = (code, language = 'plaintext') => {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch (e) {}
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch (e) {
    return code;
  }
};

// 处理结果内容，生成带高亮的 HTML
const processResult = (result) => {
  if (!result) return '';

  const str = typeof result === 'string' ? result : JSON.stringify(result);
  const trimmed = str.trim();

  // 如果是代码块格式
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```(\w*)\n?([\s\S]*?)\n?```$/);
    if (match) {
      const language = match[1] || 'plaintext';
      const code = match[2];
      const highlighted = highlightCode(code, language);
      return `<pre class="hljs code-block"><code class="language-${language}">${highlighted}</code></pre>`;
    }
  }

  // 如果看起来像代码
  if (isCodeContent(str)) {
    const highlighted = highlightCode(str);
    return `<pre class="hljs code-block"><code>${highlighted}</code></pre>`;
  }

  // 否则使用 markdown 解析（处理普通文本中的代码片段）
  const parsed = parseMessageContent(str);
  return parsed.html || str;
};

// 设置抽屉内容
const setContent = (data) => {
  // status: loading | success | error
  status.value = data.status || '';
  statusText.value = data.statusText || '';
  thinking.value = data.thinking || '';
  args.value = data.args || '';
  isLoading.value = data.isLoading || false;

  // 处理 result/html
  if (data.html) {
    resultHtml.value = data.html;
  } else if (data.result !== undefined && data.result !== null) {
    resultHtml.value = processResult(data.result);
  } else {
    resultHtml.value = '';
  }
};

// 暴露方法给父组件
defineExpose({
  setContent
});
</script>

<style scoped>
.drawer-status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 16px;
}
.drawer-status-badge.status-loading {
  background: #FFF7E6;
  color: #AD6800;
}
.drawer-status-badge.status-success {
  background: #F6FFED;
  color: #52C41A;
}
.drawer-status-badge.status-error {
  background: #FFF2F0;
  color: #FF4D4F;
}
.drawer-section {
  margin-bottom: 16px;
}
.drawer-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 8px;
}
.drawer-args pre {
  background: #F7F8FA;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.drawer-thinking {
  background: #F7F8FA;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.drawer-result {
  font-size: 13px;
  line-height: 1.6;
}
.drawer-result :deep(pre) {
  background: #F7F8FA;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
.drawer-executing {
  color: var(--color-text-3);
  font-size: 13px;
  padding: 20px 0;
}
.drawer-empty {
  color: var(--color-text-3);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
.drawer-result :deep(.hljs) {
  background: #F7F8FA;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}
.drawer-result :deep(.code-block) {
  background: #F7F8FA;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
</style>
