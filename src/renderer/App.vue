<template>
  <a-layout class="app-layout">
    <!-- 远程配置弹窗 -->
    <a-modal
      v-model:visible="remoteConfigModalVisible"
      title="远程服务器配置"
      :width="440"
      @ok="saveRemoteConfigAndConnect"
      @cancel="cancelRemoteConfig"
      ok-text="保存并连接"
      cancel-text="取消"
      :ok-loading="remoteConfigSaving"
    >
      <a-alert type="info" style="margin-bottom: 16px;" :show-icon="true">
        远程模式将通过网络连接到指定服务器的 OpenClaw Gateway，
        部分功能（智能体、技能、设置）仅在本机模式下可用。
      </a-alert>

      <a-form :model="remoteConfigForm" layout="vertical" ref="remoteConfigFormRef">
        <a-form-item
          label="远程 IP 地址"
          field="ip"
          :rules="[{ required: true, message: '请输入远程 IP 地址' }, { pattern: /^[\d.]+$|^[\w.-]+$/, message: '请输入有效的 IP 地址或域名' }]"
        >
          <a-input v-model="remoteConfigForm.ip" placeholder="例如：192.168.1.100" allow-clear>
            <template #prefix><icon-computer /></template>
          </a-input>
        </a-form-item>

        <a-form-item
          label="端口号"
          field="port"
          :rules="[{ required: true, message: '请输入端口号' }, { type: 'number', min: 1, max: 65535, message: '端口号范围 1-65535' }]"
        >
          <a-input-number v-model="remoteConfigForm.port" placeholder="默认 18789" :min="1" :max="65535" style="width: 100%;" />
        </a-form-item>

        <a-form-item label="认证方式" field="authMethod">
          <a-radio-group v-model="remoteConfigForm.authMethod" type="button">
            <a-radio value="none">无</a-radio>
            <a-radio value="token">令牌</a-radio>
            <a-radio value="password">密码</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="remoteConfigForm.authMethod === 'token'" label="访问令牌（Token）" field="token">
          <a-input-password v-model="remoteConfigForm.token" placeholder="请输入 Gateway 访问令牌" allow-clear>
            <template #prefix><icon-lock /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item v-if="remoteConfigForm.authMethod === 'password'" label="密码" field="password">
          <a-input-password v-model="remoteConfigForm.password" placeholder="请输入 Gateway 密码" allow-clear>
            <template #prefix><icon-lock /></template>
          </a-input-password>
          <div class="form-hint">密码不会被保存到本地，每次启动需要重新输入</div>
        </a-form-item>

        <div v-if="remoteConfigTestResult" class="remote-test-result" :class="remoteConfigTestResult.success ? 'success' : 'error'">
          <icon-check-circle v-if="remoteConfigTestResult.success" />
          <icon-close-circle v-else />
          <span>{{ remoteConfigTestResult.message }}</span>
        </div>

        <a-button type="outline" :loading="remoteConfigTesting" @click="testRemoteConnection" style="width: 100%;">
          <template #icon><icon-thunderbolt /></template>
          测试连接
        </a-button>
      </a-form>
    </a-modal>

    <!-- 切换到本机模式确认框（菜单触发） -->
    <a-modal
      v-model:visible="localConfirmModalVisible"
      title="切换到本机模式"
      :width="380"
      :mask-closable="true"
      ok-text="确认切换"
      cancel-text="取消"
      @ok="confirmSwitchToLocal"
      @cancel="localConfirmModalVisible = false"
    >
      <div style="padding: 8px 0; color: var(--text-secondary, #86909c);">
        确认切换回本机模式？这将断开当前与远程服务器的连接。
      </div>
    </a-modal>

    <!-- 侧边栏 - 仅在应用完全就绪时显示 -->
    <a-layout-sider
      v-if="showSidebar"
      :width="150"
      :style="{
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
      }"
    >
      <!-- Logo文字 -->
      <div class="logo-area">
        <span class="logo-text">DragonClaw</span>
      </div>

      <!-- 导航菜单 -->
      <a-menu
        v-if="appState === 'ready' && openClawRunning"
        :selected-keys="[currentRoute]"
        :style="{ border: 'none', backgroundColor: 'transparent' }"
        @menu-item-click="handleMenuClick"
      >
        <a-menu-item key="session">
          <template #icon>
            <icon-message />
          </template>
          对话
        </a-menu-item>
        <a-menu-item key="kanban">
          <template #icon>
            <icon-dashboard />
          </template>
          看板
        </a-menu-item>
        <a-menu-item key="model">
          <template #icon>
            <icon-relation />
          </template>
          模型
        </a-menu-item>
        <a-menu-item key="agent">
          <template #icon>
            <icon-robot />
          </template>
          智能体
        </a-menu-item>
        <a-menu-item key="skill">
          <template #icon>
            <icon-command />
          </template>
          技能
        </a-menu-item>
        <!-- 插件菜单已暂时隐藏 -->
        <!-- <a-menu-item key="plugin">
          <template #icon>
            <icon-code-square />
          </template>
          插件
        </a-menu-item> -->
        <!-- 日志菜单已暂时隐藏 -->
        <!-- <a-menu-item key="log">
          <template #icon>
            <icon-file />
          </template>
          日志
        </a-menu-item> -->
        <a-menu-item key="computer">
          <template #icon>
            <icon-computer />
          </template>
          电脑
        </a-menu-item>
        <a-menu-item key="setting">
          <template #icon>
            <icon-tool />
          </template>
          设置
        </a-menu-item>
      </a-menu>

      <!-- 底部信息和状态 -->
      <div class="sidebar-footer">
        <!-- 远程模式连接状态 -->
        <div v-if="modeStore.isRemote" class="gateway-status-bar">
          <div class="status-dot" :class="remoteStatusDotClass"></div>
          <span class="status-text">{{ remoteStatusText }}</span>
          <a-button type="text" size="mini" :loading="remoteWsConnecting" @click.stop="handleReconnectRemote" title="重新连接" style="padding:0 0 0 11px">
            {{ remoteWsConnecting ? '...' : '重连' }}
          </a-button>
        </div>

        <!-- 本机模式 OpenClaw 状态 -->
        <div v-else-if="appState === 'ready'" class="gateway-status-bar" @click="toggleGatewayStatus">
          <div class="status-dot" :class="statusDotClass"></div>
          <span class="status-text">{{ gatewayStatusText }}</span>
          <div class="status-actions" v-if="openClawInstalled">
            <a-button
              v-if="!openClawRunning"
              type="text"
              size="mini"
              :loading="operationLoading"
              @click.stop="showStartConfirm"
            >
              {{ operationLoading ? '...' : '启动' }}
            </a-button>
            <a-button
              v-else
              type="text"
              size="mini"
              :loading="operationLoading"
              @click.stop="showStopConfirm"
            >
              {{ operationLoading ? '...' : '停止' }}
            </a-button>
          </div>
        </div>
        
        <div class="version-info">版本 {{ appVersion }}</div>
        <div class="platform-info">{{ platformName }}</div>
      </div>
    </a-layout-sider>

    <!-- 主内容区 -->
    <a-layout :class="{ 'full-width': !showSidebar }">
      <a-layout-content class="main-content">
        
        <!-- 全局 Loading 状态 -->
        <div v-if="appState === 'loading'" class="loading-container">
          <a-spin :size="36">
            <template #icon>
              <icon-loading class="spin-icon" />
            </template>
          </a-spin>
          <p class="loading-text">环境检测中...</p>
        </div>

        <!-- 初始化安装 / 检查更新组件（clawc 云端版本管理，自包含 UI） -->
        <div v-else-if="appState === 'env-check'" class="env-check-page">
          <div class="env-check-card">
            <VersionInstallAndUpdate
              :mode="envStopMode || 'install'"
              :auto-check="true"
              :poll-interval="0"
              @continue="handleContinue"
              @skip="handleSkipUpdate"
              @check-complete="onEnvCheckComplete"
            />
          </div>
        </div>

        <!-- OpenClaw 已停止界面 -->
        <div v-else-if="appState === 'ready' && openClawInstalled && !openClawRunning" class="gateway-stopped-container">
          <div class="gateway-stopped-card">
            <img src="@/assets/images/openclaw-logo.svg" alt="OpenClaw" class="stopped-logo" />
            <h2>OpenClaw 未启动</h2>
            <p>环境健康检查：</p>
            <div class="env-status-list">
              <div class="env-status-item">
                <icon-check-circle v-if="envStatus.nodejs.installed" style="color: #00b42a;" />
                <icon-close-circle v-else style="color: #f53f3f;" />
                <span>Node.js</span>
                <span class="env-version">{{ envStatus.nodejs.version || '未安装' }}</span>
              </div>
              <div class="env-status-item">
                <icon-check-circle v-if="envStatus.openclaw.installed" style="color: #00b42a;" />
                <icon-close-circle v-else style="color: #f53f3f;" />
                <span>OpenClaw</span>
                <span class="env-version">{{ envStatus.openclaw.version || '未安装' }}</span>
              </div>
            </div>

            <a-button type="primary" size="large" :loading="operationLoading" @click="showStartConfirm">
              <template #icon><icon-play-fill v-if="!operationLoading" /></template>
              {{ operationLoading ? '启动中...' : '启动 OpenClaw' }}
            </a-button>
          </div>
        </div>

        <!-- 远程模式连接中界面 -->
        <div v-else-if="appState === 'ready' && modeStore.isRemote && !remoteReady" class="loading-container">
          <a-spin :size="36">
            <template #icon>
              <icon-loading class="spin-icon" />
            </template>
          </a-spin>
          <p class="loading-text">正在连接远程...</p>
          <p class="loading-text" style="font-size: 12px; color: var(--text-secondary);">
            {{ modeStore.remoteConfig.ip }}:{{ modeStore.remoteConfig.port }}
          </p>
          <a-button type="text" size="small" @click="wsManager.disconnect(1000); remoteWsConnecting=false;" style="margin-top: 12px;">
            取消连接
          </a-button>
        </div>

        <!-- 正常应用界面 -->
        <div v-else-if="appState === 'ready' && (openClawRunning || (modeStore.isRemote && remoteReady))" class="app-content-container">
          <router-view v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" style="height: 100%;" />
            </keep-alive>
          </router-view>
        </div>

      </a-layout-content>
    </a-layout>

    <!-- 操作确认弹窗（启动/停止） -->
    <a-modal
      v-model:visible="operationModalVisible"
      :title="operationModalTitle"
      :footer="null"
      width="560px"
    >
      <div class="operation-modal">
        <!-- 命令显示 -->
        <div class="command-line">
          <span class="command-prompt">$</span>
          <span class="command-text">{{ operationCommand }}</span>
          <a-spin v-if="operationLoading" :size="16" class="command-spin" />
          <span v-else class="command-done">✓</span>
        </div>
        
        <!-- 命令输出 -->
        <div class="command-output" :class="{ loading: operationLoading }">
          <pre>{{ operationOutput || (operationLoading ? '执行中...' : '') }}</pre>
        </div>
        
        <!-- 状态信息 -->
        <div v-if="operationMessage" class="operation-message" :class="operationMessageType">
          {{ operationMessage }}
        </div>
      </div>
    </a-modal>

    <!-- 自动更新检测 Modal（env-check 状态时不挂载，避免重复显示） -->
    <a-modal
      v-if="appState !== 'env-check'"
      v-model:visible="updateModalVisible"
      :closable="canCloseModal"
      :mask-closable="canCloseModal"
      :title="updateModalTitle"
      :title-align="'center'"
      :footer="false"
      :width="720"
    >
      <VersionInstallAndUpdate
        ref="updateViaRef"
        mode="update"
        :auto-check="true"
        :poll-interval="600000"
        @check-complete="onUpdateCheckComplete"
        @skip="updateModalVisible = false"
      />
    </a-modal>

    <!-- 关于弹窗 -->
    <AboutModal ref="aboutModalRef" />

  </a-layout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Message, Notification } from '@arco-design/web-vue';
