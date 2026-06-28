<template>
  <div class="via-root">
    <!-- 顶部品牌头（自包含，Modal 与页面一致） -->
    <div class="via-brand-header">
      <div class="via-brand-logo" :class="{ 'logo-active': installingRunning }">
        <img src="@/assets/images/openclaw-logo.svg" alt="OpenClaw" class="via-brand-logo-img" />
        <div class="via-logo-pulse-ring"></div>
      </div>
      <h2 class="via-title">{{ resolvedTitle }}</h2>
      <p class="via-subtitle">{{ brandSubtitle }}</p>
    </div>

    <!-- 全局 loading -->
    <div v-if="checking" class="via-global-loading">
      <a-spin :size="28" />
      <p class="loading-hint">环境检测中...</p>
    </div>

    <!-- 错误条 -->
    <div v-else-if="fetchError" class="via-fetch-error">
      <icon-close-circle style="color: #f53f3f; font-size: 16px;" />
      <span>无法连接更新服务: {{ fetchError }}</span>
      <a-button size="mini" @click="onTriggerCheck">重试</a-button>
    </div>

    <!-- 组件列表 -->
    <div v-else class="via-list">
      <div
        v-for="item in envItemList"
        :key="item.key"
        class="via-row"
      >
        <div
          class="via-item"
          :class="{
            'item-loading': item.installing,
            'item-success': item.status === 'success' && !item.installing,
            'item-error': item.status === 'error' && !item.installing,
            'item-update': item.update && !item.installing,
            'item-not-installed': !item.installed && !item.installing,
          }"
        >
          <div class="via-item-main">
            <span class="via-status-dot" :class="getStatusDotClass(item)"></span>
            <span class="via-name">{{ item.label }}</span>
            <span class="via-version-text">v{{ item.version || '未安装' }}</span>
            <template v-if="item.update">
              <span class="v-arrow">→</span>
              <span class="v-cloud">v{{ item.current }}</span>
            </template>

            <span class="via-spacer"></span>

            <span class="via-tag-right" v-if="item.force">
              <span class="tag tag-force">强制更新</span>
            </span>
            <span class="via-tag-right" v-else-if="item.update">
              <span class="tag tag-update">有更新</span>
            </span>
            <span class="via-tag-right" v-else-if="!item.installed && !item.installing && item.status !== 'success'">
              <span class="tag tag-install">待安装</span>
            </span>

            <span
              v-if="item.installing"
              class="env-status-pill env-status-pill-loading"
            >
              <a-spin :size="12" />
              <span class="env-status-pill-text">{{ getInstallingPhaseText(item) }}</span>
              <span v-if="item.phase === 'downloading'" class="env-status-pill-pct">{{ item.downloadProgress }}%</span>
            </span>

            <span
              v-else-if="item.status === 'success'"
              class="env-status-pill env-status-pill-success"
            >
              <span class="env-check-icon">✓</span>
              <span>安装成功</span>
            </span>

            <span
              v-else-if="item.status === 'error'"
              class="env-status-pill env-status-pill-error"
            >
              <span class="env-cross-icon">✗</span>
              <span>安装失败</span>
            </span>

            <span class="via-item-actions" v-if="showItemActions && (item.update || !item.installed) && !item.installing && !installRunning && item.status !== 'success' && item.status !== 'error'">
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

        <div
          v-if="item.outputLines && item.outputLines.length > 0"
          class="env-terminal"
          :class="{
            'env-terminal-active': item.installing,
            'env-terminal-success': item.status === 'success' && !item.installing,
            'env-terminal-error': item.status === 'error' && !item.installing,
          }"
        >
          <div
            v-if="item.installing && item.phase === 'downloading'"
            class="env-terminal-edge-progress"
            :style="{ '--p': item.downloadProgress + '%' }"
          >
            <span class="env-terminal-edge-progress-text">{{ item.downloadProgress }}%</span>
          </div>

          <div class="env-terminal-header" @click="toggleEnvExpand(item.key)">
            <span class="env-terminal-toggle">{{ expandedEnvs[item.key] ? '▼' : '▶' }}</span>
            <span class="env-terminal-title">{{ item.label }} · 命令日志</span>
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

    <!-- 底部操作按钮 -->
    <div v-if="!checking && !fetchError" class="via-actions">
      <template v-if="installRunning">
        <a-button type="primary" size="large" :loading="true">
          <template #icon><icon-download /></template>
          安装中...
        </a-button>
      </template>
      <template v-else-if="installAllComplete || !needsAction">
        <a-button
          v-if="mode !== 'update'"
          type="primary"
          size="large"
          @click="emit('continue')"
        >
          <template #icon><icon-launch /></template>
          启动应用
        </a-button>
        <a-button
          v-if="mode === 'update' && hasUpdates"
          type="text"
          size="small"
          @click="handleOneClickInstall"
          style="margin-top: 4px; display: block;"
        >
          重新尝试更新
        </a-button>
      </template>
      <template v-else>
        <a-button type="primary" size="large" @click="handleOneClickInstall">
          <template #icon><icon-download /></template>
          一键{{ mode === 'update' ? '更新' : '安装' }}
        </a-button>
        <a-button
          v-if="mode === 'update' && !hasForceUpdate"
          type="text"
          size="small"
          @click="emit('skip')"
          style="margin-top: 4px; display: block;"
        >
          稍后再说
        </a-button>
      </template>
    </div>

    <!-- sudo 密码弹窗（内部自管） -->
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
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { Notification } from '@arco-design/web-vue';
import { platform } from '@/core/ipc';

