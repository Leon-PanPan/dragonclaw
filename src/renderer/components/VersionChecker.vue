<template>
  <!-- 组件本身不渲染任何可见元素，仅在检测到更新时弹出 Modal -->
  <a-modal
    v-model:visible="modalVisible"
    :closable="!isForceUpdate && !isDownloading"
    :mask-closable="!isForceUpdate && !isDownloading"
    :footer="false"
    :width="520"
    :hide-title="true"
    :unmount-on-close="false"
    :body-style="{ padding: 0 }"
  >
    <!-- ===== 状态：检测中 ===== -->
    <div v-if="checkState === 'checking'" class="update-modal-body checking-state">
      <div class="modal-icon-wrapper spinning">
        <icon-loading :size="48" />
      </div>
      <h3 class="modal-title">正在检查更新...</h3>
      <p class="modal-subtitle">请稍候，正在连接到更新服务器</p>
    </div>

    <!-- ===== 状态：发现更新（非强制 / 强制） ===== -->
    <div v-else-if="checkState === 'update-found'" class="update-modal-body update-found-state">
      <!-- 顶栏装饰 -->
      <div class="modal-header-bar" :class="{ 'force-bar': isForceUpdate }">
        <icon-exclamation-circle-fill v-if="isForceUpdate" :size="56" class="header-icon" />
        <icon-cloud-download v-else :size="56" class="header-icon" />
      </div>

      <div class="modal-content-area">
        <!-- 标题 -->
        <h3 class="modal-title" :class="{ 'force-title': isForceUpdate }">
          {{ isForceUpdate ? '重要更新' : '发现新版本' }}
        </h3>

        <!-- 强制更新提示 -->
        <p v-if="isForceUpdate" class="force-tip">
          <icon-info-circle-fill :size="16" />
          此版本为强制更新，更新完成前无法继续使用
        </p>

        <!-- 版本对比 -->
        <div class="version-compare">
          <span class="version-tag current-version">v{{ currentVersion }}</span>
          <span class="version-arrow">
            <svg width="32" height="12" viewBox="0 0 32 12">
              <line x1="0" y1="6" x2="24" y2="6" stroke="var(--primary-color, #165dff)" stroke-width="2" stroke-linecap="round" />
              <polyline points="20,2 26,6 20,10" fill="none" stroke="var(--primary-color, #165dff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="version-tag latest-version">v{{ updateInfo.version }}</span>
        </div>

        <!-- 更新标题 -->
        <div v-if="updateInfo.title" class="update-title-text">
          {{ updateInfo.title }}
        </div>

        <!-- 更新内容 -->
        <div v-if="updateInfo.note" class="update-note-wrapper">
          <div class="update-note-label">更新内容</div>
          <div class="update-note-content">
            <p v-for="(line, idx) in noteLines" :key="idx">{{ line }}</p>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="modal-footer-area">
        <a-button
          v-if="!isForceUpdate && !isDownloading && !isSilent"
          type="secondary"
          long
          @click="handleLater"
        >
          稍后更新
        </a-button>
        <a-button
          type="primary"
          long
          :loading="isDownloading || isSilent"
          @click="handleStartDownload"
        >
          <template v-if="isSilent && !isDownloading">正在准备更新...</template>
          <template v-else-if="isDownloading">正在准备更新...</template>
          <template v-else>立即更新</template>
        </a-button>
      </div>
    </div>

    <!-- ===== 状态：下载中 ===== -->
    <div v-else-if="checkState === 'downloading'" class="update-modal-body downloading-state">
      <div class="modal-icon-wrapper">
        <icon-cloud-download :size="48" />
      </div>
      <h3 class="modal-title">正在下载更新</h3>
      <p class="modal-subtitle download-step">
        正在执行：{{ downloadStepName }}
      </p>
      <div class="progress-wrapper">
        <a-progress
          :percent="downloadProgress"
          :stroke-width="8"
          :show-text="true"
          :color="{
            '0%': '#165dff',
            '100%': '#14c9c9'
          }"
          animation
        />
      </div>
      <p class="progress-hint">请勿关闭应用，更新将于后台完成</p>
    </div>

    <!-- ===== 状态：下载完成 ===== -->
    <div v-else-if="checkState === 'done'" class="update-modal-body done-state">
      <div class="modal-icon-wrapper success-wrapper">
        <icon-check-circle-fill :size="56" />
      </div>
      <h3 class="modal-title">更新完成</h3>
      <p class="modal-subtitle">新版本已下载完毕，请重启应用以完成更新</p>
      <div class="modal-footer-area">
        <a-button type="primary" long @click="handleRestart">
          重启应用
        </a-button>
      </div>
    </div>

    <!-- ===== 状态：下载失败 ===== -->
    <div v-else-if="checkState === 'error'" class="update-modal-body error-state">
      <div class="modal-icon-wrapper error-wrapper">
        <icon-close-circle-fill :size="56" />
      </div>
      <h3 class="modal-title">更新失败</h3>
      <p class="modal-subtitle error-message">{{ errorMessage }}</p>
      <div class="modal-footer-area">
        <a-button
          v-if="!isForceUpdate"
          type="secondary"
          long
          @click="handleLater"
        >
          稍后再说
        </a-button>
        <a-button type="primary" long @click="handleRetry">
          重试
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { systemApi, updaterApi, eventsApi } from '@/api/gateway';
import { invoke, on } from '@/core/ipc';

