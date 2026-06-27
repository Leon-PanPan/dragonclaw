<template>
  <div class="env-check-container">
    <div class="env-check-card">
      <!-- 全局 loading -->
      <div v-if="clawcLoading" class="global-loading">
        <a-spin :size="28" />
        <p class="loading-hint">环境检测中...</p>
      </div>

      <template v-else>
        <!-- 顶部 logo + 标题 -->
        <div class="brand-header">
          <div class="brand-logo" :class="{ 'logo-active': installRunning }">
            <img src="@/assets/images/openclaw-logo.svg" alt="OpenClaw" class="brand-logo-img" />
            <div class="logo-pulse-ring"></div>
          </div>
          <h2 class="env-check-title">
            {{ pageTitle }}
          </h2>
          <p class="brand-subtitle">OpenClaw · DragonClaw 安装引导</p>
        </div>

        <!-- 版本检查错误条 -->
        <div v-if="fetchError" class="fetch-error">
          <icon-close-circle style="color: #f53f3f; font-size: 16px;" />
          <span>无法连接更新服务: {{ fetchError }}</span>
          <a-button size="mini" @click="fetchClawcData">重试</a-button>
        </div>

        <!-- 组件列表 -->
        <div class="env-list">
          <div
            v-for="item in envItemList"
            :key="item.key"
            class="env-row"
          >
            <div
              class="env-item"
              :class="{
                'item-loading': item.installing,
                'item-success': item.status === 'success' && !item.installing,
                'item-error': item.status === 'error' && !item.installing,
                'item-update': item.update && !item.installing,
                'item-not-installed': !item.installed && !item.installing,
              }"
            >
              <div class="env-item-main">
                <span class="env-status-dot" :class="getStatusDotClass(item)"></span>
                <span class="env-name">{{ item.label }}</span>
                <span class="env-version-text">v{{ item.version || '未安装' }}</span>
                <span v-if="item.update" class="v-arrow">→</span>
                <span v-if="item.update" class="v-cloud">v{{ item.current }}</span>
                <span v-if="!item.update && item.installed && !item.installing && item.status !== 'success'" class="v-ok">最新</span>
                <span v-if="!item.installed && !item.update && !item.installing" class="v-not-installed">未安装</span>

                <span class="env-spacer"></span>

                <!-- 右侧标签：待安装 / 有更新 / 强制更新 -->
                <span class="env-tag-right" v-if="item.update && item.installed && !item.installing && item.status !== 'success'">
                  <span v-if="item.force" class="tag tag-force">强制更新</span>
                  <span v-else class="tag tag-update">有更新</span>
                </span>
                <span class="env-tag-right" v-if="!item.installed && !item.update && !item.installing && item.status !== 'success'">
                  <span class="tag tag-install">待安装</span>
                </span>

                <!-- 右侧状态：正在安装（下载/安装/初始化） -->
                <span
                  v-if="item.installing"
                  class="env-status-pill env-status-pill-loading"
                >
                  <a-spin :size="12" />
                  <span class="env-status-pill-text">{{ getInstallingPhaseText(item) }}</span>
                  <span v-if="item.phase === 'downloading'" class="env-status-pill-pct">{{ item.downloadProgress }}%</span>
                </span>

                <!-- 右侧状态：安装成功 -->
                <span
                  v-else-if="item.status === 'success'"
                  class="env-status-pill env-status-pill-success"
                >
                  <span class="env-check-icon">✓</span>
                  <span>安装成功</span>
                </span>

                <!-- 右侧状态：安装失败 -->
                <span
                  v-else-if="item.status === 'error'"
                  class="env-status-pill env-status-pill-error"
                >
                  <span class="env-cross-icon">✗</span>
                  <span>安装失败</span>
                </span>

                <!-- 操作按钮：仅当不在安装中、且非成功/失败状态时显示 -->
                <span class="env-item-actions" v-if="(item.update || !item.installed) && !item.installing && !installRunning && item.status !== 'success' && item.status !== 'error'">
                  <a-button
                    size="small"
                    :type="!item.installed ? 'primary' : 'outline'"
                    @click.stop="handleSingleInstall(item.key)"
                  >
                    {{ item.installed ? '更新' : '安装' }}
                  </a-button>
                </span>
              </div>
            </div>

            <!-- 命令行 + 边缘下载进度条（与 env-item 平级，不被彩色边框包裹） -->
            <div
              v-if="item.outputLines && item.outputLines.length > 0"
              class="env-terminal"
              :class="{
                'env-terminal-active': item.installing,
                'env-terminal-success': item.status === 'success' && !item.installing,
                'env-terminal-error': item.status === 'error' && !item.installing,
              }"
            >
              <!-- 边缘下载进度条（CSS 边框实现） -->
              <div
                v-if="item.installing && item.phase === 'downloading'"
                class="env-terminal-edge-progress"
                :style="{ '--p': item.downloadProgress + '%' }"
              >
                <span class="env-terminal-edge-progress-text">{{ item.downloadProgress }}%</span>
              </div>

              <div class="env-terminal-header" @click="toggleEnvExpand(item.key)">
                <span class="env-terminal-toggle">{{ expandedEnvs[item.key] ? '▼' : '▶' }}</span>
                <span class="env-terminal-title">{{ getItemLabel(item.key) }} · 命令日志</span>
                <span v-if="!(item.installing && item.phase === 'downloading')" class="env-terminal-count">{{ item.outputLines.length }} 条</span>
              </div>
              <div v-show="expandedEnvs[item.key]" class="env-terminal-output" :ref="el => setTerminalRef(item.key, el)">
                <div
                  v-for="(line, index) in item.outputLines"
                  :key="index"
                  class="terminal-line"
                  :class="{
                    'line-stderr': line.type === 'stderr',
                    'line-success': line.success === true,
                    'line-active': line.active,
                    'cmd-line': line.cmdLine,
                    'line-pending': (line.message.startsWith('📦') || line.message.startsWith('[') || line.message.startsWith('🔗')),
                    'line-running': line.active,
                    'line-fail': line.success === false,
                  }"
                >
                  <span class="line-icon">
                    <template v-if="line.cmdLine">
                      <span v-if="!cmdExpanded[`${item.key}_${index}`]" class="cmd-toggle" @click.stop="toggleCmdExpand(`${item.key}_${index}`)">📋 执行命令 (点击展开)</span>
                      <template v-else>
                        <span class="cmd-toggle cmd-expanded" @click.stop="toggleCmdExpand(`${item.key}_${index}`)">📋 执行命令:</span>
                        <span class="cmd-full-text">{{ line.message.replace('📋 执行命令: ', '') }}</span>
                      </template>
                    </template>
                    <template v-else-if="line.message.startsWith('📦') || line.message.startsWith('[') || line.message.startsWith('🔗')">⏳</template>
                    <template v-else-if="line.active"><a-spin :size="12" /></template>
                    <template v-else-if="line.success === true">✓</template>
                    <template v-else-if="line.success === false">✗</template>
                    <template v-else>›</template>
                  </span>
                  <span v-if="!line.cmdLine" class="line-text">{{ line.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="env-actions">
          <template v-if="installRunning">
            <a-button type="primary" size="large" :loading="true">
              <template #icon><icon-download /></template>
              安装中...
            </a-button>
          </template>
          <template v-else-if="installAllComplete || !needsAction">
            <a-button type="primary" size="large" @click="$emit('continue')">
              <template #icon><icon-rocket /></template>
              启动应用
            </a-button>
            <a-button type="text" size="small" v-if="hasUpdates" @click="handleOneClickInstall" style="margin-top: 4px; display: block;">
              重新尝试安装
            </a-button>
          </template>
          <template v-else>
            <a-button type="primary" size="large" @click="handleOneClickInstall">
              <template #icon><icon-download /></template>
              一键安装
            </a-button>
            <a-button v-if="mode === 'update' && !hasForceUpdate" type="text" size="small" @click="$emit('skip')" style="margin-top: 4px; display: block;">
              稍后再说
            </a-button>
          </template>
        </div>
      </template>

      <!-- sudo 密码弹窗 -->
      <a-modal
        :visible="sudoModalVisible"
        title="需要管理员权限"
        :footer="false"
        @cancel="cancelSudoPassword"
        :closable="true"
      >
        <div class="sudo-modal-body">
          <p class="sudo-modal-hint">请输入系统登录密码以继续安装</p>
          <a-input-password
            v-model="sudoPassword"
            placeholder="请输入密码"
            autofocus
            @press-enter="confirmSudoPassword"
            allow-clear
          />
        </div>
        <template #footer>
          <a-button @click="cancelSudoPassword">取消</a-button>
          <a-button type="primary" @click="confirmSudoPassword">确认安装</a-button>
        </template>
      </a-modal>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { platform } from '@/core/ipc';
import { systemApi } from '@/api/gateway';

const props = defineProps({
  clawcDomain: { type: String, required: true },
  mode: { type: String, default: 'install' }, // 'install' or 'update'
});

defineEmits(['continue', 'skip']);

// ========== install-step-output 事件监听 ==========
let installStepUnsub = null;

onMounted(() => {
  installStepUnsub = window.electronAPI?.onInstallStepOutput?.((data) => {
    // data 包含 { type, message, key, name, success, progress } —— 由 main 进程发出
    if (!data) return;
    const key = data.key;
    if (!key || !clawcData[key]) return;
    pushLine(key, {
      message: data.message,
      type: data.type,        // stdout / stderr
      success: data.success,  // null / true / false
    });
  });
});

onUnmounted(() => {
  if (typeof installStepUnsub === 'function') installStepUnsub();
});

// ========== 状态 ==========
const clawcData = reactive({
  nodejs: createEnvState(),
  openclaw: createEnvState(),
  dragonclaw: createEnvState(),
});

function createEnvState() {
  return {
    version: null,
    current: '',
    update: false,
    force: false,
    silent: false,
    note: '',
    file_url: '',
    script_url: '',
    installed: false,
    installing: false,
    status: 'idle',
    phase: 'idle',           // idle | downloading | installing | initializing
    downloadProgress: 0,
    downloadReceived: 0,
    downloadTotal: 0,
    outputLines: [],
  };
}

const clawcLoading = ref(true);
const installRunning = ref(false);
const installAllComplete = ref(false);
const fetchError = ref(null);

// sudo 密码弹窗
const sudoModalVisible = ref(false);
const sudoPassword = ref('');
let sudoPasswordResolver = null;

// cmdLine 展开/折叠状态
const cmdExpanded = reactive({});
const toggleCmdExpand = (key) => {
  cmdExpanded[key] = !cmdExpanded[key];
};

// env 日志展开状态（默认展开正在操作或已完成的）
const expandedEnvs = reactive({});
const toggleEnvExpand = (key) => {
  expandedEnvs[key] = !expandedEnvs[key];
};

const terminalRefs = {};
const setTerminalRef = (key, el) => {
  if (el) terminalRefs[key] = el;
};

// ========== 计算属性 ==========
const hasUpdates = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => clawcData[k]?.update);
});