const props = defineProps({
  mode: {
    type: String,
    default: 'install',
    validator: v => ['install', 'update'].includes(v),
  },
  autoCheck: {
    type: Boolean,
    default: true,
  },
  pollInterval: {
    type: Number,
    default: 0,
  },
  showItemActions: {
    type: Boolean,
    default: true,
  },
  title: {
    type: String,
    default: '',
  },
});

const emit = defineEmits([
  'item-installed',
  'item-failed',
  'all-completed',
  'check-complete',
  'state-changed',
  'continue',
  'skip',
]);

// ==================== 状态 ====================
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
    phase: 'idle',
    downloadProgress: 0,
    downloadReceived: 0,
    downloadTotal: 0,
    outputLines: [],
  };
}

const checking = ref(true);
const installRunning = ref(false);
const installAllComplete = ref(false);
const fetchError = ref(null);

const sudoModalVisible = ref(false);
const sudoPassword = ref('');
let sudoPasswordResolver = null;

const cmdExpanded = reactive({});
const toggleCmdExpand = (key) => { cmdExpanded[key] = !cmdExpanded[key]; };

const expandedEnvs = reactive({});
const toggleEnvExpand = (key) => { expandedEnvs[key] = !expandedEnvs[key]; };

const terminalRefs = {};
const setTerminalRef = (key, el) => { if (el) terminalRefs[key] = el; };

// ==================== 计算属性 ====================
const hasUpdates = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => clawcData[k]?.update);
});
const hasNotInstalled = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => !clawcData[k]?.installed);
});
const needsAction = computed(() => hasUpdates.value || hasNotInstalled.value);
const hasForceUpdate = computed(() => {
  return ['nodejs', 'openclaw', 'dragonclaw'].some(k => clawcData[k]?.force);
});
const updateItems = computed(() => envItemList.value.filter(item => item.update || !item.installed));
const envItemList = computed(() => ([
  { key: 'nodejs', label: 'Node.js', ...clawcData.nodejs },
  { key: 'openclaw', label: 'OpenClaw', ...clawcData.openclaw },
  { key: 'dragonclaw', label: 'DragonClaw 客户端', ...clawcData.dragonclaw },
]));
const installingRunning = computed(() => installRunning.value);

const resolvedTitle = computed(() => {
  if (props.title) return props.title;
  if (props.mode === 'update') return '检查更新';
  if (hasNotInstalled.value && !hasUpdates.value) return '安装组件';
  if (hasNotInstalled.value && hasUpdates.value) return '安装与更新';
  return '一键安装';
});