// ====================
// Props
// ====================
const props = defineProps({
  /** 是否自动检测更新 */
  autoCheck: {
    type: Boolean,
    default: false
  },
  /** 自动检测间隔（毫秒），autoCheck 为 true 时生效 */
  autoCheckInterval: {
    type: Number,
    default: 600000 // 10分钟
  }
});

// ====================
// 状态管理
// ====================
/** 状态机状态：idle | checking | up-to-date | update-found | downloading | done | error */
const checkState = ref('idle');

/** 更新信息（直接来自 checkForUpdates IPC 返回值） */
const updateInfo = ref({
  version: '',
  force: false,
  silent: false,
  title: '',
  scriptUrl: '',
  note: ''
});

/** Modal 可见性 */
const modalVisible = ref(false);

/** 当前版本号 */
const currentVersion = ref('');

/** 下载进度 */
const downloadProgress = ref(0);

/** 下载步骤名 */
const downloadStepName = ref('初始化');

/** 错误信息 */
const errorMessage = ref('');

/** 定时器 ID */
let intervalTimer = null;

/** 进度监听移除器 */
let progressUnsubscriber = null;

/** 错误监听移除器 */
let errorUnsubscriber = null;

/** 检查结果监听移除器（用于单次 await update-check-status） */
let checkStatusUnsubscriber = null;

// ====================
// 计算属性
// ====================
const isForceUpdate = computed(() => updateInfo.value.force === true);

const isSilent = computed(() => updateInfo.value.silent === true);

const isDownloading = computed(() => checkState.value === 'downloading');

/** 更新内容按换行分段 */
const noteLines = computed(() => {
  if (!updateInfo.value.note) return [];
  return updateInfo.value.note
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
});

/** 上次检查结果，供父组件查询 */
const lastCheckResult = computed(() => ({
  state: checkState.value,
  hasUpdate: checkState.value === 'update-found',
  currentVersion: currentVersion.value,
  latestVersion: updateInfo.value.version,
  updateInfo: { ...updateInfo.value }
}));

// ====================
// 工具方法
// ====================


/** 获取当前版本号 */
async function fetchCurrentVersion() {
  try {
    if (window.electronAPI?.getAppVersion) {
      currentVersion.value = await systemApi.appVersion();
    }
  } catch (e) {
    console.warn('[VersionChecker] 获取 app 版本失败:', e);
  }

  if (!currentVersion.value) {
    currentVersion.value = __APP_VERSION__ || '1.0.0';
  }
}

// ====================
// 核心：版本检查
// ====================

/** 处理检查结果（事件回调） */
function handleCheckStatus(data) {
  console.log('[VersionChecker] 检查结果:', data);

  if (!data || data.ok !== true) {
    errorMessage.value = data?.error || '版本检查失败';
    checkState.value = 'error';
    return;
  }

  updateInfo.value = {
    version: data.version || '',
    force: data.force === true,
    silent: data.silent === true,
    title: data.title || '',
    scriptUrl: data.scriptUrl || '',
    note: data.note || ''
  };

  if (data.hasUpdate === true) {
    checkState.value = 'update-found';
    modalVisible.value = true;
  } else {
    checkState.value = 'up-to-date';
    // 无更新时不弹窗
  }
}