import { wsManager } from '@/core/websocket/manager';
import rootConfig from '@shared/config';
import ModeSelector from '@/components/ModeSelector.vue';
import AboutModal from '@/components/AboutModal.vue';
import { useModeStore } from '@/stores/modeStore';
import VersionInstallAndUpdate from '@/components/VersionInstallAndUpdate.vue';
import { systemApi, configApi, eventsApi } from '@/api/gateway';

const router = useRouter();
const route = useRoute();
const modeStore = useModeStore();
const clawcDomain = rootConfig.clawc.domain;
// 应用状态
const appState = ref('loading');
const openClawInstalled = ref(false);
const openClawRunning = ref(false);
const openclawConfig = ref({});

// 远程模式下 WebSocket 连接状态
const remoteWsConnected = ref(false);
const remoteWsConnecting = ref(false);
const remoteReady = ref(false); // 远程连接是否已就绪（ws 握手完成）

// 关于弹窗
const aboutModalRef = ref(null);

// 远程配置弹窗状态
const remoteConfigModalVisible = ref(false);
const localConfirmModalVisible = ref(false); // 菜单触发本机模式确认框
const remoteConfigSaving = ref(false);
const remoteConfigTesting = ref(false);
const remoteConfigTestResult = ref(null);
const remoteConfigForm = ref({
  ip: '',
  port: 18789,
  authMethod: 'token',
  token: '',
  password: '',
});
const remoteConfigFormRef = ref();