const brandSubtitle = computed(() => (
  props.mode === 'update'
    ? 'OpenClaw · DragonClaw 更新检测'
    : 'OpenClaw · DragonClaw 安装引导'
));

// ==================== 工具 ====================
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

const getInstallingPhaseText = (item) => {
  const map = {
    downloading: '下载中...',
    installing: '安装中...',
    initializing: '初始化中...',
  };
  return map[item.phase] || '处理中...';
};

const getPlatform = async () => {
  const p = platform;
  if (p === 'darwin') {
    try {
      const info = await window.electronAPI?.getSystemInfo?.();
      return info.arch === 'arm64' ? 'mac_m' : 'mac_intel';
    } catch (e) {
      return 'mac_intel';
    }
  }
  return p === 'win32' ? 'win' : 'linux';
};

// ==================== machine_id 生成 ====================
const MACHINE_SECRET = 'clawc-machine-secret-2026-v2';

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
      return parts.join('|').split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  const fallback = `${window.electronAPI?.platform || 'unknown'}|${Date.now()}`;
  return fallback.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
};

const hmacSign = async (message, secret) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const generateMachineId = async () => {
  const rawId = await getRawDeviceId();
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSign(rawId + '.' + ts, MACHINE_SECRET);
  return rawId + '.' + ts + '.' + sig.slice(0, 16);
};

// ==================== sudo 密码 ====================
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

// ==================== 日志追加 ====================
const pushLine = (key, line) => {
  if (!clawcData[key]) return;
  if (!clawcData[key].outputLines) clawcData[key].outputLines = [];
  clawcData[key].outputLines.push(line);
  expandedEnvs[key] = true;
  nextTick(() => {
    const el = terminalRefs[key];
    if (el) el.scrollTop = el.scrollHeight;
  });
};

const resetEnvLogs = (key) => {
  if (!clawcData[key]) return;
  clawcData[key].outputLines = [];
  clawcData[key].downloadProgress = 0;
  clawcData[key].downloadReceived = 0;
  clawcData[key].downloadTotal = 0;
};

// ==================== fetchVersionCheck ====================
const fetchClawcData = async () => {
  checking.value = true;
  fetchError.value = null;
  try {
    const resp = await window.electronAPI?.fetchVersionCheck?.();
    if (resp?.status !== 200 || !resp?.data) {
      fetchError.value = resp?.message || `无法获取版本信息 (status=${resp?.status ?? 'unknown'})`;
      emit('check-complete', { hasAnyUpdate: false, hasForce: false, fetchError: fetchError.value });
      return;
    }

    const data = resp.data;
    for (const key of ['nodejs', 'openclaw', 'dragonclaw']) {
      const d = data[key];
      if (!d) continue;
      const item = clawcData[key];
      const wasSilent = item.silent && item.update;
      item.version = d.version || null;
      item.current = d.current || '';
      item.update = d.update === true;
      item.force = d.force === true;
      item.silent = d.silent === true;
      item.note = d.note || '';
      item.file_url = d.file_url || '';
      item.script_url = d.script_url || '';
      item.installed = d.version !== null && d.version !== '';
      if (wasSilent && item.silent && item.update && !item.installing) {
        triggerSilentInstall(key);
      }
    }

    emit('check-complete', {
      hasAnyUpdate: hasUpdates.value,
      hasForce: hasForceUpdate.value,
      fetchError: null,
    });
  } catch (e) {
    console.error('[VersionInstall] 获取版本数据失败:', e.message);
    fetchError.value = e.message;
    emit('check-complete', { hasAnyUpdate: false, hasForce: false, fetchError: fetchError.value });
  } finally {
    checking.value = false;
  }
};

const onTriggerCheck = () => fetchClawcData();