/** 执行版本检查（异步模式：非阻塞，结果通过 update-check-status 事件回调） */
async function checkVersionAsync() {
  if (checkState.value === 'downloading') {
    console.log('[VersionChecker] 正在下载中，跳过版本检查');
    return;
  }

  checkState.value = 'checking';
  errorMessage.value = '';

  try {
    await fetchCurrentVersion();

    if (!window.electronAPI?.onUpdateCheckStatus) {
      throw new Error('onUpdateCheckStatus API 不可用');
    }

    // 先订阅再触发，保证不会错过主进程推送的结果
    if (checkStatusUnsubscriber) {
      try { checkStatusUnsubscriber(); } catch (e) { /* ignore */ }
    }
    checkStatusUnsubscriber = eventsApi.onUpdateCheckStatus((data) => {
      if (checkStatusUnsubscriber) {
        try { checkStatusUnsubscriber(); } catch (e) { /* ignore */ }
        checkStatusUnsubscriber = null;
      }
      handleCheckStatus(data);
    });

    // 不等待后台检查完成，IPC 立即返回 { pending: true }
    await updaterApi.checkAsync();
  } catch (err) {
    if (checkStatusUnsubscriber) {
      try { checkStatusUnsubscriber(); } catch (e) { /* ignore */ }
      checkStatusUnsubscriber = null;
    }
    console.error('[VersionChecker] 版本检查失败:', err);
    errorMessage.value = err.message || '网络连接失败，请检查网络后重试';
    checkState.value = 'error';
  }
}

/** 执行版本检查（同步模式：阻塞等待主进程返回完整结果） */
async function checkVersion() {
  if (checkState.value === 'downloading') {
    console.log('[VersionChecker] 正在下载中，跳过版本检查');
    return;
  }

  checkState.value = 'checking';
  errorMessage.value = '';

  try {
    await fetchCurrentVersion();

    if (!window.electronAPI?.checkForUpdates) {
      throw new Error('checkForUpdates API 不可用');
    }

    const result = await updaterApi.check();
    handleCheckStatus({ ok: true, ...result });
  } catch (err) {
    console.error('[VersionChecker] 版本检查失败:', err);
    errorMessage.value = err.message || '网络连接失败，请检查网络后重试';
    checkState.value = 'error';
  }
}

// ====================
// 下载更新
// ====================

/** 开始下载更新 */
async function handleStartDownload() {
  checkState.value = 'downloading';
  downloadProgress.value = 0;
  downloadStepName.value = '准备下载';
  errorMessage.value = '';

  // 清理旧监听
  cleanupListeners();

  // 设置进度监听
  progressUnsubscriber = eventsApi.onUpdateProgress((data) => {
    if (data.stage === 'done') {
      if (data.success) {
        downloadProgress.value = 100;
        downloadStepName.value = '安装完成';
        checkState.value = 'done';
      } else {
        errorMessage.value = data.message || '更新安装失败';
        checkState.value = 'error';
      }
      return;
    }

    if (data.progress !== undefined && data.progress !== null) {
      downloadProgress.value = Math.min(100, Math.max(0, data.progress));
    }
    if (data.message) {
      downloadStepName.value = data.message;
    }
  });

  // 设置错误监听
  errorUnsubscriber = on('update-error', (data) => {
    errorMessage.value = data.message || '更新下载失败';
    checkState.value = 'error';
  });

  // 触发下载
  try {
    if (window.electronAPI?.downloadUpdate) {
      await updaterApi.download();
    } else {
      throw new Error('downloadUpdate API 不可用');
    }
  } catch (err) {
    console.error('[VersionChecker] 启动下载失败:', err);
    errorMessage.value = err.message || '启动下载失败，请重试';
    checkState.value = 'error';
  }
}

/** 重试下载 */
async function handleRetry() {
  await handleStartDownload();
}

/** 稍后更新 */
function handleLater() {
  if (updateInfo.value.silent) {
    // 静默更新不允许关闭弹窗
    return;
  }
  modalVisible.value = false;
}

/** 重启应用 */
function handleRestart() {
  invoke('restart-app').catch(() => {
    Message.info('请手动重启应用以完成更新');
  });
}

// ====================
// 监听器清理
// ====================

function cleanupListeners() {
  if (progressUnsubscriber) {
    try { progressUnsubscriber(); } catch (e) { /* ignore */ }
    progressUnsubscriber = null;
  }
  if (errorUnsubscriber) {
    try { errorUnsubscriber(); } catch (e) { /* ignore */ }
    errorUnsubscriber = null;
  }
  if (checkStatusUnsubscriber) {
    try { checkStatusUnsubscriber(); } catch (e) { /* ignore */ }
    checkStatusUnsubscriber = null;
  }
}

// ====================
// 定时器管理
// ====================

function startAutoCheck() {
  stopAutoCheck();
  if (props.autoCheck && props.autoCheckInterval > 0) {
    intervalTimer = setInterval(async () => {
      if (modalVisible.value && isForceUpdate.value) {
        return; // 强制更新弹窗显示时不重复检查
      }
      await checkVersionAsync();
    }, props.autoCheckInterval);
  }
}

function stopAutoCheck() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

// ====================
// 暴露给父组件
// ====================

/** 对外暴露的手动检查方法 */
async function triggerCheck() {
  await checkVersion();
}

