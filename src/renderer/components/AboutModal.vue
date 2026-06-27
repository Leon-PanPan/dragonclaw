<template>
  <a-modal
    v-model:visible="visible"
    title="关于 DragonClaw"
    :width="480"
    :footer="false"
    @close="handleClose"
  >
    <div class="about-modal-content">
      <!-- 应用信息 -->
      <div class="about-app-info">
        <div class="about-app-logo">
          <span class="logo-text">DragonClaw</span>
        </div>
        <p class="about-app-desc">基于 OpenClaw 的桌面客户端，用于简化 AI 助手的使用和配置。</p>
      </div>

      <!-- 版本信息 -->
      <div class="about-version-section">
        <div class="about-version-header">
          <h4 class="about-section-title">版本信息</h4>
          <a-button type="text" size="mini" @click="checkForUpdates" :loading="checkingUpdates">
            检查更新
          </a-button>
        </div>
        <div class="about-version-list">
          <div class="about-version-item">
            <span class="about-version-label">客户端</span>
            <span class="about-version-value">{{ appVersion }}</span>
          </div>
          <div class="about-version-item">
            <span class="about-version-label">OpenClaw</span>
            <span class="about-version-value">{{ openclawVersion }}</span>
          </div>
          <div class="about-version-item">
            <span class="about-version-label">Node.js</span>
            <span class="about-version-value">{{ nodeVersion }}</span>
          </div>
          <div class="about-version-item">
            <span class="about-version-label">Electron</span>
            <span class="about-version-value">{{ electronVersion }}</span>
          </div>
        </div>
      </div>

      <!-- 相关链接 -->
      <div class="about-links-section">
        <h4 class="about-section-title">相关链接</h4>
        <div class="about-links">
          <a class="about-link" @click="openLink('http://www.dragonclaw.cc/')">
            <icon-link /> DragonClaw 官网
          </a>
          <a class="about-link" @click="openLink('https://github.com/Leon-PanPan/dragonclaw')">
            <icon-github /> GitHub
          </a>
        </div>
      </div>

      <!-- 底部 -->
      <div class="about-footer">
        author 杨里卬
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { updaterApi } from '@/api/gateway'

const visible = ref(false)
const checkingUpdates = ref(false)

// 版本信息
const appVersion = ref('1.0.0')
const openclawVersion = ref('2026.3.13')
const nodeVersion = ref('18.0.0')
const electronVersion = ref('28.0.0')

// 打开Modal
const open = () => {
  visible.value = true
  loadSystemInfo()
}

// 关闭Modal
const handleClose = () => {
  visible.value = false
}

// 加载系统信息
const loadSystemInfo = async () => {
  try {
    const info = await window.electronAPI?.getSystemInfo()
    if (info) {
      nodeVersion.value = (info.nodeVersion || '18.0.0').replace('v', '')
      openclawVersion.value = info.openclawVersion || '2026.3.13'
      electronVersion.value = info.electronVersion || '28.0.0'
      appVersion.value = info.appVersion || '1.0.0'
    }
  } catch (e) {
    console.warn('[AboutModal] 获取系统信息失败:', e)
  }
}

// 检查更新
const checkForUpdates = async () => {
  checkingUpdates.value = true

  try {
    const result = await updaterApi.check()
    console.log('[AboutModal] 更新检查结果:', result)

    if (result.hasUpdate) {
      Message.info(`发现新版本 v${result.version}，请前往更新`)
    } else {
      Message.success('当前已是最新版本')
    }
  } catch (error) {
    console.error('[AboutModal] 检查更新失败:', error)
    Message.error('检查更新失败: ' + (error.message || '网络连接失败'))
  } finally {
    checkingUpdates.value = false
  }
}

// 打开外部链接（通过 IPC 调用主进程 shell.openExternal）
const openLink = (url) => {
  if (!url) return
  const api = window.electronAPI
  if (api && typeof api.openExternal === 'function') {
    try {
      const ret = api.openExternal(url)
      if (ret && typeof ret.catch === 'function') ret.catch((e) => console.warn('[AboutModal] openExternal 失败:', e))
    } catch (e) {
      console.warn('[AboutModal] openExternal 调用异常:', e)
    }
  } else {
    console.warn('[AboutModal] electronAPI.openExternal 不可用')
  }
}

// 暴露方法给父组件
defineExpose({
  open
})
</script>

<style scoped>
.about-modal-content {
  padding: 8px 0;
}

.about-app-info {
  text-align: center;
  margin-bottom: 24px;
}

.about-app-logo {
  margin-bottom: 12px;
}

.about-app-logo .logo-text {
  font-family: 'Press Start 2P', 'Courier New', 'Source Code Pro', monospace;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 1px;
  color: #e53935;
  text-shadow:
    2px 2px 0 #b71c1c,
    3px 3px 0 #7f0000,
    0 0 8px rgba(229, 57, 53, 0.4);
  user-select: none;
}

.about-app-desc {
  color: var(--text-secondary, #86909c);
  font-size: 14px;
  margin: 0;
}

.about-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #86909c);
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.about-version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.about-version-header .about-section-title {
  margin-bottom: 0;
}

.about-version-section,
.about-links-section {
  margin-bottom: 20px;
}

.about-version-list {
  background: var(--bg-secondary, #f7f8fa);
  border-radius: 8px;
  padding: 4px 0;
}

.about-version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
}

.about-version-label {
  color: var(--text-secondary, #86909c);
  font-size: 13px;
}

.about-version-value {
  color: #1D2129;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
}

.about-update-result {
  /* 已废弃：检查更新结果改用 Message toast 提示 */
  display: none;
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary, #f7f8fa);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #1D2129;
  text-decoration: none;
}

.about-link:hover {
  background: #165dff;
  color: #fff;
}

.about-footer {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary, #86909c);
  font-size: 12px;
}
</style>