// ==================== 下载预热 ====================
const predownloadFile = async (key, item) => {
  if (!item.file_url) return { localFilePath: null };

  const ext = item.file_url.split('.').pop() || 'tgz';
  const tempName = `${key}-${Date.now()}-installer.${ext}`;
  const filename = item.file_url.split('/').pop();

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
        console.warn('[VersionInstall] 预下载失败:', e.message);
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

// ==================== initOpenClaw ====================
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

  const initUrl = `${window.__CLAWC_DOMAIN__ || 'http://api.dragonclaw.cc'}/base/api/addons/clawc/install/initScript?${params.toString()}`;

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

// ==================== runInstallForEnv ====================
const runInstallForEnv = async (key) => {
  const item = clawcData[key];
  if (!item) return;

  const { localFilePath } = await predownloadFile(key, item);
  const localFileEnv = localFilePath ? { LOCAL_FILE: localFilePath } : null;

  const scriptResp = await window.electronAPI?.fetchInstallScript?.(item.script_url);
  if (!scriptResp || scriptResp.status !== 200) {
    throw new Error('获取安装脚本失败');
  }

  const scripts = scriptResp.data?.scripts || scriptResp.scripts || [];

  pushLine(key, { message: `🔧 开始安装 ${getItemLabel(key)}（共 ${scripts.length} 步）`, type: 'stdout', success: null });
  if (scripts.length > 0) {
    pushLine(key, {
      message: `📋 执行命令: ${scripts[0].command}`,
      type: 'stdout', success: null, cmdLine: true,
    });
  }

  clawcData[key].phase = 'installing';

  let sudoPwd = null;
  const isMac = window.electronAPI?.platform === 'darwin';
  const hasSudo = scripts.some(s => s.command.includes('sudo'));
  if (hasSudo) {
    const pwd = await requestSudoPassword();
    if (!pwd && !isMac) throw new Error('未提供 sudo 密码');
    sudoPwd = pwd;
  }

  for (const step of scripts) {
    const result = await window.electronAPI?.executeInstallStep?.(step.command, step.name, sudoPwd, localFileEnv, key);
    if (!result.success) {
      const errDetail = result.error || `退出码 ${result.exitCode || '?'}`;
      throw new Error(`${step.name}: ${errDetail}`);
    }
  }

  const actualVersions = await window.electronAPI?.recheckEnvVersions?.();
  if (actualVersions && actualVersions[key]) {
    clawcData[key].version = actualVersions[key];
  } else {
    clawcData[key].version = item.current;
  }

  if (key === 'openclaw') {
    clawcData[key].phase = 'initializing';
    await initOpenClaw(key);
  }
};

// ==================== 安装入口 ====================
const handleSingleInstall = async (key) => {
  const item = clawcData[key];
  if (!item || item.installing) return;
  if (item.installed && !item.update) return;

  installRunning.value = true;
  resetEnvLogs(key);
  item.installing = true;
  item.status = 'installing';
  item.phase = 'downloading';
  item.downloadProgress = 0;
  expandedEnvs[key] = true;

  try {
    await runInstallForEnv(key);

    item.installing = false;
    item.status = 'success';
    item.update = false;
    item.installed = true;
    item.phase = 'idle';

    emit('item-installed', { key, version: item.current });
  } catch (e) {
    item.installing = false;
    item.status = 'error';
    item.phase = 'idle';
    pushLine(key, { message: `✗ ${getItemLabel(key)} 失败: ${e.message}`, type: 'stderr', success: false });
    emit('item-failed', { key, error: e.message });
  } finally {
    installRunning.value = false;
    item.downloadProgress = 0;
  }
};

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
    item.installing = true;
    item.status = 'installing';
    item.phase = 'downloading';
    item.downloadProgress = 0;
    expandedEnvs[key] = true;

    pushLine(key, { message: `[${i + 1}/${items.length}] 正在处理: ${getItemLabel(key)}`, type: 'stdout', success: null });

    try {
      await runInstallForEnv(key);

      item.installing = false;
      item.status = 'success';
      item.update = false;
      item.installed = true;
      item.phase = 'idle';

      emit('item-installed', { key, version: item.current });
    } catch (e) {
      item.installing = false;
      item.status = 'error';
      item.phase = 'idle';
      pushLine(key, { message: `✗ ${getItemLabel(key)} 失败: ${e.message}`, type: 'stderr', success: false });

      emit('item-failed', { key, error: e.message });
      if (item.force) break;
    } finally {
      item.downloadProgress = 0;
    }
  }

  installRunning.value = false;
  installAllComplete.value = true;
  emit('all-completed', {
    results: {
      nodejs: { ok: clawcData.nodejs.status === 'success', version: clawcData.nodejs.version },
      openclaw: { ok: clawcData.openclaw.status === 'success', version: clawcData.openclaw.version },
      dragonclaw: { ok: clawcData.dragonclaw.status === 'success', version: clawcData.dragonclaw.version },
    },
  });
};