const hasNotInstalled = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => !clawcData[k]?.installed);
});

const needsAction = computed(() => {
  return hasUpdates.value || hasNotInstalled.value;
});

const hasForceUpdate = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => clawcData[k]?.force);
});

const updateItems = computed(() => {
  return envItemList.value.filter(item => item.update || !item.installed);
});

const pageTitle = computed(() => {
  if (props.mode === 'update') return '检查更新';
  if (hasNotInstalled.value && !hasUpdates.value) return '安装组件';
  if (hasNotInstalled.value && hasUpdates.value) return '安装与更新';
  return '一键安装';
});

const envItemList = computed(() => {
  return [
    { key: 'nodejs', label: 'Node.js', ...clawcData.nodejs },
    { key: 'openclaw', label: 'OpenClaw', ...clawcData.openclaw },
    { key: 'dragonclaw', label: 'DragonClaw 客户端', ...clawcData.dragonclaw },
  ];
});

/** 当前正在安装的环境 key */
const installingKey = computed(() => {
  const k = ['nodejs', 'openclaw', 'dragonclaw'].find(k => clawcData[k]?.installing);
  return k || null;
});

/** 根据环境当前阶段显示状态文字 */
const getInstallingPhaseText = (item) => {
  const map = {
    downloading: '下载中...',
    installing: '安装中...',
    initializing: '初始化中...',
  };
  return map[item.phase] || '处理中...';
};