// 环境状态
const envStopMode = ref(null); // 'install' | 'update' | null
const envStatus = ref({
  nodejs: { installed: false, version: '' },
  npm: { installed: false, version: '' },
  openclaw: { installed: false, version: '' }
});

const componentUpdateDismissed = ref(false); // 本次会话是否已跳过

// 操作状态
const operationLoading = ref(false);
const operationModalVisible = ref(false);
const operationModalTitle = ref('');
const operationCommand = ref('');
const operationOutput = ref('');
const operationMessage = ref('');
const operationMessageType = ref('');

// 计算属性
const currentRoute = computed(() => route.name);
const currentRouteName = computed(() => {
  const map = { session: '对话', kanban: '看板', model: '模型', agent: '智能体', skill: '技能', plugin: '插件', computer: '电脑', setting: '设置' };
  return map[route.name] || '未知';
});
const appVersion = ref(__APP_VERSION__ || '1.0.0');
const platformName = computed(() => {
  const map = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  return map[window.electronAPI?.platform || 'unknown'] || 'Unknown';
});

const gatewayStatusText = computed(() => {
  if (operationLoading.value) {
    return operationModalTitle.value === '启动 OpenClaw' ? '启动中...' : '停止中...';
  }
  return openClawRunning.value ? '运行中' : '已停止';
});

const statusDotClass = computed(() => {
  if (operationLoading.value) return 'dot-warning';
  return openClawRunning.value ? 'dot-ok' : 'dot-alert';
});

// 是否显示侧边栏（仅在应用完全就绪时显示）
const showSidebar = computed(() => {
  // 远程模式也显示侧边栏（连接中/已连接）
  return (appState.value === 'ready' && openClawRunning.value) || (appState.value === 'ready' && modeStore.isRemote);
});

// 远程模式下的连接状态文字
const remoteStatusText = computed(() => {
  if (remoteWsConnecting.value) return '远程连接中...';
  if (remoteWsConnected.value) return '已连接';
  return '远程未连接';
});

// 删除旧的 remoteStatusIcon，改为返回 null
const remoteStatusIcon = computed(() => null);

// 远程模式下的连接状态点
const remoteStatusDotClass = computed(() => {
  if (remoteWsConnecting.value) return 'dot-warning';
  if (remoteWsConnected.value) return 'dot-ok';
  return 'dot-alert';
});

// 远程模式下的连接状态图标（已连接时显示）- 已禁用
// const remoteStatusIcon = computed(() => {
//   if (remoteWsConnected.value) return 'icon-exclamation';
//   return null;
// });

// 远程连接的 IP（用于 tooltip）
const remoteConnectionIp = computed(() => {
  return modeStore.remoteConfig.ip ? `${modeStore.remoteConfig.ip}:${modeStore.remoteConfig.port}` : '';
});

