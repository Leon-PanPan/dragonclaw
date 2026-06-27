<template>
  <div class="install-guide">
    <!-- 顶部标题 -->
    <div class="guide-header">
      <h1 class="guide-title">
        <icon-rocket style="color: var(--primary-color); font-size: 32px;" />
        OpenClaw 安装向导
      </h1>
      <p class="guide-description">
        欢迎使用龙虾壳-DragonClaw图形客户端！我们将引导您完成OpenClaw的安装和配置。
      </p>
    </div>

    <!-- 步骤指示器 -->
    <div class="step-indicator">
      <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
        <div class="step-number">1</div>
        <div class="step-info">
          <div class="step-title">环境检查</div>
          <div class="step-desc">检查Node.js和依赖</div>
        </div>
      </div>
      <div class="step-connector" :class="{ active: currentStep > 1 }"></div>
      <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
        <div class="step-number">2</div>
        <div class="step-info">
          <div class="step-title">clawhub登录</div>
          <div class="step-desc">登录技能仓库</div>
        </div>
      </div>
      <div class="step-connector" :class="{ active: currentStep > 2 }"></div>
      <div class="step" :class="{ active: currentStep === 3, completed: currentStep > 3 }">
        <div class="step-number">3</div>
        <div class="step-info">
          <div class="step-title">安装OpenClaw</div>
          <div class="step-desc">安装核心组件</div>
        </div>
      </div>
      <div class="step-connector" :class="{ active: currentStep > 3 }"></div>
      <div class="step" :class="{ active: currentStep === 4 }">
        <div class="step-number">4</div>
        <div class="step-info">
          <div class="step-title">完成配置</div>
          <div class="step-desc">验证和启动</div>
        </div>
      </div>
    </div>

    <!-- 步骤内容区域 -->
    <div class="step-content">
      <!-- 步骤1：环境检查 -->
      <div v-if="currentStep === 1" class="step-panel">
        <h2 class="panel-title">环境检查</h2>
        <p class="panel-description">
          我们将检查您的系统是否满足安装要求。以下是必需的组件：
        </p>
        
        <div class="check-list">
          <div class="check-item" v-for="check in environmentChecks" :key="check.id">
            <div class="check-icon">
              <icon-check-circle v-if="check.status === 'passed'" style="color: #00b42a; font-size: 20px;" />
              <icon-close-circle v-else-if="check.status === 'failed'" style="color: #f53f3f; font-size: 20px;" />
              <icon-loading v-else style="color: #86909c; font-size: 20px;" />
            </div>
            <div class="check-details">
              <div class="check-name">{{ check.name }}</div>
              <div class="check-status" :class="check.status">
                {{ getStatusText(check.status) }}
              </div>
              <div class="check-message" v-if="check.message">{{ check.message }}</div>
            </div>
            <div class="check-action" v-if="check.status === 'failed' && check.action">
              <a-button size="mini" @click="executeFix(check.id)">
                {{ check.action }}
              </a-button>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <a-button type="primary" @click="checkEnvironment" :loading="checkingEnvironment">
            <template #icon>
              <icon-search />
            </template>
            开始检查
          </a-button>
          <a-button @click="currentStep = 2" :disabled="!environmentPassed">
            跳过，下一步
          </a-button>
        </div>
      </div>

      <!-- 步骤2：clawhub登录 -->
      <div v-if="currentStep === 2" class="step-panel">
        <h2 class="panel-title">clawhub登录</h2>
        <p class="panel-description">
          clawhub是OpenClaw的技能仓库，您需要登录才能安装和管理技能。
        </p>
        
        <div class="login-info">
          <div class="info-card">
            <icon-user style="font-size: 24px; color: var(--primary-color);" />
            <h3>为什么需要登录？</h3>
            <ul>
              <li>访问丰富的技能库</li>
              <li>同步已安装的技能列表</li>
              <li>接收技能更新通知</li>
              <li>保存个人配置和偏好</li>
            </ul>
          </div>
          
          <div class="info-card">
            <icon-safety style="font-size: 24px; color: var(--primary-color);" />
            <h3>登录流程</h3>
            <ol>
              <li>点击"开始登录"按钮</li>
              <li>终端会打开clawhub登录界面</li>
              <li>按照提示输入凭据或扫描二维码</li>
              <li>等待登录完成</li>
            </ol>
          </div>
        </div>

        <div class="login-status" v-if="loginResult">
          <div class="status-message" :class="{ success: loginResult.success, error: !loginResult.success }">
            <icon-check-circle v-if="loginResult.success" />
            <icon-close-circle v-else />
            {{ loginResult.message }}
          </div>
          <pre v-if="loginResult.output" class="login-output">{{ loginResult.output }}</pre>
        </div>

        <div class="panel-footer">
          <a-button @click="currentStep = 1">
            上一步
          </a-button>
          <a-button type="primary" @click="startClawhubLogin" :loading="loggingIn">
            <template #icon>
              <icon-user />
            </template>
            开始登录
          </a-button>
          <a-button @click="currentStep = 3" :disabled="!loginResult?.success">
            跳过，下一步
          </a-button>
        </div>
      </div>

      <!-- 步骤3：安装OpenClaw -->
      <div v-if="currentStep === 3" class="step-panel">
        <h2 class="panel-title">安装OpenClaw</h2>
        <p class="panel-description">
          现在开始安装OpenClaw核心组件。请选择安装方式：
        </p>
        
        <div class="install-options">
          <div class="option-card" :class="{ selected: installMethod === 'npm' }" @click="installMethod = 'npm'">
            <div class="option-icon">
              <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzNDMDcyMiIgZD0iTTAgMGgyNHYyNEgweiIvPjwvc3ZnPg==" alt="npm" style="width: 32px; height: 32px;" />
            </div>
            <div class="option-info">
              <h3>npm安装</h3>
              <p>使用npm包管理器安装（推荐）</p>
              <code class="install-command">npm install -g openclaw</code>
            </div>
          </div>
          
          <div class="option-card" :class="{ selected: installMethod === 'yarn' }" @click="installMethod = 'yarn'">
            <div class="option-icon">
              <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzJDMUI4RiIgZD0iTTAsMHYyNGgyNFYwSDB6IE0xNiw4LjFjLTAuOS0xLjQtMi4zLTIuMi0zLjgtMi4yYy0yLjUsMC00LjYsMS45LTQuOSw0LjJIMnYzaDMuNGMwLjYsMS45LDIuMiwzLjMsNC4xLDMuM2MxLjUsMCwyLjktMC43LDMuOC0yLjJjMC45LTEuNCwwLjktMy4xLDAtNC41Yy0wLjktMS40LTIuMy0yLjItMy44LTIuMmMtMS45LDAtMy42LDEuMy00LjEsMy4xSDVWOS4xYzAuMy0xLjksMS44LTMuNSwzLjctMy41YzEuNSwwLDIuOSwwLjcsMy44LDIuMmMwLjksMS40LDAuOSwzLjEsMCw0LjVjLTAuOSwxLjQtMi4zLDIuMi0zLjgsMi4yYy0wLjUsMC0wLjksMC0xLjQtMC4xdjNoMS40YzIuNCwwLDQuNC0yLDQuNC00LjRjMC0xLjYtMC44LTIuOS0yLjEtMy43aDQuMnYtMUgxNlY4LjF6Ii8+PC9zdmc+" alt="yarn" style="width: 32px; height: 32px;" />
            </div>
            <div class="option-info">
              <h3>yarn安装</h3>
              <p>使用yarn包管理器安装</p>
              <code class="install-command">yarn global add openclaw</code>
            </div>
          </div>
        </div>

        <div class="install-progress" v-if="installing">
          <div class="progress-header">
            <span>安装进度</span>
            <span>{{ installProgress }}%</span>
          </div>
          <a-progress :percent="installProgress" :status="installError ? 'error' : 'normal'" />
          <div class="progress-output" v-if="installOutput">
            <pre>{{ installOutput }}</pre>
          </div>
        </div>

        <div class="panel-footer">
          <a-button @click="currentStep = 2">
            上一步
          </a-button>
          <a-button type="primary" @click="startInstallOpenClaw" :loading="installing" :disabled="!installMethod">
            <template #icon>
              <icon-download />
            </template>
            开始安装
          </a-button>
          <a-button @click="currentStep = 4" :disabled="!installComplete">
            跳过，下一步
          </a-button>
        </div>
      </div>

      <!-- 步骤4：完成配置 -->
      <div v-if="currentStep === 4" class="step-panel">
        <h2 class="panel-title">完成配置</h2>
        <p class="panel-description">
          恭喜！OpenClaw已安装完成。现在进行最后的配置验证。
        </p>
        
        <div class="completion-summary">
          <div class="completion-item" v-for="item in completionStatus" :key="item.id">
            <div class="completion-icon">
              <icon-check-circle v-if="item.status" style="color: #00b42a; font-size: 20px;" />
              <icon-close-circle v-else style="color: #f53f3f; font-size: 20px;" />
            </div>
            <div class="completion-details">
              <div class="completion-name">{{ item.name }}</div>
              <div class="completion-message">{{ item.message }}</div>
            </div>
          </div>
        </div>

        <div class="final-actions">
          <div class="action-card" v-if="configCheck.passed">
            <h3>🎉 安装成功！</h3>
            <p>OpenClaw已经准备就绪。您可以：</p>
            <div class="action-buttons">
              <a-button type="primary" @click="finishSetup">
                <template #icon>
                  <icon-rocket />
                </template>
                启动应用
              </a-button>
              <a-button @click="restartWizard">
                <template #icon>
                  <icon-settings />
                </template>
                重新配置
              </a-button>
            </div>
          </div>
          <div class="action-card" v-else>
            <h3>⚠️ 需要手动配置</h3>
            <p>检测到配置问题，请检查：</p>
            <ul>
              <li v-for="issue in configCheck.issues" :key="issue">{{ issue }}</li>
            </ul>
            <div class="action-buttons">
              <a-button type="primary" @click="checkConfig">
                <template #icon>
                  <icon-refresh />
                </template>
                重新检查
              </a-button>
              <a-button @click="restartWizard">
                <template #icon>
                  <icon-backward />
                </template>
                返回开始
              </a-button>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <a-button @click="currentStep = 3">
            上一步
          </a-button>
          <a-button @click="restartWizard">
            重新开始
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { envApi, systemApi, skillApi, configApi } from '@/api/gateway';