// ========== 工具函数 ==========
const getItemLabel = (key) => {
  const map = { nodejs: 'Node.js', npm: 'npm', openclaw: 'OpenClaw', dragonclaw: 'DragonClaw 客户端' };
  return map[key] || key;
};

const getStatusDotClass = (item) => {
  if (item.installing) return 'loading';
  if (item.status === 'success') return 'success';
  if (item.status === 'error') return 'error';
  if (!item.installed) return 'not-installed';
  if (item.update && item.force) return 'force';
  if (item.update) return 'update';
  return 'ok';
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

/** 获取当前平台标识 */
const getPlatform = async () => {
  const p = platform;
  if (p === 'darwin') {
    try {
      const info = await systemApi.info();
      return info.arch === 'arm64' ? 'mac_m' : 'mac_intel';
    } catch (e) {
      return 'mac_intel';
    }
  }
  return p === 'win32' ? 'win' : 'linux';
};

// ========== machine_id 生成 ==========

/** 机器码签名密钥（与后端共用） */
const MACHINE_SECRET = 'clawc-machine-secret-2026-v2';

/** 从 main process 获取已有机器码（复用 main.js getMachineId，与版本检查一致性） */
const getRawDeviceId = async () => {
  try {
    const id = await window.electronAPI?.getMachineId?.();
    if (id && id.length === 32) return id;
  } catch (e) {
    console.warn('[getRawDeviceId] 获取 machineId 失败:', e.message);
  }
  try {
    const sysInfo = await window.electronAPI?.getSystemInfo?.() || {};
    const parts = [
      sysInfo.hostname || '',
      sysInfo.platform || window.electronAPI?.platform || '',
      sysInfo.arch || '',
    ].filter(Boolean);
    if (parts.length > 0) {
      return parts.join('|').split('').map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    }
  } catch (e) {}
  const fallback = `${window.electronAPI?.platform || 'unknown'}|${Date.now()}`;
  return fallback.split('').map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
};

/** HMAC-SHA256 签名（使用 Web Crypto API） */
const hmacSign = async (message, secret) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
};