// 显示启动确认
const showStartConfirm = () => {
  operationModalTitle.value = '启动 OpenClaw';
  operationCommand.value = 'openclaw gateway start';
  operationOutput.value = '';
  operationMessage.value = '';
  operationModalVisible.value = true;
  startOpenClaw();
};

// 显示停止确认
const showStopConfirm = () => {
  operationModalTitle.value = '停止 OpenClaw';
  operationCommand.value = 'openclaw gateway stop';
  operationOutput.value = '';
  operationMessage.value = '';
  operationModalVisible.value = true;
  stopOpenClaw();
};

// 初始化应用
const initApp = async () => {
  appState.value = 'loading';

  // ===== 远程模式：跳过环境检测，直接进入远程连接 =====
  if (modeStore.isRemote && modeStore.remoteConfig.ip) {
    console.log('[App] 远程模式，跳过环境检测，尝试连接远程 Gateway...');
    openClawInstalled.value = true;
    openClawRunning.value = false;
    remoteWsConnecting.value = true;
    remoteWsConnected.value = false;
    remoteReady.value = false;
    window._remoteWsReady = false;
    appState.value = 'ready';
    await connectRemoteWs();
    return;
  }

  // ===== 本机模式：执行完整环境检测流程 =====
  try {
    const envResult = await quickEnvCheck();
    console.log('[App] quickEnvCheck 返回:', JSON.stringify(envResult));
    envStatus.value = envResult;

    // dev stop 最高优先级：强制停在安装/更新界面
    if (envResult.stop === 'install' || envResult.stop === 'update') {
      console.log('[App] dev stop 强制停在:', envResult.stop);
      envStopMode.value = envResult.stop;
      appState.value = 'env-check';
      return;
    }

    // 判断是否需要进入 env-check：基于 quickEnvCheck 的实际检测结果
    const envNotReady = !envResult.nodejs.installed || !envResult.openclaw.installed;
    console.log('[App] envNotReady:', envNotReady, '(nodejs:', envResult.nodejs.installed, 'npm:', envResult.npm.installed, 'openclaw:', envResult.openclaw.installed, ')');

    if (envNotReady) {
      console.log('[App] 部分组件未安装，跳转到 env-check');
      openClawInstalled.value = false;
      envStopMode.value = 'install';
      // VersionInstallAndUpdate 组件自行获取云端数据
      appState.value = 'env-check';
      return;
    }

    console.log('[App] 所有组件已安装，继续初始化...');
    openClawInstalled.value = true;

    try {
      openclawConfig.value = await window.electronAPI?.readConfig?.() || {};
    } catch (e) {
      console.warn('[App] 读取配置失败:', e);
    }

    // 优先使用 envResult.run（开发覆盖），否则执行真实检测
    if (typeof envResult.run === 'boolean') {
      openClawRunning.value = envResult.run;
      // 开发覆盖模式下仍需主动建立 WebSocket 连接
      if (envResult.run) {
        const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
        wsManager.setGatewayPort(gatewayPort);
        const token = openclawConfig.value?.gateway?.auth?.token || '';
        wsManager.connect({ agentId: 'main', token, sessionKey: null }).catch(() => {});
      }
    } else {
      const canConnect = await testWebSocketConnection();
      openClawRunning.value = canConnect;
    }

    appState.value = 'ready';
  } catch (error) {
    console.error('[App] 初始化失败:', error);
    appState.value = 'env-check';
  }
};

// 连接远程 WebSocket
// 远程 Gateway 不走 hello-ok 握手，用 state===CONNECTED 轮询确认连接成功
const connectRemoteWs = async () => {
  if (!modeStore.isRemote || !modeStore.remoteConfig.ip) return;
  const { ip, port, authMethod, token, password } = modeStore.remoteConfig;
  console.log(`[App] 连接远程 Gateway: ${ip}:${port}, 认证方式: ${authMethod}`);
  remoteWsConnecting.value = true;
  remoteWsConnected.value = false;
  wsManager.setMode('remote', { ip, port, token, password, authMethod });
  wsManager.disconnect(1000);
  await new Promise(r => setTimeout(r, 300)); // 等待旧连接关闭

  // 用 state 轮询确认连接成功（避免 subscribe 时序问题）
  wsManager.connect({ agentId: 'main', token: authMethod === 'token' ? token : '', sessionKey: null });
  let waited = 0;
  const checkInterval = setInterval(() => {
    waited += 100;
    const state = wsManager.state.value;
    console.log(`[App] 连接状态检查: state=${state}, waited=${waited}ms`);
    if (state === 'connected') {
      clearInterval(checkInterval);
      remoteWsConnecting.value = false;
      remoteWsConnected.value = true;
      remoteReady.value = true;
      openClawRunning.value = true;
      window._remoteWsReady = true;
      console.log('[App] 远程 WebSocket 连接成功（state=connected）');
    } else if (waited >= 20000) {
      clearInterval(checkInterval);
      remoteWsConnecting.value = false;
      console.log('[App] 远程连接超时');
    }
  }, 100);
};

// 切换回本机模式时，重新初始化本机连接
const reinitLocalConnection = async () => {
  openClawRunning.value = false;
  remoteWsConnected.value = false;
  remoteWsConnecting.value = false;
  remoteReady.value = false;
  window._remoteWsReady = false;
  wsManager.setMode('local');
  wsManager.disconnect(1000);
  openclawConfig.value = await window.electronAPI?.readConfig?.() || {};
  const canConnect = await testWebSocketConnection();
  openClawRunning.value = canConnect;
};

