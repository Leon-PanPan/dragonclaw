<template>
  <div class="gateway-status-indicator" :class="statusClass">
    <div class="status-content">
      <div class="status-dot"></div>
      <span class="status-label">{{ displayText }}</span>
    </div>
    <div class="status-action">
      <a-button
        v-if="status === 'notInstalled'"
        type="text"
        size="small"
        @click="$emit('install')"
      >
        <icon-download /> 安装
      </a-button>
      <a-button
        v-else-if="status === 'notRunning' || status === 'stopped'"
        type="text"
        size="small"
        :loading="loading"
        @click="$emit('start')"
      >
        <icon-play-fill v-if="!loading" /> {{ loading ? '启动中' : '启动' }}
      </a-button>
      <a-button
        v-else-if="status === 'starting'"
        type="text"
        size="small"
        disabled
      >
        <icon-loading class="spin" /> 启动中
      </a-button>
      <a-button
        v-else-if="status === 'stopping'"
        type="text"
        size="small"
        disabled
      >
        <icon-loading class="spin" /> 停止中
      </a-button>
      <a-button
        v-else-if="status === 'running' || status === 'connected'"
        type="text"
        size="small"
        @click="$emit('stop')"
      >
        <icon-pause /> 停止
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    default: 'unknown'
  },
  loading: {
    type: Boolean,
    default: false
  }
});

defineEmits(['install', 'start', 'stop']);

const displayText = computed(() => {
  switch (props.status) {
    case 'notInstalled': return 'OpenClaw 未安装';
    case 'notRunning': return 'Gateway 未启动';
    case 'stopped': return 'Gateway 已停止';
    case 'starting': return 'Gateway 启动中';
    case 'stopping': return 'Gateway 停止中';
    case 'running': return 'Gateway 运行中';
    case 'connected': return 'Gateway 已连接';
    default: return '检查中...';
  }
});

const statusClass = computed(() => {
  switch (props.status) {
    case 'notInstalled':
    case 'notRunning':
    case 'stopped': return 'status-alert';
    case 'starting':
    case 'stopping': return 'status-warning';
    case 'running':
    case 'connected': return 'status-ok';
    default: return '';
  }
});
</script>

<style scoped>
.gateway-status-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #86909c;
}

.status-alert .status-dot {
  background-color: #f53f3f;
}

.status-warning .status-dot {
  background-color: #ff7d00;
}

.status-ok .status-dot {
  background-color: #00b42a;
}

.status-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.status-alert .status-label {
  color: #f53f3f;
}

.status-warning .status-label {
  color: #ff7d00;
}

.status-ok .status-label {
  color: #00b42a;
}

.status-action :deep(.arco-btn) {
  color: var(--text-secondary);
  font-size: 12px;
}

.status-action :deep(.arco-btn:hover) {
  color: var(--primary-color);
}

.status-alert .status-action :deep(.arco-btn) {
  color: #f53f3f;
}

.status-alert .status-action :deep(.arco-btn:hover) {
  color: #dc2f2f;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