/** 生成带签名的 machine_id */
const generateMachineId = async () => {
  const rawId = await getRawDeviceId();
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSign(rawId + '.' + ts, MACHINE_SECRET);
  return rawId + '.' + ts + '.' + sig.slice(0, 16);
};

// ========== sudo 密码 ==========
const requestSudoPassword = async () => {
  const isMac = window.electronAPI?.platform === 'darwin';
  const isWindows = window.electronAPI?.platform === 'win32';

  if (isMac) {
    return '__macOS_native__';
  }

  if (isWindows) {
    const pwd = await window.electronAPI?.requestNativePassword?.(
      '需要管理员权限',
      '请输入系统登录密码以继续安装：'
    );
    if (pwd) return pwd;
  }

  return new Promise((resolve) => {
    sudoPasswordResolver = resolve;
    sudoPassword.value = '';
    sudoModalVisible.value = true;
  });
};

const confirmSudoPassword = () => {
  const pwd = sudoPassword.value;
  sudoModalVisible.value = false;
  if (sudoPasswordResolver) {
    sudoPasswordResolver(pwd);
    sudoPasswordResolver = null;
  }
};

const cancelSudoPassword = () => {
  sudoModalVisible.value = false;
  if (sudoPasswordResolver) {
    sudoPasswordResolver('');
    sudoPasswordResolver = null;
  }
};

// ========== 日志追加辅助 ==========
const pushLine = (key, line) => {
  if (!clawcData[key].outputLines) clawcData[key].outputLines = [];
  clawcData[key].outputLines.push(line);
  // 自动展开正在操作/刚完成的环境
  expandedEnvs[key] = true;
  nextTick(() => {
    const el = terminalRefs[key];
    if (el) el.scrollTop = el.scrollHeight;
  });
};

const resetEnvLogs = (key) => {
  clawcData[key].outputLines = [];
  clawcData[key].downloadProgress = 0;
  clawcData[key].downloadReceived = 0;
  clawcData[key].downloadTotal = 0;
};

// ========== 获取云端版本数据 ==========
const fetchClawcData = async () => {
  clawcLoading.value = true;
  fetchError.value = null;
  try {
    const resp = await window.electronAPI?.fetchVersionCheck?.();

    if (resp?.status !== 200 || !resp?.data) {
      fetchError.value = resp?.message || `无法获取版本信息 (status=${resp?.status ?? 'unknown'})`;
      return;
    }

    const data = resp.data;
    ['nodejs', 'npm', 'openclaw', 'dragonclaw'].forEach(key => {
      if (data[key] && key !== 'npm') {
        const d = data[key];
        const prev = clawcData[key];
        clawcData[key] = {
          ...createEnvState(),
          version: d.version || null,
          current: d.current || '',
          update: d.update === true,
          force: d.force === true,
          silent: d.silent === true,
          note: d.note || '',
          file_url: d.file_url || '',
          script_url: d.script_url || '',
          installed: d.version !== null && d.version !== '',
          outputLines: prev?.outputLines || [],
        };
      }
    });
  } catch (e) {
    console.error('[OneClickInstall] 获取版本数据失败:', e.message);
    fetchError.value = e.message;
  } finally {
    clawcLoading.value = false;
  }
};