// 步骤状态
const currentStep = ref(1);

// 步骤1：环境检查
const environmentChecks = ref([
  { id: 'nodejs', name: 'Node.js', status: 'pending', message: '等待检查...', action: '安装Node.js' },
  { id: 'npm', name: 'npm', status: 'pending', message: '等待检查...', action: '更新npm' },
  { id: 'clawhub', name: 'clawhub CLI', status: 'pending', message: '等待检查...', action: '安装clawhub' },
  { id: 'network', name: '网络连接', status: 'pending', message: '等待检查...', action: '检查网络' },
]);
const checkingEnvironment = ref(false);
const environmentPassed = computed(() => 
  environmentChecks.value.every(check => check.status === 'passed' || check.id === 'clawhub')
);

// 步骤2：clawhub登录
const loggingIn = ref(false);
const loginResult = ref(null);

// 步骤3：安装OpenClaw
const installMethod = ref('npm');
const installing = ref(false);
const installProgress = ref(0);
const installOutput = ref('');
const installComplete = ref(false);
const installError = ref(false);

// 步骤4：完成配置
const completionStatus = ref([
  { id: 'openclaw', name: 'OpenClaw核心', status: false, message: '检查中...' },
  { id: 'config', name: '配置文件', status: false, message: '检查中...' },
  { id: 'skills', name: '技能目录', status: false, message: '检查中...' },
  { id: 'permissions', name: '权限验证', status: false, message: '检查中...' },
]);
const configCheck = ref({
  passed: false,
  issues: [],
});