// 监听模式切换
watch(() => modeStore.mode, async (newMode, oldMode) => {
  if (newMode === 'remote' && oldMode === 'local') {
    console.log('[App] 模式切换：本机 → 远程');
    wsManager.setMode('remote');
    wsManager.disconnect(1000);
    openClawRunning.value = false;
    remoteWsConnecting.value = true;
    remoteWsConnected.value = false;
    remoteReady.value = false;
    window._remoteWsReady = false;
    await connectRemoteWs();
  } else if (newMode === 'local' && oldMode === 'remote') {
    console.log('[App] 模式切换：远程 → 本机');
    wsManager.disconnect(1000);
    remoteWsConnected.value = false;
    remoteWsConnecting.value = false;
    await reinitLocalConnection();
  }
}, { immediate: false });

// 测试 WebSocket 连接（用于判断 OpenClaw 是否运行）
const testWebSocketConnection = () => {
  return new Promise((resolve) => {
    // 从配置读取 gateway 端口，默认 18789
    const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
    wsManager.setGatewayPort(gatewayPort);
    console.log('[App] Gateway 端口:', gatewayPort);
    
    const token = openclawConfig.value?.gateway?.auth?.token || '';
    // 监听连接状态变化
    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === 'res' && data.payload?.type === 'hello-ok') {
        resolve(true);
        unsubscribe();
      }
    });
    
    wsManager.connect({
      token,
      agentId: 'main',
      sessionKey: null,
    }).then(() => {
      // 连接成功，hello-ok 会在订阅中收到
      setTimeout(() => resolve(true), 2000);
    }).catch(() => {
      resolve(false);
    });
    
    // 超时
    setTimeout(() => resolve(false), 5000);
  });
};

// 快速环境检测
const quickEnvCheck = async () => {
  if (!window.electronAPI?.quickEnvCheck) {
    console.log('[App] quickEnvCheck: 使用 fallback 返回值（无 IPC）');
    return { 
      nodejs: { installed: true, version: 'v24.0.0' }, 
      npm: { installed: true, version: '10.0.0' }, 
      openclaw: { installed: true, version: '2026.3.13' },
      run: true,
      stop: null
    };
  }
  console.log('[App] quickEnvCheck: 调用 IPC');
  const result = await systemApi.envCheck();
  console.log('[App] quickEnvCheck: IPC 返回', JSON.stringify(result));
  return result;
};

// 通过端口检测是否运行（使用 IPC）
const checkPortActive = async (port) => {
  try {
    const result = await window.electronAPI?.checkGatewayRunning?.(port);
    console.log('[App] checkPortActive port:', port, 'result:', JSON.stringify(result));
    return result?.running || false;
  } catch (e) {
    console.debug('[App] checkPortActive error:', e.message);
    return false;
  }
};

// 检查 WebSocket 连接是否真正建立（等待 hello-ok 返回或状态已连接）
const checkWebSocketConnected = async (port) => {
  return new Promise((resolve) => {
    wsManager.setGatewayPort(port);
    const token = openclawConfig.value?.gateway?.auth?.token || '';
    
    // 先检查是否已经连接
    if (wsManager.isConnected()) {
      console.log('[App] checkWebSocketConnected 已连接，直接返回成功');
      resolve(true);
      return;
    }
    
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        console.log('[App] checkWebSocketConnected 超时');
        resolve(false);
      }
    }, 10000);
    
    // 监听连接成功
    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === 'res' && data.payload?.type === 'hello-ok') {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          console.log('[App] checkWebSocketConnected 成功收到 hello-ok!');
          resolve(true);
        }
      }
    });
    
    // 尝试连接
    wsManager.connect({
      token,
      agentId: 'main',
      sessionKey: null,
    }).then(() => {
      // connect() 成功但可能状态还是 CONNECTING，等待 hello-ok 回调
      console.log('[App] checkWebSocketConnected connect() 返回，等待 hello-ok...');
    }).catch(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(false);
      }
    });
  });
};