// ========== 初始化 OpenClaw ==========
const initOpenClaw = async (key) => {
  const plat = await getPlatform();
  const homeDir = await window.electronAPI?.getOpenClawHome?.() || '';
  const machineId = await generateMachineId();
  const ts = Math.floor(Date.now() / 1000).toString();
  const openclawVersion = await window.electronAPI?.getAppVersion?.() || '';

  const params = new URLSearchParams({ platform: plat });
  if (homeDir) params.set('home_dir', homeDir);
  params.set('machine_id', machineId);
  params.set('timestamp', ts);
  if (openclawVersion) params.set('openclaw_version', openclawVersion);

  const initUrl = `${props.clawcDomain}/index.php/addons/clawc/install/initScript?${params.toString()}`;

  pushLine(key, { message: '🔧 正在初始化 OpenClaw...', type: 'stdout', success: null });

  try {
    const initResp = await window.electronAPI?.fetchInstallScript?.(initUrl);
    if (!initResp || initResp.status !== 200) return;

    const initScripts = initResp.data?.scripts || initResp.scripts || [];
    for (const step of initScripts) {
      const result = await window.electronAPI?.executeInstallStep?.(step.command, step.name, null, null, key);
      const stepInfo = step.command
        ? `\n  命令: ${step.command.substring(0, 200)}${step.command.length > 200 ? '...' : ''}`
        : '';
      if (!result.success) {
        const errDetail = result.error || `退出码 ${result.exitCode || '?'}`;
        pushLine(key, { message: `✗ ${step.name} 失败: ${errDetail}${stepInfo}`, type: 'stderr', success: false });
        console.warn(`[initOpenClaw] 步骤失败: ${step.name} | ${errDetail}`);
      } else {
        pushLine(key, { message: `✓ ${step.name} 完成`, type: 'stdout', success: true });
      }
    }

    pushLine(key, { message: '✓ OpenClaw 初始化完成', type: 'stdout', success: true });
  } catch (e) {
    console.warn('[initOpenClaw] 初始化异常:', e.message);
  }
};

// ========== 通用：执行单个环境的安装流程 ==========
/**
 * 下载预热：若 file_url 存在，尝试主动下载到本地缓存，附带回退逻辑
 * 进度仅通过 env-terminal 边缘 CSS 进度条展示，命令行中只记录 URL/完成/失败
 */
const predownloadFile = async (key, item) => {
  if (!item.file_url) return { localFilePath: null };

  const ext = item.file_url.split('.').pop() || 'tgz';
  const tempName = `${key}-${Date.now()}-installer.${ext}`;
  const filename = item.file_url.split('/').pop();

  // 显式打印完整下载链接（解决"看不到下载链接"的诉求）
  pushLine(key, { message: `🔗 下载链接: ${item.file_url}`, type: 'stdout', success: null });
  pushLine(key, { message: `⏬ 下载: ${filename}`, type: 'stdout', success: null });

  let unsubDownload = null;
  const updateProgress = (data) => {
    const progress = Math.min(100, Math.max(0, Math.round(data.progress || 0)));
    const received = data.downloaded ?? data.received ?? 0;
    const total = data.total || 0;
    clawcData[key].downloadProgress = progress;
    clawcData[key].downloadReceived = received;
    clawcData[key].downloadTotal = total;
  };

  const localFilePath = await new Promise((resolve) => {
    const timeoutTimer = setTimeout(() => {
      unsubDownload?.();
      resolve(null);
    }, 600000);

    unsubDownload = window.electronAPI?.onDownloadProgress?.(updateProgress) || null;

    Promise.resolve(window.electronAPI?.downloadFile?.(item.file_url, tempName))
      .then((result) => {
        clearTimeout(timeoutTimer);
        unsubDownload?.();
        resolve(result?.filePath || result);
      })
      .catch((e) => {
        clearTimeout(timeoutTimer);
        unsubDownload?.();
        console.warn('[安装] 预下载失败:', e.message);
        resolve(null);
      });
  });

  if (localFilePath) {
    pushLine(key, { message: `✓ 下载完成 → ${localFilePath}`, type: 'stdout', success: true });
  } else {
    pushLine(key, {
      message: `⚠ 预下载超时，将直接从服务器安装（速度可能较慢）`,
      type: 'stderr', success: null,
    });
  }

  return { localFilePath };
};