// 工具函数
const getStatusText = (status) => {
  switch (status) {
    case 'passed': return '通过';
    case 'failed': return '失败';
    case 'pending': return '待检查';
    default: return '未知';
  }
};

// 步骤1：检查环境
const checkEnvironment = async () => {
  checkingEnvironment.value = true;
  
  // 模拟检查过程
  for (const check of environmentChecks.value) {
    check.status = 'pending';
    check.message = '正在检查...';
    
    try {
      // 调用主进程API检查环境
      if (window.electronAPI) {
        const result = await envApi.check();
        
        // 根据结果更新状态
        const itemResult = result[check.id];
        if (itemResult) {
          check.status = itemResult.success ? 'passed' : 'failed';
          check.message = itemResult.message || (itemResult.success ? '检查通过' : '检查失败');
        }
      } else {
        // 模拟API不可用时的默认结果
        await new Promise(resolve => setTimeout(resolve, 800));
        check.status = Math.random() > 0.3 ? 'passed' : 'failed';
        check.message = check.status === 'passed' 
          ? `${check.name} 检测正常` 
          : `${check.name} 未安装或版本过低`;
      }
    } catch (error) {
      check.status = 'failed';
      check.message = `检查失败: ${error.message}`;
    }
  }
  
  checkingEnvironment.value = false;
  
  // 如果有失败项，显示提示
  const failedChecks = environmentChecks.value.filter(c => c.status === 'failed');
  if (failedChecks.length > 0) {
    Message.warning(`有 ${failedChecks.length} 项检查未通过，建议修复后再继续。`);
  } else {
    Message.success('环境检查全部通过！');
  }
};

