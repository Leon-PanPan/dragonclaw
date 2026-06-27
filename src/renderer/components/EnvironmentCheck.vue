<template>
  <a-layout class="env-check-layout">
    <a-layout-content class="env-check-content">
      <div class="env-check-container">
        <!-- 标题 -->
        <div class="env-check-header">
          <icon-environment size="48" style="color: var(--primary-color);" />
          <h2>环境自检</h2>
          <p class="subtitle">正在检测系统环境，请稍候...</p>
        </div>

        <!-- 环境状态卡片 -->
        <div class="env-cards">
          <!-- Node.js -->
          <div class="env-card" :class="{ 'card-success': envStatus.nodejs.installed, 'card-error': !envStatus.nodejs.installed }">
            <div class="card-icon">
              <icon-check-circle v-if="envStatus.nodejs.installed" style="color: #00b42a; font-size: 32px;" />
              <icon-close-circle v-else style="color: #f53f3f; font-size: 32px;" />
            </div>
            <div class="card-info">
              <div class="card-title">Node.js <span class="version" v-if="envStatus.nodejs.version">{{ envStatus.nodejs.version }}</span></div>
              <div class="card-status">{{ envStatus.nodejs.installed ? '已安装' : '未安装' }}</div>
            </div>
          </div>

          <!-- npm -->
          <div class="env-card" :class="{ 'card-success': envStatus.npm.installed, 'card-error': !envStatus.npm.installed }">
            <div class="card-icon">
              <icon-check-circle v-if="envStatus.npm.installed" style="color: #00b42a; font-size: 32px;" />
              <icon-close-circle v-else style="color: #f53f3f; font-size: 32px;" />
            </div>
            <div class="card-info">
              <div class="card-title">npm <span class="version" v-if="envStatus.npm.version">{{ envStatus.npm.version }}</span></div>
              <div class="card-status">{{ envStatus.npm.installed ? '已安装' : '未安装' }}</div>
            </div>
          </div>

          <!-- OpenClaw -->
          <div class="env-card" :class="{ 'card-success': envStatus.openclaw.installed, 'card-error': !envStatus.openclaw.installed }">
            <div class="card-icon">
              <icon-check-circle v-if="envStatus.openclaw.installed" style="color: #00b42a; font-size: 32px;" />
              <icon-close-circle v-else style="color: #f53f3f; font-size: 32px;" />
            </div>
            <div class="card-info">
              <div class="card-title">OpenClaw 小龙虾 <span class="version" v-if="envStatus.openclaw.version">{{ envStatus.openclaw.version }}</span></div>
              <div class="card-status">{{ envStatus.openclaw.installed ? '已安装' : '未安装' }}</div>
            </div>
          </div>
        </div>

        <!-- Gateway 状态 -->
        <div class="gateway-status" v-if="envStatus.openclaw.installed">
          <div class="gateway-card" :class="{ 'card-success': gatewayRunning, 'card-warning': !gatewayRunning }">
            <div class="card-icon">
              <icon-check-circle v-if="gatewayRunning" style="color: #00b42a; font-size: 24px;" />
              <icon-pause-circle v-else style="color: #ff7d00; font-size: 24px;" />
            </div>
            <div class="card-info">
              <div class="card-title">Gateway 服务</div>
              <div class="card-status">{{ gatewayRunning ? '运行中' : '未启动' }}</div>
            </div>
          </div>
        </div>

        <!-- 命令行输出区域 -->
        <div class="command-output" v-if="commandOutput">
          <div class="output-header">
            <span>执行日志</span>
            <a-button type="text" size="mini" @click="commandOutput = ''">
              <icon-close />
            </a-button>
          </div>
          <pre class="output-content">{{ commandOutput }}</pre>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <template v-if="allInstalled && !gatewayRunning">
            <a-button type="primary" size="large" :loading="operationLoading" @click="handleStart">
              <template #icon>
                <icon-play-fill v-if="!operationLoading" />
              </template>
              {{ operationLoading ? '启动中...' : '启动 Gateway' }}
            </a-button>
          </template>
          <template v-else-if="allInstalled && gatewayRunning">
            <a-button type="primary" size="large" @click="handleContinue">
              <template #icon>
                <icon-check-circle />
              </template>
              继续使用
            </a-button>
          </template>
          <template v-else>
            <a-button type="primary" size="large" :loading="operationLoading" @click="handleFix">
              <template #icon>
                <icon-tool v-if="!operationLoading" />
              </template>
              {{ operationLoading ? '修复中...' : '修复环境' }}
            </a-button>
          </template>
          
          <a-button v-if="showCloseBtn" type="text" @click="$emit('close')">
            关闭
          </a-button>
        </div>

        <!-- 全局 Loading 遮罩 -->
        <div v-if="checking" class="global-loading">
          <a-spin size="large">
            <template #icon>
              <icon-loading />
            </template>
          </a-spin>
          <p>环境检测中...</p>
        </div>
      </div>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { systemApi, gatewayApi } from '@/api/gateway';
import { platform } from '@/core/ipc';

