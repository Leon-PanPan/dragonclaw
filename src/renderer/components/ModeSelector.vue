<template>
  <div class="mode-selector">
    <!-- 切换按钮 -->
    <a-button
      size="small"
      type="outline"
      @click="togglePanel"
    >
      <template #icon>
        <icon-desktop v-if="modeStore.mode === 'local'" />
        <icon-wifi v-else />
      </template>
      {{ modeStore.mode === 'local' ? '本机模式' : '远程模式' }}
      <icon-down style="font-size: 10px; opacity: 0.6; margin-left: 2px;" />
    </a-button>

    <!-- 远程模式下的小齿轮按钮 -->
    <a-button
      v-if="modeStore.isRemote"
      type="text"
      size="small"
      title="修改远程配置"
      @click="openRemoteConfig"
      style="padding: 4px 6px;"
    >
      <template #icon>
        <icon-settings />
      </template>
    </a-button>

    <!-- 浮窗式选择面板 -->
    <teleport to="body">
      <div v-if="panelVisible" class="mode-panel-overlay" @click.self="closePanel">
        <div class="mode-panel" :style="panelStyle">
          <div class="mode-panel-title">选择连接模式</div>

          <div class="mode-panel-item" @click="handleSelectLocal">
            <icon-desktop class="mode-panel-icon" :class="{ active: modeStore.mode === 'local' }" />
            <div class="mode-panel-text">
              <div class="mode-panel-label">本机模式<span v-if="modeStore.mode === 'local'" class="current-tag">（当前）</span></div>
              <div class="mode-panel-desc">连接本机 Gateway (127.0.0.1:18789)</div>
            </div>
          </div>

          <div class="mode-panel-item" @click="handleSelectRemote">
            <icon-wifi class="mode-panel-icon" :class="{ active: modeStore.mode === 'remote' }" />
            <div class="mode-panel-text">
              <div class="mode-panel-label">远程模式<span v-if="modeStore.mode === 'remote'" class="current-tag">（当前）</span></div>
              <div class="mode-panel-desc">
                {{ modeStore.isRemote && modeStore.remoteConfig.ip
                  ? `${modeStore.remoteConfig.ip}:${modeStore.remoteConfig.port}`
                  : '连接远程服务器' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 切换到本机模式确认框 -->
    <a-modal
      v-model:visible="localConfirmVisible"
      title="切换到本机模式"
      :width="380"
      :mask-closable="true"
      ok-text="确认切换"
      cancel-text="取消"
      @ok="confirmSwitchToLocal"
      @cancel="localConfirmVisible = false"
    >
      <div style="padding: 8px 0; color: var(--text-secondary, #86909c);">
        确认切换回本机模式？这将断开当前与远程服务器的连接。
      </div>
    </a-modal>

    <!-- 远程配置弹窗（保存并连接时保持 loading 状态，直到连接成功） -->
    <a-modal
      v-model:visible="configModalVisible"
      title="远程服务器配置"
      :width="460"
      :mask-closable="false"
      :closable="!saving"
      :cancel-button-hidden="saving"
      ok-text="保存并连接"
      cancel-text="取消"
      :ok-button-props="{ loading: saving }"
      @ok="handleSaveConfig"
      @cancel="handleCancelConfig"
    >
      <div class="remote-config-form">
        <a-alert v-if="!saving" type="info" style="margin-bottom: 16px;">
          远程模式将通过网络连接到指定服务器的 OpenClaw Gateway，
          部分功能（智能体、技能、设置）仅在本机模式下可用。
        </a-alert>

        <div v-if="saving" class="saving-indicator">
          <a-spin :size="28" />
          <p>正在连接远程...</p>
          <p class="saving-target">{{ configForm.ip }}:{{ configForm.port }}</p>
          <p v-if="saving" class="saving-hint">请耐心等待，不要关闭弹窗</p>
        </div>

        <template v-else>
          <a-form :model="configForm" layout="vertical">
            <a-form-item label="远程 IP 地址" :rules="[{ required: true, message: '请输入远程 IP 地址或域名' }]">
              <a-input v-model="configForm.ip" placeholder="例如：192.168.1.100" allow-clear>
                <template #prefix><icon-computer /></template>
              </a-input>
            </a-form-item>

            <a-form-item label="端口号" :rules="[{ required: true, message: '请输入端口号' }]">
              <a-input-number v-model="configForm.port" placeholder="默认 18789" :min="1" :max="65535" style="width: 100%;" />
            </a-form-item>

            <a-form-item label="认证方式">
              <a-radio-group v-model="configForm.authMethod" type="button">
                <a-radio value="none">无</a-radio>
                <a-radio value="token">令牌</a-radio>
                <a-radio value="password">密码</a-radio>
              </a-radio-group>
            </a-form-item>

            <a-form-item v-if="configForm.authMethod === 'token'" label="访问令牌（Token）">
              <a-input-password v-model="configForm.token" placeholder="请输入 Gateway 访问令牌" allow-clear>
                <template #prefix><icon-lock /></template>
              </a-input-password>
            </a-form-item>

            <a-form-item v-if="configForm.authMethod === 'password'" label="密码">
              <a-input-password v-model="configForm.password" placeholder="请输入 Gateway 密码" allow-clear>
                <template #prefix><icon-lock /></template>
              </a-input-password>
              <div class="form-hint">密码不会被保存到本地，每次启动需要重新输入</div>
            </a-form-item>
          </a-form>

          <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
            <icon-check-circle v-if="testResult.success" />
            <icon-close-circle v-else />
            <span>{{ testResult.message }}</span>
          </div>

          <a-button type="outline" size="small" :loading="testing" @click="handleTest" style="width: 100%;">
            <template #icon><icon-thunderbolt /></template>
            测试连接
          </a-button>
        </template>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModeStore, type RemoteConfig } from '@/stores/modeStore';
import { wsManager } from '@/core/websocket/manager';

const modeStore = useModeStore();

const panelVisible = ref(false);
const panelStyle = ref({ top: '0px', left: '0px' });

const configModalVisible = ref(false);
const localConfirmVisible = ref(false); // 本机模式确认框
const saving = ref(false);
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);
// 用于标识当前操作是否已被用户取消（点击取消/关闭弹窗）
const canceled = ref(false);