// 修复环境问题
const executeFix = async (checkId) => {
  const check = environmentChecks.value.find(c => c.id === checkId);
  if (!check) return;
  
  Message.loading({ content: `正在修复 ${check.name}...`, duration: 0 });
  
  try {
    // 调用主进程执行修复
    if (window.electronAPI) {
      let command = '';
      switch (checkId) {
        case 'nodejs':
          command = 'echo "请访问 https://nodejs.org 下载并安装Node.js"';
          break;
        case 'npm':
          command = 'npm install -g npm@latest';
          break;
        case 'clawhub':
          command = 'npm install -g clawhub';
          break;
        case 'network':
          command = 'ping -n 2 api.dragonclaw.cc';
          break;
      }
      
      const result = await systemApi.executeCommand(command);
      
      if (result.success) {
        check.status = 'passed';
        check.message = '修复成功，请重新检查';
        Message.success(`${check.name} 修复成功！`);
      } else {
        Message.error(`修复失败: ${result.error}`);
      }
    } else {
      // 模拟修复
      await new Promise(resolve => setTimeout(resolve, 1500));
      check.status = 'passed';
      check.message = '模拟修复完成，请重新检查';
      Message.success(`${check.name} 修复完成！`);
    }
  } catch (error) {
    Message.error(`修复失败: ${error.message}`);
  }
};

// 步骤2：clawhub登录
const startClawhubLogin = async () => {
  loggingIn.value = true;
  loginResult.value = null;
  
  try {
      if (window.electronAPI) {
      const result = await skillApi.clawhubLogin();
      loginResult.value = result;
      
      if (result.success) {
        Message.success('clawhub登录成功！');
      } else {
        Message.error(`登录失败: ${result.message}`);
      }
    } else {
      // 模拟登录过程
      await new Promise(resolve => setTimeout(resolve, 3000));
      loginResult.value = {
        success: Math.random() > 0.2,
        message: Math.random() > 0.2 ? '登录成功！' : '登录失败，请检查网络和凭据',
        output: '模拟登录输出...\n请访问 https://clawhub.ai 获取访问令牌'
      };
      
      if (loginResult.value.success) {
        Message.success('模拟登录成功！');
      } else {
        Message.error('模拟登录失败');
      }
    }
  } catch (error) {
    Message.error(`登录过程中出错: ${error.message}`);
    loginResult.value = {
      success: false,
      message: `错误: ${error.message}`,
      output: error.stack
    };
  } finally {
    loggingIn.value = false;
  }
};