// 启动 OpenClaw
const startOpenClaw = async () => {
  operationLoading.value = true;
  operationMessage.value = '';
  
  try {
    const result = await window.electronAPI?.startOpenClaw?.();
    console.log('[App] startOpenClaw result:', JSON.stringify(result));
    operationOutput.value = result?.output || '';
    
    // 检查启动是否失败
    const resultObj = result?.result;
    const isFailed = resultObj?.ok === false || (resultObj?.error && /doctor/i.test(resultObj.error));
    
    if (isFailed) {
      // 启动失败，提示用户
      const errorMsg = resultObj?.error || '未知错误';
      operationMessage.value = '✗ 启动失败，正在自动修复...';
      operationMessageType.value = 'error';
      operationOutput.value += '\n\n⚠ 检测到配置问题，正在自动修复...';
      
      
      // 自动运行 openclaw doctor --fix --yes
      try {
        const doctorResult = await window.electronAPI?.executeCommand?.('openclaw doctor --fix');
        operationOutput.value += '\n\n=== openclaw doctor --fix 输出 ===\n';
        operationOutput.value += doctorResult?.stdout || doctorResult?.output || '';
        if (doctorResult?.stderr) {
          operationOutput.value += '\n错误:\n' + doctorResult.stderr;
        }
        
        // 检查修复是否成功
        if (doctorResult?.code === 0) {
          operationOutput.value += '\n\n✓ 环境修复完成！请重新启动。';
          operationMessage.value = '✓ 环境已修复，请重新启动';
          operationMessageType.value = 'success';
            } else {
          operationOutput.value += '\n\n⚠ 修复未完全成功，建议手动运行 openclaw doctor 查看详情';
          operationMessage.value = '⚠ 修复未完全成功';
          operationMessageType.value = 'warning';
        }
      } catch (doctorErr) {
        console.error('[App] doctor --fix 失败:', doctorErr);
        operationOutput.value += '\n\n✗ 修复命令执行失败: ' + doctorErr.message;
      }
      
      operationLoading.value = false;
      return;
    }
    
    // 等待启动（使用 WebSocket 连接检测，确保服务完全就绪）
    let started = false;
    const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
    console.log('[App] startOpenClaw 开始等待启动，配置的端口:', gatewayPort);
    
    // 持续等待直到 WebSocket 连接成功，不限制次数
    let attempts = 0;
    while (!started) {
      attempts++;
      await new Promise(r => setTimeout(r, 2000));
      operationOutput.value += `\n等待服务启动... (${attempts})`;
      
      const connected = await checkWebSocketConnected(gatewayPort);
      if (connected) {
        started = true;
        console.log('[App] startOpenClaw WebSocket 连接成功! (尝试', attempts, '次)');
        break;
      }
    }
    
    if (started) {
      openClawRunning.value = true;
      operationMessage.value = '✓ OpenClaw 启动成功！';
      operationMessageType.value = 'success';
      Message.success('OpenClaw 启动成功');
      
      // 重新连接 WebSocket
      const token = openclawConfig.value?.gateway?.auth?.token || '';
      const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
      wsManager.setGatewayPort(gatewayPort);
      console.log('[App] 重新连接 WebSocket, token:', token ? '有' : '无', '端口:', gatewayPort);
      
      wsManager.disconnect?.();
      wsManager.connect({
        token,
        agentId: 'main',
        sessionKey: null,
      }).then(() => {
        console.log('[App] WebSocket 重新连接成功');
      }).catch((err) => {
        console.error('[App] WebSocket 重新连接失败:', err);
      });
      
      setTimeout(() => {
        operationModalVisible.value = false;
      }, 1500);
    } else {
      operationMessage.value = '⚠ 启动可能未完全成功，请检查状态';
      operationMessageType.value = 'warning';
      Message.warning('启动可能未完全成功');
    }
  } catch (error) {
    console.error('[App] 启动失败:', error);
    operationOutput.value += `\n错误: ${error.message}`;
    operationMessage.value = '✗ 启动失败';
    operationMessageType.value = 'error';
    Message.error('启动失败');
  } finally {
    operationLoading.value = false;
  }
};

// 停止 OpenClaw
const stopOpenClaw = async () => {
  operationLoading.value = true;
  operationMessage.value = '';
  
  try {
    const result = await window.electronAPI?.stopOpenClaw?.();
    console.log('[App] stopOpenClaw result:', JSON.stringify(result));
    operationOutput.value = result?.output || '';
    
    // 先断开 WebSocket 连接，避免定时器继续尝试连接
    wsManager.disconnect?.(1000, 'service stopping');
    
    // 等待停止（最多 15 秒，每 2 秒检查一次）
    let stopped = false;
    const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const running = await checkPortActive(gatewayPort);
      if (!running) {
        stopped = true;
        break;
      }
      operationOutput.value += `\n等待服务停止... (${i+1}/8)`;
    }
    
    if (stopped) {
      openClawRunning.value = false;
      operationMessage.value = '✓ OpenClaw 已停止';
      operationMessageType.value = 'success';
      Message.success('OpenClaw 已停止');
      
      setTimeout(() => {
        operationModalVisible.value = false;
      }, 1500);
    } else {
      operationMessage.value = '⚠ 停止可能未完全成功';
      operationMessageType.value = 'warning';
    }
  } catch (error) {
    console.error('[App] 停止失败:', error);
    operationOutput.value += `\n错误: ${error.message}`;
    operationMessage.value = '✗ 停止失败';
    operationMessageType.value = 'error';
    Message.error('停止失败');
  } finally {
    operationLoading.value = false;
  }
};

// ========== VersionInstallAndUpdate 相关 ==========

const updateViaRef = ref(null);
const updateModalVisible = ref(false);
const updateModalHasForce = ref(false);
const updateModalInstalling = ref(false);

const canCloseModal = computed(() => !updateModalHasForce.value && !updateModalInstalling.value);

const updateModalTitle = computed(() => (
  updateModalHasForce.value ? '强制更新' : '发现新版本'
));

function onUpdateCheckComplete({ hasForce, hasAnyUpdate }) {
  updateModalHasForce.value = hasForce;
  if (hasAnyUpdate) updateModalVisible.value = true;
}

function onEnvCheckComplete(payload) {
  // env-check 页面的 VIA 自包含 UI，无需在 App.vue 中跟踪
  console.debug('[App] env-check 完成:', payload);
}

// ========== 组件更新通知 ==========