const configForm = ref<RemoteConfig>({ ip: '', port: 18789, authMethod: 'token', token: '', password: '' });

// 点击按钮切换面板
async function togglePanel() {
  if (panelVisible.value) { panelVisible.value = false; return; }
  await updatePanelPosition();
  panelVisible.value = true;
}

function closePanel() { panelVisible.value = false; }

async function updatePanelPosition() {
  await new Promise(r => setTimeout(r, 10));
  const btn = document.querySelector('.mode-selector .arco-btn') as HTMLElement;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  panelStyle.value = { top: `${rect.bottom + 8}px`, left: `${Math.min(rect.left, window.innerWidth - 240)}px` };
}

// 点本机模式：弹确认框，用户确认后再切换
function handleSelectLocal() {
  panelVisible.value = false;
  if (modeStore.mode === 'local') return; // 已经是本机模式，无需操作
  localConfirmVisible.value = true;
}

function confirmSwitchToLocal() {
  localConfirmVisible.value = false;
  modeStore.setLocalMode();
  wsManager.setMode('local');
  wsManager.disconnect(1000);
  location.reload();
}

// 点"远程模式"：打开配置弹窗
function handleSelectRemote() {
  panelVisible.value = false;
  openRemoteConfig();
}

function openRemoteConfig() {
  canceled.value = false; // 重置取消状态
  configForm.value = { 
    ip: modeStore.remoteConfig.ip || '', 
    port: modeStore.remoteConfig.port || 18789, 
    authMethod: modeStore.remoteConfig.authMethod || 'token',
    token: modeStore.remoteConfig.token || '',
    password: ''  // 密码不从存储加载
  };
  testResult.value = null;
  saving.value = false;
  configModalVisible.value = true;
}

async function handleTest() {
  if (!configForm.value.ip) { testResult.value = { success: false, message: '请先填写 IP 地址' }; return; }
  testing.value = true;
  testResult.value = null;
  const { ip, port, authMethod, token } = configForm.value;
  
  // 根据认证方式构建 URL
  let tokenPart = '';
  if (authMethod === 'token' && token) {
    tokenPart = `?token=${encodeURIComponent(token)}`;
  }
  
  try {
    const ok = await testWs(`ws://${ip}:${port}${tokenPart}`);
    testResult.value = ok
      ? { success: true, message: `连接成功！服务器 ${ip}:${port} 响应正常` }
      : { success: false, message: `无法连接到 ${ip}:${port}，请检查 IP、端口和认证信息` };
  } catch (e: any) {
    testResult.value = { success: false, message: `连接失败：${e.message}` };
  } finally {
    testing.value = false;
  }
}