// 步骤3：安装OpenClaw
const startInstallOpenClaw = async () => {
  installing.value = true;
  installProgress.value = 0;
  installOutput.value = '';
  installError.value = false;
  installComplete.value = false;
  
  try {
      if (window.electronAPI) {
      const result = await envApi.installOpenClaw(installMethod.value);
      
      // 模拟进度更新
      const interval = setInterval(() => {
        if (installProgress.value < 90) {
          installProgress.value += 10;
        }
      }, 500);
      
      // 等待安装完成
      await new Promise(resolve => setTimeout(resolve, 3000));
      clearInterval(interval);
      
      if (result.success) {
        installProgress.value = 100;
        installOutput.value = result.output || '安装成功！';
        installComplete.value = true;
        Message.success('OpenClaw安装成功！');
      } else {
        installError.value = true;
        installOutput.value = result.error || result.output || '安装失败';
        Message.error(`安装失败: ${result.error || '未知错误'}`);
      }
    } else {
      // 模拟安装过程
      installOutput.value = '开始模拟安装...\n';
      
      const commands = [
        `正在使用 ${installMethod.value} 安装...`,
        '下载包文件...',
        '解析依赖...',
        '构建二进制文件...',
        '安装到全局...',
        '配置环境变量...',
      ];
      
      for (let i = 0; i < commands.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        installProgress.value = Math.min(100, Math.round(((i + 1) / commands.length) * 90));
        installOutput.value += `${commands[i]}\n`;
      }
      
      // 最后一步
      await new Promise(resolve => setTimeout(resolve, 1000));
      installProgress.value = 100;
      installComplete.value = true;
      installOutput.value += '\n✅ 安装成功！';
      Message.success('模拟安装完成！');
    }
  } catch (error) {
    installError.value = true;
    installProgress.value = 100;
    installOutput.value = `安装失败: ${error.message}`;
    Message.error(`安装过程中出错: ${error.message}`);
  } finally {
    installing.value = false;
  }
};

// 步骤4：检查配置
const checkConfig = async () => {
  Message.loading({ content: '正在检查配置...', duration: 0 });
  
  try {
      if (window.electronAPI) {
      const result = await configApi.check();
      
      completionStatus.value.forEach(item => {
        const itemResult = result[item.id];
        if (itemResult) {
          item.status = itemResult.success || false;
          item.message = itemResult.message || (itemResult.success ? '正常' : '异常');
        }
      });
      
      configCheck.value.passed = result.passed || false;
      configCheck.value.issues = result.issues || [];
      
      if (configCheck.value.passed) {
        Message.success('配置检查通过！');
      } else {
        Message.warning(`发现 ${configCheck.value.issues.length} 个配置问题`);
      }
    } else {
      // 模拟配置检查
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      completionStatus.value.forEach(item => {
        item.status = Math.random() > 0.3;
        item.message = item.status ? '正常' : '需要检查';
      });
      
      configCheck.value.passed = completionStatus.value.every(item => item.status);
      configCheck.value.issues = completionStatus.value
        .filter(item => !item.status)
        .map(item => `${item.name}: ${item.message}`);
      
      if (configCheck.value.passed) {
        Message.success('模拟配置检查通过！');
      } else {
        Message.warning(`发现 ${configCheck.value.issues.length} 个配置问题`);
      }
    }
  } catch (error) {
    Message.error(`配置检查失败: ${error.message}`);
  }
};

// 完成设置
const finishSetup = async () => {
  Message.loading({ content: '正在完成设置...', duration: 0 });
  
  try {
      if (window.electronAPI) {
      const result = await configApi.finishSetup();
      
      if (result.success) {
        Message.success('设置完成！应用将重新启动。');
        
        // 模拟应用重启
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        Message.error(`设置失败: ${result.message}`);
      }
    } else {
      // 模拟完成设置
      await new Promise(resolve => setTimeout(resolve, 2000));
      Message.success('设置完成！');
      
      // 通知父组件安装完成
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'setup-complete' }, '*');
      }
    }
  } catch (error) {
    Message.error(`完成设置时出错: ${error.message}`);
  }
};