const onComponentUpdateAvailable = (data) => {
  console.log('[App] 收到组件更新通知:', JSON.stringify(data));
  if (!data || typeof data !== 'object') return;

  const updates = data;
  const hasForce = Object.values(updates).some(u => u.force);

  if (componentUpdateDismissed.value && !hasForce) return;

  const labels = Object.values(updates).map(u => u.label);
  const detailLines = Object.values(updates).map(u => `${u.label}: v${u.version || '?'} → v${u.current}`);
  const title = labels.join('、') + ' 有新版本可用';

  if (!hasForce) {
    Notification.info({
      id: 'component-update',
      title,
      content: detailLines.join('  |  '),
      duration: 20000,
      closable: true,
      position: 'topRight',
    });
  }

  envStopMode.value = 'update';
  appState.value = 'env-check';
};

// 一键安装并启动（VersionInstallAndUpdate 组件完成安装后通过 @all-completed/@continue 触发）
const handleContinue = async () => {
  console.log('[handleContinue] 启动应用...');
  operationLoading.value = true;
  
  try {
    const newStatus = await quickEnvCheck();
    envStatus.value = newStatus;
    openclawConfig.value = await window.electronAPI?.readConfig?.() || {};
    
    const envOk = newStatus.nodejs.installed && newStatus.openclaw.installed;
    if (envOk) {
      openClawInstalled.value = true;
      
      // 检测是否已运行
      if (typeof newStatus.run === 'boolean') {
        openClawRunning.value = newStatus.run;
        if (newStatus.run) {
          const gatewayPort = openclawConfig.value?.gateway?.port || 18789;
          wsManager.setGatewayPort(gatewayPort);
          const token = openclawConfig.value?.gateway?.auth?.token || '';
          wsManager.connect({ agentId: 'main', token, sessionKey: null }).catch(() => {});
        }
      } else {
        const canConnect = await testWebSocketConnection();
        openClawRunning.value = canConnect;
      }
      
      appState.value = 'ready';
      Message.success('启动成功！');
    } else {
      Message.warning('部分组件未安装成功');
    }
  } catch (error) {
    console.error('[App] 启动失败:', error);
    Message.error('启动失败: ' + error.message);
  } finally {
    operationLoading.value = false;
  }
};

const handleSkipUpdate = async () => {
  componentUpdateDismissed.value = true;
  envStopMode.value = null;
  const newStatus = await quickEnvCheck();
  envStatus.value = newStatus;
  const envOk = newStatus.nodejs.installed && newStatus.openclaw.installed;
  if (envOk) {
    openClawInstalled.value = true;
    openclawConfig.value = await window.electronAPI?.readConfig?.() || {};
    if (typeof newStatus.run === 'boolean') {
      openClawRunning.value = newStatus.run;
    } else {
      openClawRunning.value = await testWebSocketConnection();
    }
    appState.value = 'ready';
  } else {
    appState.value = 'env-check';
  }
};
const toggleGatewayStatus = () => {};

// 菜单点击
const handleMenuClick = (key) => router.push({ name: key });

// 显示关于
const showAbout = () => {
  Message.info({ content: '龙虾壳-DragonClaw v1.0.0\nOpenClaw 图形客户端', duration: 4000 });
};

// 打开关于弹窗
const openAboutModal = () => {
  if (aboutModalRef.value) {
    aboutModalRef.value.open();
  }
};

// ========== 远程模式配置 ==========
function handleMenuModeChange(event) {
  const mode = event.detail;
  if (mode === 'remote') {
    openRemoteConfigModal();
  } else if (mode === 'local') {
    // 已经是本机模式，无需切换
    if (modeStore.mode === 'local') {
      Message.info('当前模式为本机模式，无需切换');
      return;
    }
    localConfirmModalVisible.value = true;
  }
}

function openRemoteConfigModal() {
  remoteConfigForm.value = {
    ip: modeStore.remoteConfig.ip || '',
    port: modeStore.remoteConfig.port || 18789,
    authMethod: modeStore.remoteConfig.authMethod || 'token',
    token: modeStore.remoteConfig.token || '',
    password: '',  // 密码不从存储加载
  };
  remoteConfigTestResult.value = null;
  remoteConfigModalVisible.value = true;
}

function confirmSwitchToLocal() {
  localConfirmModalVisible.value = false;
  modeStore.setLocalMode();
  wsManager.setMode('local');
  wsManager.disconnect(1000);
  setTimeout(async () => {
    try {
      await wsManager.connect({ agentId: 'main', sessionKey: null });
    } catch (e) {
      console.warn('[App] 本机重连失败:', e);
    }
  }, 500);
  Message.success('已切换到本机模式');
}