/** 执行某个环境的安装（不包含 sudo 获取、初始状态变更） */
const runInstallForEnv = async (key) => {
  const item = clawcData[key];
  if (!item) return;

  // 0. 下载
  const { localFilePath } = await predownloadFile(key, item);
  const localFileEnv = localFilePath ? { LOCAL_FILE: localFilePath } : null;

  // 1. 获取脚本
  const scriptResp = await window.electronAPI?.fetchInstallScript?.(item.script_url);
  if (!scriptResp || scriptResp.status !== 200) {
    throw new Error('获取安装脚本失败');
  }

  const scripts = scriptResp.data?.scripts || scriptResp.scripts || [];

  // 2. 打印开始安装信息
  pushLine(key, { message: `🔧 开始安装 ${getItemLabel(key)}（共 ${scripts.length} 步）`, type: 'stdout', success: null });
  if (scripts.length > 0) {
    pushLine(key, {
      message: `📋 执行命令: ${scripts[0].command}`,
      type: 'stdout', success: null, cmdLine: true,
    });
  }

  // 3. 阶段切换
  clawcData[key].phase = 'installing';

  // 4. sudo 密码
  let sudoPwd = null;
  const isMac = window.electronAPI?.platform === 'darwin';
  const hasSudo = scripts.some(s => s.command.includes('sudo'));
  if (hasSudo) {
    const pwd = await requestSudoPassword();
    if (!pwd && !isMac) throw new Error('未提供 sudo 密码');
    sudoPwd = pwd;
  }

  // 5. 逐步执行
  for (const step of scripts) {
    const result = await window.electronAPI?.executeInstallStep?.(step.command, step.name, sudoPwd, localFileEnv, key);
    if (!result.success) {
      const errDetail = result.error || `退出码 ${result.exitCode || '?'}`;
      throw new Error(`${step.name}: ${errDetail}`);
    }
  }

  // 6. 重新检测版本
  const actualVersions = await window.electronAPI?.recheckEnvVersions?.();
  if (actualVersions && actualVersions[key]) {
    clawcData[key].version = actualVersions[key];
  } else {
    clawcData[key].version = item.current;
  }

  // 7. openclaw 特殊：初始化
  if (key === 'openclaw') {
    clawcData[key].phase = 'initializing';
    await initOpenClaw(key);
  }
};

// ========== 安装/更新单个组件 ==========
const handleSingleInstall = async (key) => {
  const item = clawcData[key];
  if (!item || item.installing) return;
  if (item.installed && !item.update) return;

  installRunning.value = true;
  resetEnvLogs(key);
  clawcData[key].installing = true;
  clawcData[key].status = 'installing';
  clawcData[key].phase = 'downloading';
  clawcData[key].downloadProgress = 0;
  expandedEnvs[key] = true;

  try {
    await runInstallForEnv(key);

    clawcData[key].installing = false;
    clawcData[key].status = 'success';
    clawcData[key].update = false;
    clawcData[key].installed = true;
    clawcData[key].phase = 'idle';

    Message.success(`${getItemLabel(key)} 完成！`);
  } catch (e) {
    clawcData[key].installing = false;
    clawcData[key].status = 'error';
    clawcData[key].phase = 'idle';
    pushLine(key, { message: `✗ ${getItemLabel(key)} 失败: ${e.message}`, type: 'stderr', success: false });
    Message.error(`${getItemLabel(key)} 失败: ${e.message}`);
  } finally {
    installRunning.value = false;
    clawcData[key].downloadProgress = 0;
  }
};