// 重新开始向导
const restartWizard = () => {
  // 重置所有状态
  currentStep.value = 1;
  
  environmentChecks.value.forEach(check => {
    check.status = 'pending';
    check.message = '等待检查...';
  });
  
  loginResult.value = null;
  installMethod.value = 'npm';
  installing.value = false;
  installProgress.value = 0;
  installOutput.value = '';
  installComplete.value = false;
  installError.value = false;
  
  completionStatus.value.forEach(item => {
    item.status = false;
    item.message = '检查中...';
  });
  
  configCheck.value.passed = false;
  configCheck.value.issues = [];
  
  Message.info('向导已重置，请重新开始。');
};

// 生命周期
onMounted(() => {
  // 自动开始环境检查
  setTimeout(() => {
    checkEnvironment();
  }, 500);
});
</script>

<style scoped>
.install-guide {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.guide-header {
  text-align: center;
  margin-bottom: 32px;
}

.guide-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.guide-description {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 步骤指示器 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 40px 0;
  position: relative;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
  flex: 1;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--bg-secondary);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.step.active .step-number {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.step.completed .step-number {
  background-color: #00b42a;
  border-color: #00b42a;
  color: white;
}

.step-info {
  text-align: center;
  margin-top: 8px;
}

.step-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.step-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.step-connector {
  flex: 1;
  height: 2px;
  background-color: var(--border-color);
  position: relative;
  top: -18px;
  z-index: 1;
}

.step-connector.active {
  background-color: var(--primary-color);
}

/* 步骤内容 */
.step-panel {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 32px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
}

.panel-title {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 8px;
}

.panel-description {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

/* 环境检查列表 */
.check-list {
  margin: 24px 0;
}

.check-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
}

.check-icon {
  margin-right: 16px;
}

.check-details {
  flex: 1;
}

.check-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.check-status {
  font-size: 13px;
  font-weight: 500;
}

.check-status.passed {
  color: #00b42a;
}

.check-status.failed {
  color: #f53f3f;
}

.check-status.pending {
  color: #86909c;
}

.check-message {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.check-action {
  margin-left: 12px;
}

.panel-footer {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

/* 登录信息 */
.login-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin: 24px 0;
}

.info-card {
  padding: 20px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.info-card h3 {
  margin: 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.info-card ul, .info-card ol {
  margin-left: 20px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.login-status {
  margin: 24px 0;
  padding: 16px;
  border-radius: 8px;
  background-color: var(--bg-secondary);
}

.status-message {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.status-message.success {
  color: #00b42a;
}

.status-message.error {
  color: #f53f3f;
}

.login-output {
  margin-top: 12px;
  padding: 12px;
  background-color: #1a1a1a;
  color: #f0f0f0;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 200px;
}

/* 安装选项 */
.install-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.option-card {
  padding: 20px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-card:hover {
  border-color: var(--border-color);
}

.option-card.selected {
  border-color: var(--primary-color);
  background-color: rgba(var(--primary-color-rgb), 0.05);
}

.option-icon {
  margin-bottom: 12px;
}

.option-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.option-info p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.install-command {
  display: block;
  padding: 8px 12px;
  background-color: #1a1a1a;
  color: #f0f0f0;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  overflow-x: auto;
}

/* 安装进度 */
.install-progress {
  margin: 24px 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.progress-output {
  margin-top: 16px;
  padding: 12px;
  background-color: #1a1a1a;
  color: #f0f0f0;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  max-height: 150px;
  overflow: auto;
}

/* 完成状态 */
.completion-summary {
  margin: 24px 0;
}

.completion-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
}

.completion-icon {
  margin-right: 12px;
}

.completion-details {
  flex: 1;
}

.completion-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.completion-message {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 最终操作 */
.final-actions {
  margin: 32px 0;
}

.action-card {
  padding: 24px;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  text-align: center;
  border: 2px solid var(--border-color);
}

.action-card h3 {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 12px;
}

.action-card p {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.action-card ul {
  text-align: left;
  margin: 16px 0;
  color: var(--text-secondary);
  padding-left: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .install-guide {
    padding: 16px;
  }
  
  .step-indicator {
    margin: 24px 0;
  }
  
  .step-info {
    display: none;
  }
  
  .login-info {
    grid-template-columns: 1fr;
  }
  
  .install-options {
    grid-template-columns: 1fr;
  }
  
  .panel-footer {
    flex-wrap: wrap;
  }
}
</style>