defineExpose({
  triggerCheck,
  lastCheckResult
});

// ====================
// 生命周期
// ====================

onMounted(async () => {
  if (props.autoCheck) {
    await checkVersionAsync();
    startAutoCheck();
  }
});

onUnmounted(() => {
  stopAutoCheck();
  cleanupListeners();
});
</script>

<style scoped>
/* ====================
   基础变量
   ==================== */
.update-modal-body {
  padding: 0;
  text-align: center;
}

/* ====================
   检测中状态
   ==================== */
.checking-state {
  padding: 48px 32px;
}

/* ====================
   发现更新状态
   ==================== */
.update-found-state {
  overflow: hidden;
  border-radius: 8px;
}

/* 顶栏装饰 */
.modal-header-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 0 0;
  background: transparent;
  border-bottom: none;
}

.modal-header-bar.force-bar {
  background: transparent;
}

.header-icon {
  color: var(--primary-color, #165dff);
}

.force-bar .header-icon {
  color: #e6a23c;
}

.modal-content-area {
  padding: 14px 32px 8px;
}

/* 模态标题 */
.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #1d2129);
  margin: 0 0 6px;
}

.modal-title.force-title {
  color: var(--text-primary, #1d2129);
}

.modal-subtitle {
  font-size: 14px;
  color: var(--text-secondary, #86909c);
  margin: 0 0 8px;
}

/* 强制更新提示 */
.force-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #fef3e6;
  border-radius: 6px;
  color: #8c6100;
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 16px;
}

/* 版本号对比 */
.version-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 6px 0 16px;
}

.version-tag {
  display: inline-block;
  font-size: 18px;
  font-weight: 600;
  padding: 4px 14px;
  border-radius: 6px;
  letter-spacing: 0.3px;
}

.current-version {
  background: var(--bg-secondary, #f2f3f5);
  color: var(--text-secondary, #86909c);
}

.latest-version {
  background: rgba(22, 93, 255, 0.08);
  color: var(--primary-color, #165dff);
}

.version-arrow {
  display: flex;
  align-items: center;
}

/* 更新标题文本 */
.update-title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1d2129);
  margin-bottom: 14px;
  text-align: left;
}

/* 更新内容区域 */
.update-note-wrapper {
  text-align: left;
  margin-bottom: 8px;
}

.update-note-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #86909c);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.update-note-content {
  background: var(--bg-secondary, #f7f8fa);
  border-left: 3px solid var(--primary-color, #165dff);
  border-radius: 0 8px 8px 0;
  padding: 14px 18px;
  max-height: 180px;
  overflow-y: auto;
}

.update-note-content p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary, #4e5969);
}

.update-note-content p:last-child {
  margin-bottom: 0;
}

/* 底部按钮区域 */
.modal-footer-area {
  display: flex;
  gap: 12px;
  padding: 20px 32px 28px;
}

/* ====================
   下载中状态
   ==================== */
.downloading-state {
  padding: 48px 32px 36px;
}

.download-step {
  font-size: 14px;
  color: var(--primary-color, #165dff);
  font-weight: 500;
  margin: 12px 0 20px;
}

.progress-wrapper {
  max-width: 380px;
  margin: 0 auto 16px;
}

.progress-hint {
  font-size: 12px;
  color: var(--text-tertiary, #c9cdd4);
  margin: 0;
}

/* ====================
   下载完成状态
   ==================== */
.done-state {
  padding: 48px 32px 8px;
}

.success-wrapper {
  color: #00b42a;
}

/* ====================
   下载失败状态
   ==================== */
.error-state {
  padding: 48px 32px 8px;
}

.error-wrapper {
  color: #f53f3f;
}

.error-message {
  font-size: 14px;
  color: #f53f3f;
  margin: 8px 0;
  word-break: break-all;
}

/* ====================
   通用图标容器
   ==================== */
.modal-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 16px;
}

.checking-state .modal-icon-wrapper,
.downloading-state .modal-icon-wrapper {
  background: rgba(22, 93, 255, 0.08);
  color: var(--primary-color, #165dff);
}

.success-wrapper {
  background: rgba(0, 180, 42, 0.08);
}

.error-wrapper {
  background: rgba(245, 63, 63, 0.08);
}

/* ====================
   动画
   ==================== */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinning {
  animation: spin 1s linear infinite;
}

/* ====================
   滚动条
   ==================== */
.update-note-content::-webkit-scrollbar {
  width: 4px;
}

.update-note-content::-webkit-scrollbar-track {
  background: transparent;
}

.update-note-content::-webkit-scrollbar-thumb {
  background: var(--text-tertiary, #c9cdd4);
  border-radius: 2px;
}
</style>