// ========== 一键安装所有 ==========
const handleOneClickInstall = async () => {
  installRunning.value = true;
  installAllComplete.value = false;

  const items = updateItems.value;
  if (items.length === 0) {
    installRunning.value = false;
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.key;

    resetEnvLogs(key);
    clawcData[key].installing = true;
    clawcData[key].status = 'installing';
    clawcData[key].phase = 'downloading';
    clawcData[key].downloadProgress = 0;
    expandedEnvs[key] = true;

    pushLine(key, { message: `[${i + 1}/${items.length}] 正在处理: ${getItemLabel(key)}`, type: 'stdout', success: null });

    try {
      await runInstallForEnv(key);

      clawcData[key].installing = false;
      clawcData[key].status = 'success';
      clawcData[key].update = false;
      clawcData[key].installed = true;
      clawcData[key].phase = 'idle';
    } catch (e) {
      clawcData[key].installing = false;
      clawcData[key].status = 'error';
      clawcData[key].phase = 'idle';
      pushLine(key, { message: `✗ ${getItemLabel(key)} 失败: ${e.message}`, type: 'stderr', success: false });

      if (item.force) break;
    } finally {
      clawcData[key].downloadProgress = 0;
    }
  }

  installRunning.value = false;
  installAllComplete.value = true;
};

// ========== 生命周期 ==========
fetchClawcData();
</script>

<style scoped>
/* ==================== 容器 ==================== */
.env-check-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px;
}
.env-check-card {
  width: 100%;
  max-width: 760px;
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
  margin-top: -6vh;
}

/* ==================== 顶部 brand ==================== */
.brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
  position: relative;
}
.brand-logo {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.brand-logo-img {
  width: 56px;
  height: 56px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 4px 10px rgba(255, 77, 77, 0.25));
  animation: logo-float 4s ease-in-out infinite;
}
.logo-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 77, 77, 0.35);
  opacity: 0;
  z-index: 1;
}
.brand-logo.logo-active .logo-pulse-ring {
  animation: logo-pulse 1.6s ease-out infinite;
}
.brand-logo.logo-active .brand-logo-img {
  animation: logo-spin 6s linear infinite, logo-float 4s ease-in-out infinite;
}
@keyframes logo-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes logo-pulse {
  0% { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes logo-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.env-check-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}
.brand-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

/* 错误条 */
.fetch-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: #fff2f0;
  border: 1px solid #ffa39e;
  color: #cf1322;
  font-size: 13px;
}
.fetch-error span { flex: 1; }