const props = defineProps({
  // 是否显示关闭按钮
  showCloseBtn: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close', 'ready']);

// 状态
const envStatus = ref({
  nodejs: { installed: false, version: '' },
  npm: { installed: false, version: '' },
  openclaw: { installed: false, version: '' }
});

const gatewayRunning = ref(false);
const checking = ref(true);
const operationLoading = ref(false);
const commandOutput = ref('');

// 计算属性
const allInstalled = computed(() => {
  return envStatus.value.nodejs.installed && 
         envStatus.value.npm.installed && 
         envStatus.value.openclaw.installed;
});

const hasIssues = computed(() => {
  return !envStatus.value.nodejs.installed || 
         !envStatus.value.npm.installed || 
         !envStatus.value.openclaw.installed;
});

// 静默检查环境（不显示弹窗）
const silentCheck = async () => {
  checking.value = true;
  
  try {
    const result = await systemApi.envCheck();
    envStatus.value = result;
    
    const status = await gatewayApi.checkRunning();
    gatewayRunning.value = status.running;
  } catch (error) {
    console.error('环境检测失败:', error);
  }
  
  checking.value = false;
};

// 执行命令并捕获输出
const runCommand = async (command) => {
  commandOutput.value += `$ ${command}\n`;
  
  try {
    const result = await systemApi.executeCommand(command);
    if (result.stdout) {
      commandOutput.value += result.stdout + '\n';
    }
    if (result.stderr) {
      commandOutput.value += result.stderr + '\n';
    }
    if (result.success) {
      commandOutput.value += `✓ 命令执行成功\n`;
      return true;
    } else {
      commandOutput.value += `✗ 命令执行失败: ${result.error}\n`;
      return false;
    }
  } catch (error) {
    commandOutput.value += `✗ 执行错误: ${error.message}\n`;
    return false;
  }
};

// 安装 Node.js
const installNodeJS = async () => {
  commandOutput.value += `\n=== 开始安装 Node.js ===\n`;
  
  const p = platform;
  
  let command = '';
  if (p === 'win32') {
    command = 'winget install OpenJS.NodeJS';
  } else if (p === 'darwin') {
    command = 'brew install node';
  } else {
    command = 'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs';
  }
  
  return await runCommand(command);
};

// 安装 OpenClaw
const installOpenClaw = async () => {
  commandOutput.value += `\n=== 开始安装 OpenClaw ===\n`;
  
  // 先设置镜像
  await runCommand('npm config set registry https://registry.npmmirror.com');
  await runCommand('npm install -g openclaw');
  
  // 初始化
  commandOutput.value += `\n=== 初始化 OpenClaw ===\n`;
  await runCommand('openclaw init --skip-wizard');
  
  return true;
};

// 修复环境
const handleFix = async () => {
  operationLoading.value = true;
  commandOutput.value = '';
  
  try {
    if (!envStatus.value.nodejs.installed) {
      await installNodeJS();
      // 重新检测
      await silentCheck();
    }
    
    if (!envStatus.value.npm.installed) {
      // npm 通常随 Node.js 一起安装
      await silentCheck();
    }
    
    if (!envStatus.value.openclaw.installed) {
      await installOpenClaw();
      // 重新检测
      await silentCheck();
    }
    
    if (allInstalled.value) {
      Message.success('环境修复完成！');
    } else {
      Message.warning('部分环境未修复成功，请手动安装');
    }
  } catch (error) {
    Message.error(`修复失败: ${error.message}`);
  } finally {
    operationLoading.value = false;
  }
};

// 启动 Gateway
const handleStart = async () => {
  operationLoading.value = true;
  commandOutput.value = '$ openclaw gateway start\n';
  
  try {
    const result = await gatewayApi.start();
    if (result.output) {
      commandOutput.value += result.output + '\n';
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const status = await gatewayApi.checkRunning();
    gatewayRunning.value = status.running;
    
    if (gatewayRunning.value) {
      Message.success('Gateway 启动成功！');
      setTimeout(() => {
        emit('ready', { gatewayRunning: true });
      }, 1000);
    } else {
      Message.warning('Gateway 可能未正常启动，请检查状态');
    }
  } catch (error) {
    Message.error(`启动失败: ${error.message}`);
    commandOutput.value += `\n✗ 启动失败: ${error.message}\n`;
  } finally {
    operationLoading.value = false;
  }
};

// 继续使用
const handleContinue = () => {
  emit('ready', { gatewayRunning: true });
};

// 生命周期
onMounted(async () => {
  await silentCheck();
  
  // 如果环境检测通过，自动触发继续
  if (allInstalled.value && gatewayRunning.value) {
    setTimeout(() => {
      emit('ready', { gatewayRunning: true });
    }, 500);
  }
});

// 暴露方法
defineExpose({
  silentCheck,
  refreshStatus: silentCheck
});
</script>

<style scoped>
.env-check-layout {
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.env-check-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.env-check-container {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
}

.env-check-header {
  text-align: center;
  margin-bottom: 32px;
}

.env-check-header h2 {
  font-size: 28px;
  font-weight: bold;
  margin: 16px 0 8px;
  color: #1a1a1a;
}

.env-check-header .subtitle {
  color: #666;
  font-size: 14px;
}

.env-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.env-card {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-radius: 12px;
  border: 2px solid #e5e5e5;
  transition: all 0.2s;
}

.env-card.card-success {
  border-color: #00b42a;
  background: rgba(0, 180, 42, 0.05);
}

.env-card.card-error {
  border-color: #f53f3f;
  background: rgba(245, 63, 63, 0.05);
}

.card-icon {
  margin-right: 16px;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.card-title .version {
  font-size: 12px;
  color: #666;
  font-weight: normal;
  margin-left: 8px;
}

.card-status {
  font-size: 13px;
  color: #666;
  margin-top: 2px;
}

.gateway-status {
  margin-bottom: 24px;
}

.gateway-card {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #e5e5e5;
}

.gateway-card.card-success {
  border-color: #00b42a;
  background: rgba(0, 180, 42, 0.05);
}

.gateway-card.card-warning {
  border-color: #ff7d00;
  background: rgba(255, 125, 0, 0.05);
}

.command-output {
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 24px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2a2a2a;
  color: #999;
  font-size: 12px;
}

.output-content {
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #0f0;
  max-height: 150px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.action-buttons .arco-btn {
  width: 100%;
}

.global-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  z-index: 10;
}

.global-loading p {
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