// ==================== silent 静默安装 + 重启通知 ====================
const triggerSilentInstall = (key) => {
  handleSilentInstall(key);
};

const handleSilentInstall = async (key) => {
  const item = clawcData[key];
  if (!item || item.installing) return;
  if (item.installed && !item.update) return;

  installRunning.value = true;
  resetEnvLogs(key);
  item.installing = true;
  item.status = 'installing';
  item.phase = 'downloading';

  try {
    await runInstallForEnv(key);

    item.installing = false;
    item.status = 'success';
    item.update = false;
    item.installed = true;
    item.phase = 'idle';

    showRestartNotification(key, item.current);
  } catch (e) {
    item.installing = false;
    item.status = 'error';
    item.phase = 'idle';
    pushLine(key, { message: `✗ ${getItemLabel(key)} 静默安装失败: ${e.message}`, type: 'stderr', success: false });
  } finally {
    installRunning.value = false;
    item.downloadProgress = 0;
  }
};

const showRestartNotification = (key, version) => {
  Notification.info({
    id: `restart-${key}`,
    title: `${getItemLabel(key)} 已更新到 v${version}`,
    content: '请重启应用以完成更新',
    duration: 0,
    closable: true,
    position: 'topRight',
    btnText: '立即重启',
    onBtnClick: () => restartApp(),
  });
};

const restartApp = async () => {
  try {
    await window.electronAPI?.restartApp?.();
  } catch (e) {
    console.warn('[VersionInstall] restartApp 失败:', e.message);
  }
};

// ==================== 重置 ====================
const reset = () => {
  for (const key of ['dragonclaw', 'openclaw', 'nodejs']) {
    Object.assign(clawcData[key], createEnvState());
  }
  checking.value = true;
  installRunning.value = false;
  installAllComplete.value = false;
  fetchError.value = null;
  for (const k of Object.keys(expandedEnvs)) delete expandedEnvs[k];
  for (const k of Object.keys(cmdExpanded)) delete cmdExpanded[k];
};

// ==================== install-step-output 事件 ====================
let installStepUnsub = null;

const onInstallStepOutput = (data) => {
  if (!data) return;
  const key = data.key;
  if (!key || !clawcData[key]) return;
  pushLine(key, {
    message: data.message,
    type: data.type,
    success: data.success,
  });
};

// ==================== component-update-available 事件 ====================
const onComponentUpdateAvailable = (data) => {
  if (!data || typeof data !== 'object') return;
  for (const [key, payload] of Object.entries(data)) {
    if (!clawcData[key]) continue;
    const item = clawcData[key];
    const wasSilent = item.silent && item.update;
    item.current = payload.version || item.current;
    item.update = payload.update === true;
    item.force = payload.force === true;
    item.silent = payload.silent === true;
    item.file_url = payload.file_url || item.file_url;
    item.script_url = payload.script_url || item.script_url;
    item.note = payload.note || item.note;
    if (wasSilent && item.silent && item.update && !item.installing) {
      triggerSilentInstall(key);
    }
  }
};

// ==================== 生命周期 ====================
let pollTimer = null;