function testWs(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; ws.close(); resolve(false); } }, 6000);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'event' && d.event === 'connect.challenge') {
          if (!done) { done = true; clearTimeout(timer); ws.close(); resolve(true); }
        }
      } catch {}
    };
    ws.onerror = () => { if (!done) { done = true; clearTimeout(timer); resolve(false); } };
    ws.onclose = () => { if (!done) { done = true; clearTimeout(timer); resolve(false); } };
  });
}

// 保存并连接：先建立远程连接，连接成功后再切换模式
// 关键：只有远程连接真正成功后，才调用 setRemoteMode，避免用户取消后模式已切换的问题
async function handleSaveConfig() {
  // 用户已取消，不再执行保存逻辑
  if (canceled.value) return;
  if (!configForm.value.ip) { testResult.value = { success: false, message: '请先填写 IP 地址' }; return; }
  saving.value = true;
  testResult.value = null;
  try {
    const config: RemoteConfig = { ...configForm.value };
    // 1. 先切换到远程模式（触发 App.vue 的 watch，开始连接远程 WebSocket）
    // 2. 此时 mode 仍是 local，不会断开 local ws
    modeStore.setRemoteMode(config);
    // 3. 等待远程连接成功（hello-ok）或用户取消/超时
    let waited = 0;
    while (!window._remoteWsReady && waited < 20000) {
      if (canceled.value) {
        // 用户取消，复原为本地模式
        modeStore.setLocalMode();
        return;
      }
      await new Promise(r => setTimeout(r, 200));
      waited += 200;
    }
    // 循环结束：可能是连接成功，也可能是超时/用户取消
    if (canceled.value) {
      // 用户取消
      modeStore.setLocalMode();
      return;
    }
    if (window._remoteWsReady) {
      // 连接成功，关闭弹窗
      configModalVisible.value = false;
      Message.success(`已切换到远程模式：${config.ip}:${config.port}`);
    } else {
      // 连接超时
      testResult.value = { success: false, message: '连接超时，请检查网络或地址是否正确' };
      modeStore.setLocalMode();
    }
  } catch (e: any) {
    testResult.value = { success: false, message: `连接失败：${e.message}` };
    if (!canceled.value) {
      modeStore.setLocalMode();
    }
  } finally {
    saving.value = false;
  }
}

function handleCancelConfig() {
  canceled.value = true;
  saving.value = false;
  configModalVisible.value = false;
}
</script>

<style scoped>
.mode-selector { display: flex; align-items: center; gap: 4px; }

.mode-panel-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; }
.mode-panel {
  position: fixed; width: 240px; background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e5e6e8); border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12); padding: 8px 0; z-index: 10000;
}
.mode-panel-title {
  font-size: 12px; color: var(--text-secondary, #86909c);
  padding: 6px 16px 10px; border-bottom: 1px solid var(--border-color, #e5e6e8); margin-bottom: 4px;
}
.mode-panel-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 16px; cursor: pointer; transition: background 0.15s;
}
.mode-panel-item:hover { background: var(--color-fill-solid, #f2f3f5); }
.mode-panel-item.active { background: rgba(22,93,255,0.08); }
.mode-panel-icon { font-size: 18px; color: var(--text-secondary, #86909c); flex-shrink: 0; }
.mode-panel-icon.active { color: var(--primary-color, #165dff); }
.mode-panel-text { flex: 1; min-width: 0; }
.mode-panel-label { font-size: 14px; font-weight: 500; color: var(--text-primary, #1f2329); }
.mode-panel-desc { font-size: 12px; color: var(--text-secondary, #86909c); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mode-panel-check { color: var(--primary-color, #165dff); flex-shrink: 0; }
.current-tag { color: var(--primary-color, #165dff); font-size: 12px; font-weight: normal; margin-left: 4px; }

.remote-config-form { padding: 4px 0; }

.saving-indicator {
  display: flex; flex-direction: column; align-items: center; padding: 24px 0; gap: 12px;
  color: var(--text-secondary, #86909c);
}
.saving-indicator p { margin: 0; }
.saving-target { font-size: 16px; font-weight: 600; color: var(--text-primary, #1f2329); }
.saving-hint { font-size: 12px; color: var(--text-hint, #c5c8ce); }

.test-result {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;
}
.test-result.success { background: rgba(0,180,42,0.08); color: #00b42a; border: 1px solid rgba(0,180,42,0.2); }
.test-result.error { background: rgba(245,63,63,0.08); color: #f53f3f; border: 1px solid rgba(245,63,63,0.2); }

.form-hint {
  font-size: 12px;
  color: var(--text-secondary, #86909c);
  margin-top: 4px;
}
</style>