async function testRemoteConnection() {
  if (!remoteConfigFormRef.value) return;
  const errors = await remoteConfigFormRef.value.validate?.();
  if (errors) { remoteConfigTestResult.value = { success: false, message: '请填写正确的表单' }; return; }
  remoteConfigTesting.value = true;
  remoteConfigTestResult.value = null;
  const { ip, port, authMethod, token } = remoteConfigForm.value;

  // 根据认证方式构建 URL
  let tokenPart = '';
  if (authMethod === 'token' && token) {
    tokenPart = `?token=${encodeURIComponent(token)}`;
  }
  const testUrl = `ws://${ip}:${port}${tokenPart}`;

  console.log('[testRemoteConnection] ===== 开始测试远程连接 =====');
  console.log('[testRemoteConnection] 配置:', { ip, port, authMethod, hasToken: !!token, tokenLen: token?.length });
  console.log('[testRemoteConnection] 目标 URL:', testUrl);
  console.log('[testRemoteConnection] navigator.onLine =', navigator.onLine);
  console.log('[testRemoteConnection] location:', { protocol: location.protocol, host: location.host, href: location.href });

  try {
    const connected = await new Promise((resolve) => {
      console.log('[testRemoteConnection] 准备 new WebSocket()...');
      let ws;
      try {
        ws = new WebSocket(testUrl);
      } catch (e) {
        console.error('[testRemoteConnection] new WebSocket() 抛同步异常:', e);
        resolve(false);
        return;
      }
      console.log('[testRemoteConnection] WebSocket 已创建，readyState =', ws.readyState);
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[testRemoteConnection] 6 秒超时，关闭连接');
          try { ws.close(); } catch {}
          resolve(false);
        }
      }, 6000);
      ws.onopen = (event) => {
        console.log('[testRemoteConnection] ✅ onopen 触发，readyState =', ws.readyState, event);
      };
      ws.onmessage = (event) => {
        console.log('[testRemoteConnection] onmessage:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'event' && data.event === 'connect.challenge') {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              ws.close();
              resolve(true);
            }
          }
        } catch (e) {
          console.warn('[testRemoteConnection] 解析 message 失败:', e);
        }
      };
      ws.onerror = (event) => {
        console.error('[testRemoteConnection] ❌ onerror 触发，event =', event, 'readyState =', ws.readyState);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
      ws.onclose = (event) => {
        console.log('[testRemoteConnection] onclose 触发，code =', event.code, 'reason =', event.reason, 'wasClean =', event.wasClean, 'readyState =', ws.readyState);
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
    });
    if (connected) remoteConfigTestResult.value = { success: true, message: `连接成功！服务器 ${ip}:${port} 响应正常` };
    else remoteConfigTestResult.value = { success: false, message: `无法连接到 ${ip}:${port}，请检查 IP、端口和认证信息` };
  } catch (e) { remoteConfigTestResult.value = { success: false, message: `连接失败：${e.message || '未知错误'}` }; }
  finally { remoteConfigTesting.value = false; }
}

async function saveRemoteConfigAndConnect() {
  if (!remoteConfigFormRef.value) return;
  const errors = await remoteConfigFormRef.value.validate?.();
  if (errors) return;
  remoteConfigSaving.value = true;
  remoteWsConnecting.value = true;
  remoteConfigTestResult.value = null;
  try {
    const config = { ...remoteConfigForm.value };
    // 先切换模式（触发 App.vue 的 watch，watch 会调用 connectRemoteWs）
    modeStore.setRemoteMode(config);
    // 等待远程连接成功（watch 中的 subscribe 会收到 hello-ok 并设置 remoteReady）
    let waited = 0;
    console.log('[App] saveRemoteConfigAndConnect: 等待远程连接 remoteReady...');
    while (!remoteReady.value && waited < 20000) {
      await new Promise(r => setTimeout(r, 200));
      waited += 200;
      if (waited % 1000 === 0) console.log('[App] wait remoteReady:', waited, 'ms, remoteReady=', remoteReady.value);
    }
    console.log('[App] saveRemoteConfigAndConnect: 等待结束，remoteReady=', remoteReady.value);
    if (remoteReady.value) {
      remoteConfigModalVisible.value = false;
      Message.success(`已切换到远程模式：${config.ip}:${config.port}`);
    } else {
      // 超时
      remoteConfigTestResult.value = { success: false, message: '连接超时，请检查网络或地址是否正确' };
      modeStore.setLocalMode();
    }
  } catch (e) { Message.error(`切换失败：${e.message || '连接远程服务器失败'}`); modeStore.setLocalMode(); }
  finally { remoteWsConnecting.value = false; remoteConfigSaving.value = false; }
}

function cancelRemoteConfig() { remoteConfigModalVisible.value = false; remoteConfigTestResult.value = null; }
// ========== 远程模式配置 结束 ==========

// 监听 Gateway 状态变化
const onGatewayChanged = (e) => {
  if (e.detail?.status === 'connected') openClawRunning.value = true;
};

// 重新连接远程（侧边栏重连按钮）
const handleReconnectRemote = async () => {
  window._remoteWsReady = false;
  remoteWsConnecting.value = true;
  remoteWsConnected.value = false;
  remoteReady.value = false;
  const { ip, port, authMethod, token, password } = modeStore.remoteConfig;
  wsManager.setMode('remote', { ip, port, token, password, authMethod });
  wsManager.disconnect(1000);
  await new Promise(r => setTimeout(r, 500));
  wsManager.connect({ agentId: 'main', token: authMethod === 'token' ? token : '', sessionKey: null }).catch(() => {});
};

let componentUpdateUnsub = null;

// 生命周期
onMounted(async () => {
  const instance = getCurrentInstance();
  if (instance?.appContext) {
    Notification._context = instance.appContext;
  }

  await modeStore.loadFromStorage();
  await initApp();
  window.addEventListener('gateway-status-changed', onGatewayChanged);
  window.addEventListener('menu-mode-change', handleMenuModeChange);
  window.addEventListener('open-about-modal', openAboutModal);

  componentUpdateUnsub = eventsApi.onComponentUpdate((data) => {
    onComponentUpdateAvailable(data);
  });
});

onUnmounted(() => {
  window.removeEventListener('gateway-status-changed', onGatewayChanged);
  window.removeEventListener('menu-mode-change', handleMenuModeChange);
  window.removeEventListener('open-about-modal', openAboutModal);
  if (typeof componentUpdateUnsub === 'function') componentUpdateUnsub();
});

defineExpose({});
</script>

<style scoped src="./App.scss"></style>