const startPolling = (intervalMs) => {
  stopPolling();
  if (!intervalMs || intervalMs <= 0) return;
  pollTimer = setInterval(() => {
    if (!installRunning.value && !checking.value) {
      fetchClawcData();
    }
  }, intervalMs);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

onMounted(() => {
  installStepUnsub = window.electronAPI?.onInstallStepOutput?.(onInstallStepOutput);
  window.electronAPI?.onComponentUpdateAvailable?.(onComponentUpdateAvailable);

  if (props.autoCheck) {
    fetchClawcData();
  }
  if (props.pollInterval > 0) {
    startPolling(props.pollInterval);
  }
});

onUnmounted(() => {
  stopPolling();
  if (typeof installStepUnsub === 'function') {
    installStepUnsub();
    installStepUnsub = null;
  }
});

defineExpose({
  triggerCheck: onTriggerCheck,
  installOne: handleSingleInstall,
  installAll: handleOneClickInstall,
  reset,
  components: clawcData,
  hasUpdates,
  hasNotInstalled,
  hasForceUpdate,
  installRunning,
});
</script>

<style scoped>
.via-root {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* ==================== 顶部品牌头 ==================== */
.via-brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
  position: relative;
}
.via-brand-logo {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.via-brand-logo-img {
  width: 56px;
  height: 56px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 4px 10px rgba(255, 77, 77, 0.25));
  animation: logo-float 4s ease-in-out infinite;
}
.via-logo-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 77, 77, 0.35);
  opacity: 0;
  z-index: 1;
}
.via-brand-logo.logo-active .via-logo-pulse-ring {
  animation: logo-pulse 1.6s ease-out infinite;
}
.via-brand-logo.logo-active .via-brand-logo-img {
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
.via-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}
.via-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

/* ==================== 错误条 ==================== */
.via-fetch-error {
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
.via-fetch-error span { flex: 1; }

/* ==================== 全局 loading ==================== */
.via-global-loading {
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
.via-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.via-row { display: flex; flex-direction: column; gap: 6px; }
.via-item {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.25s ease;
}
.via-item-main {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  gap: 8px;
}
.via-name { font-weight: 500; }
.via-version-text { font-size: 13px; font-family: monospace; color: var(--text-secondary); }

.v-arrow { font-size: 14px; color: var(--primary-color); font-weight: bold; }
.v-cloud { font-size: 13px; color: var(--primary-color); font-weight: 600; font-family: monospace; }

.via-spacer { flex: 1; }
.via-tag-right { flex-shrink: 0; }
.via-item-actions { flex-shrink: 0; }

/* 状态点 */
.via-status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: var(--border-color);
  transition: all 0.3s;
}
.via-status-dot.ok { background-color: #00b42a; }
.via-status-dot.success { background-color: #00b42a; }
.via-status-dot.update { background-color: #ff7d00; }
.via-status-dot.force { background-color: #f53f3f; animation: dot-pulse 1.5s infinite; }
.via-status-dot.not-installed { background-color: #86909c; }
.via-status-dot.error { background-color: #f53f3f; }
.via-status-dot.loading { background-color: var(--primary-color); animation: dot-pulse 1s infinite; }

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
.item-not-installed { border-color: #c9cdcd !important; background: var(--bg-secondary, #f7f8fa) !important; }

/* 状态药丸 */
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
.env-status-pill-pct {
  font-family: monospace;
  font-weight: 700;
  padding-left: 4px;
  border-left: 1px solid currentColor;
  margin-left: 2px;
  opacity: 0.85;
}

.env-check-icon,
.env-cross-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.env-check-icon { background: #00b42a; }
.env-cross-icon { background: #f53f3f; }

@keyframes success-pop {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}

/* ==================== 命令行日志 ==================== */
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
.line-text { word-break: break-all; flex: 1; }
.line-icon { flex-shrink: 0; display: inline-flex; align-items: center; }

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

/* 边缘下载进度条（CSS） */
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
.env-terminal::after { bottom: 0; }

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
}
.env-terminal-edge-progress-text { letter-spacing: 0.3px; }
@keyframes edge-progress-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
.env-terminal-edge-progress { animation: edge-progress-pulse 1.2s ease-in-out infinite; }

/* ==================== 底部按钮 ==================== */
.via-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}

/* ==================== sudo 弹窗 ==================== */
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
</style>