/* ==================== 全局 loading ==================== */
.global-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  gap: 12px;
}
.loading-hint {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

/* ==================== 组件列表 ==================== */
.env-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.env-row { display: flex; flex-direction: column; gap: 6px; }
.env-item {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.25s ease;
}
.env-item-main {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  gap: 8px;
}
.env-item.success { border-color: rgba(0,180,42,0.3); background: rgba(0,180,42,0.05); }
.env-item.error { border-color: rgba(245,63,63,0.3); background: rgba(245,63,63,0.05); }

.env-name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.env-version-text { font-size: 13px; font-family: monospace; color: var(--text-secondary); }

.v-arrow { font-size: 14px; color: var(--primary-color); font-weight: bold; }
.v-cloud { font-size: 13px; color: var(--primary-color); font-weight: 600; font-family: monospace; }
.v-ok { font-size: 12px; color: #00b42a; }
.v-not-installed { font-size: 12px; color: #86909c; }

/* 右侧状态药丸（loading / success / error） */
.env-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 14px;
  flex-shrink: 0;
  white-space: nowrap;
}
.env-status-pill-loading {
  color: var(--primary-color);
  background: rgba(22, 93, 255, 0.08);
  border: 1px solid rgba(22, 93, 255, 0.25);
}
.env-status-pill-success {
  color: #00b42a;
  background: rgba(0, 180, 42, 0.1);
  border: 1px solid rgba(0, 180, 42, 0.3);
  animation: success-pop 0.4s ease-out;
}
.env-status-pill-error {
  color: #f53f3f;
  background: rgba(245, 63, 63, 0.08);
  border: 1px solid rgba(245, 63, 63, 0.3);
  animation: success-pop 0.4s ease-out;
}
.env-status-pill-text { letter-spacing: 0.2px; }
.env-status-pill-pct {
  font-family: monospace;
  font-weight: 700;
  padding-left: 4px;
  border-left: 1px solid currentColor;
  margin-left: 2px;
  opacity: 0.85;
}

/* 成功对勾图标 */
.env-check-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #00b42a;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  animation: check-tick 0.5s ease-out;
}
/* 失败叉号图标 */
.env-cross-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f53f3f;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
@keyframes success-pop {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes check-tick {
  0% { transform: scale(0) rotate(-45deg); }
  100% { transform: scale(1) rotate(0); }
}

.env-spacer { flex: 1; }
.env-tag-right { flex-shrink: 0; }
.env-item-actions { flex-shrink: 0; }

/* 状态点 */
.env-status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--border-color);
  transition: all 0.3s;
}
.env-status-dot.ok { background-color: #00b42a; }
.env-status-dot.success { background-color: #00b42a; }
.env-status-dot.update { background-color: #ff7d00; }
.env-status-dot.force { background-color: #f53f3f; animation: dot-pulse 1.5s infinite; }
.env-status-dot.not-installed { background-color: #86909c; }
.env-status-dot.error { background-color: #f53f3f; }
.env-status-dot.loading { background-color: var(--primary-color); animation: dot-pulse 1s infinite; }

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 标签 */
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.tag-update { background: #fff7e6; color: #d46b08; }
.tag-force { background: #fff2f0; color: #cf1322; }
.tag-install { background: #e8f3ff; color: #165dff; }

.item-update { border-color: #ffd591 !important; background: #fffbe6 !important; }
.item-loading { border-color: var(--primary-color) !important; background: rgba(22, 93, 255, 0.03) !important; }
.item-success { border-color: #b7eb8f !important; background: #f6ffed !important; }
.item-error { border-color: #ffa39e !important; background: #fff2f0 !important; }
.item-not-installed { border-color: #c9cdd4 !important; background: var(--bg-secondary, #f7f8fa) !important; }

/* 操作按钮 */
.env-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }

/* ==================== 单个环境终端日志（与 env-item 平级，避开彩色边框） ==================== */
.env-terminal {
  position: relative;
  background: #1a1a1a;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  border: 1px solid #2a2a2a;
}
.env-terminal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #252525;
  color: #aaa;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}
.env-terminal-header:hover { background: #2a2a2a; }
.env-terminal-toggle {
  font-size: 10px;
  color: #888;
  display: inline-block;
  width: 12px;
  text-align: center;
}
.env-terminal-title { font-weight: 500; }
.env-terminal-count { margin-left: auto; color: #666; font-size: 10px; }

/* 命令行主体：固定 3 行高度（每行 ~ line-height 18px + padding 16px = ~70px） */
.env-terminal-output {
  padding: 8px 12px;
  height: 70px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: #cfd3da;
}
.terminal-line { display: flex; gap: 8px; color: #aaa; margin-bottom: 2px; align-items: center; flex-wrap: wrap; line-height: 18px; }
.terminal-line.line-stderr { color: #ff7d00; }
.terminal-line.line-success { color: #00b42a; }
.terminal-line.line-active { color: #00b42a; }
.cmd-line { color: #888; font-style: italic; }

/* 行图标 */
.line-icon { flex-shrink: 0; display: inline-flex; align-items: center; }
.line-pending { color: #aaa; }
.line-running { color: var(--primary-color); }
.line-fail { color: #f53f3f; }

/* cmdLine 折叠 */
.cmd-toggle {
  cursor: pointer;
  color: #888;
  font-style: italic;
  user-select: none;
}
.cmd-toggle:hover { color: #ccc; }
.cmd-toggle.cmd-expanded { color: #aaa; }
.cmd-full-text {
  color: #888;
  font-style: italic;
  word-break: break-all;
  margin-left: 4px;
}

/* ==================== 边缘下载进度条（CSS 实现，无 DOM 节点） ==================== */
/* 利用 ::before / ::after 在 terminal 上下边缘绘制进度 */
.env-terminal::before,
.env-terminal::after {
  content: '';
  position: absolute;
  left: 0;
  height: 2px;
  width: var(--p, 0%);
  background: linear-gradient(90deg, #165dff, #4080ff);
  box-shadow: 0 0 6px rgba(22, 93, 255, 0.6);
  transition: width 0.25s ease;
  z-index: 3;
  pointer-events: none;
}
.env-terminal::before { top: 0; }
.env-terminal::after  { bottom: 0; }

/* 进度百分比文字（绝对定位，右上角避开 header 文字） */
.env-terminal-edge-progress {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 4;
  font-size: 10px;
  font-family: monospace;
  font-weight: 600;
  color: #4080ff;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 8px;
  pointer-events: none;
  animation: edge-progress-pulse 1.2s ease-in-out infinite;
}
.env-terminal-edge-progress-text { letter-spacing: 0.3px; }
@keyframes edge-progress-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

/* sudo 弹窗 */
.sudo-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sudo-modal-hint {
  font-size: 14px;
  color: var(--text-secondary, #666);
  margin: 0;
}

.line-text { word-break: break-all; flex: 1; }
</style>
