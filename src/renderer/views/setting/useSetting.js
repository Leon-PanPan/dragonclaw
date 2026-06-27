import { ref, onMounted, computed } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { modelAdminApi, configAdminApi, configFromSnapshot } from '@/api/admin-rpc'
import { wsManager, ConnectionState } from '@/core/websocket/manager'

export function useSetting() {
  const showAddDenyCommand = ref(false)
  const addDenyCommandVisible = ref(false)
  const newDenyCommand = ref('')

  const loading = ref(false)
  const saving = ref(false)
  const configHash = ref('')
  const configForm = ref(makeDefaultConfig())

  const modelList = ref([])
  const modelCascaderOptions = ref([])
  const loadingModels = ref(false)
  const testingFeishu = ref(false)
  const activeTab = ref('agent')

  const checkingUpdates = ref(false)
  const versionCheckerRef = ref(null)
  const appVersion = ref('1.0.0')
  const electronVersion = ref('28.0.0')
  const nodeVersion = ref('18.0.0')
  const chromeVersion = ref('120.0.0')
  const npmVersion = ref('10.0.0')
  const clawhubVersion = ref('0.8.0')
  const openclawVersion = ref('2026.3.13')

  const primaryModelName = computed(() => {
    const m = modelList.value.find(x => x.value === configForm.value?.agents?.defaults?.model?.primary)
    return m ? m.label : ''
  })

  function makeDefaultConfig() {
    return {
      agents: { defaults: {
        model: { primary: '', fallbacks: [] },
        thinkingDefault: 'high', timeoutSeconds: 72000,
        workspace: '~/.openclaw/workspace', bootstrapMaxChars: 12000, maxConcurrent: 3,
        userTimezone: 'Asia/Shanghai', timeFormat: '24',
        blockStreamingDefault: 'on',
        blockStreamingChunk: { minChars: 10, maxChars: 200 },
        blockStreamingCoalesce: { minChars: 50, idleMs: 80 },
        blockStreamingBreak: 'text_end',
        typingIntervalSeconds: 3, typingMode: 'thinking',
        compaction: { mode: 'safeguard', model: '', reserveTokens: 50000, reserveTokensFloor: 20000, notifyUser: false,
          memoryFlush: { enabled: true, softThresholdTokens: 4000 } },
        contextPruning: { mode: 'cache-ttl', ttl: '1h' },
        heartbeat: { every: '55m', isolatedSession: true },
        subagents: { maxConcurrent: 8, maxSpawnDepth: 2, maxChildrenPerAgent: 20, runTimeoutSeconds: 72000, archiveAfterMinutes: 300 },
        sandbox: { mode: 'off' },
      }},
      channels: { feishu: { enabled: false, appId: '', appSecret: '', connectionMode: 'websocket', groupPolicy: 'open', dmPolicy: 'open' } },
      gateway: {
        mode: 'local', port: 18789, bind: 'lan',
        controlUi: { allowInsecureAuth: true },
        auth: { mode: 'token', token: '' },
        tailscale: { mode: 'off' },
        reload: { mode: 'hybrid', debounceMs: 300 },
        channelHealthCheckMinutes: 1,
        http: { endpoints: { chatCompletions: { enabled: true } } },
        nodes: { denyCommands: [] },
      },
      tools: {
        profile: 'full', sessions: { visibility: 'all' }, agentToAgent: { enabled: true },
        exec: { security: 'full', ask: 'off' },
      },
      commands: { native: 'auto', restart: true },
      session: { dmScope: 'per-peer' },
      logging: { level: 'info' },
      skills: { load: { extraDirs: [] }, install: { nodeManager: 'npm' } },
    }
  }

  // 用显式栈替代递归；用 hasOwnProperty 替代 `key in target` 跳过原型链
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target
    const stack = [[target, source]]
    const hasOwn = Object.prototype.hasOwnProperty
    while (stack.length) {
      const [t, s] = stack.pop()
      if (!s || typeof s !== 'object') continue
      const keys = Object.keys(s)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        const sv = s[key]
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
          if (!t[key] || typeof t[key] !== 'object' || Array.isArray(t[key])) t[key] = {}
          stack.push([t[key], sv])
        } else if (!hasOwn.call(t, key)) {
          t[key] = sv
        }
      }
    }
    return target
  }

  const loadConfig = async () => {
    loading.value = true
    try {
      const snap = await configAdminApi.get()
      const cfg = configFromSnapshot(snap)
      configHash.value = snap?.hash || ''
      if (cfg) {
        const merged = deepMerge(cfg, makeDefaultConfig())
        // 脱钩源数据：structuredClone 比 JSON.parse(JSON.stringify(x)) 更快、内存峰值更低
        configForm.value = structuredClone(merged)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      Message.error('加载配置失败: ' + (error.message || '未知错误'))
    } finally {
      loading.value = false
    }
  }

  const handleSave = async () => {
    await saveConfig()
  }

  const saveConfig = async () => {
    saving.value = true
    try {
      const res = await configAdminApi.set({ config: configForm.value, hash: configHash.value })
      // 后端在 res.payload 里返回新的 hash（以及可选的解析后 config），
      // 直接更新本地 hash 即可；不再回环调用 loadConfig() 走一次完整 WS 往返。
      if (res && typeof res === 'object') {
        if (res.hash) configHash.value = res.hash
        if (res.config) configForm.value = structuredClone(res.config)
      }
      Message.success('配置保存成功')
    } catch (error) {
      console.error('保存配置失败:', error)
      Message.error('保存配置失败: ' + error.message)
    } finally {
      saving.value = false
    }
  }

  const buildModelCascaderOptions = () => {
    const providerMap = {}
    modelList.value.forEach(model => {
      const provider = model.provider || 'default'
      if (!providerMap[provider]) providerMap[provider] = []
      providerMap[provider].push({ value: model.value, label: model.label })
    })
    modelCascaderOptions.value = Object.entries(providerMap).map(([provider, models]) => ({
      value: provider, label: provider, children: models,
    }))
  }

  // 根据模型ID获取 [provider, modelId] 格式
  const getModelCascaderPath = (modelId) => {
    if (!modelId || !modelList.value.length) return null
    const model = modelList.value.find(m => m.value === modelId)
    if (model) {
      return [model.provider || 'default', modelId]
    }
    return null
  }

  // 默认模型级联选择器的值（转换为数组格式）
  const primaryModelCascaderValue = computed(() => {
    const primary = configForm.value?.agents?.defaults?.model?.primary
    if (!primary) return []
    return getModelCascaderPath(primary) || []
  })

  // 回退模型级联选择器的值（转换为二维数组格式）
  const fallbackModelCascaderValue = computed(() => {
    const fallbacks = configForm.value?.agents?.defaults?.model?.fallbacks
    if (!Array.isArray(fallbacks) || !fallbacks.length) return []
    return fallbacks
      .map(id => getModelCascaderPath(id))
      .filter(Boolean)
  })

  const handlePrimaryModelChange = (value) => {
    if (!configForm.value.agents.defaults.model) configForm.value.agents.defaults.model = {}
    // 级联选择器返回数组，取最后一个值作为模型ID
    configForm.value.agents.defaults.model.primary = value?.length ? value[value.length - 1] : ''
  }

  const handleFallbackModelsChange = (value) => {
    if (!configForm.value.agents.defaults.model) configForm.value.agents.defaults.model = {}
    // 级联选择器返回二维数组，提取每个路径的最后一个值作为模型ID
    configForm.value.agents.defaults.model.fallbacks = Array.isArray(value)
      ? value.map(path => Array.isArray(path) ? path[path.length - 1] : path).filter(Boolean)
      : []
  }

  const testFeishuConnection = async () => {
    testingFeishu.value = true
    try {
      const result = await window.electronAPI?.testFeishuConnection?.(configForm.value?.channels?.feishu)
      if (result?.success) Message.success('连接成功')
      else Message.error('连接失败')
    } catch { Message.error('测试连接失败') }
    finally { testingFeishu.value = false }
  }

  const checkForUpdates = async () => {
    checkingUpdates.value = true
    try { await versionCheckerRef.value?.triggerCheck() }
    catch { Message.error('检查更新失败') }
    finally { checkingUpdates.value = false }
  }

  const removeDenyCommand = (cmd) => {
    const list = configForm.value?.gateway?.nodes?.denyCommands
    if (list) { const idx = list.indexOf(cmd); if (idx > -1) list.splice(idx, 1) }
  }

  const openAddDenyCommandModal = () => { newDenyCommand.value = ''; addDenyCommandVisible.value = true }

  const addDenyCommand = () => {
    if (newDenyCommand.value?.trim()) {
      const list = configForm.value?.gateway?.nodes?.denyCommands
      if (!list.includes(newDenyCommand.value.trim())) list.push(newDenyCommand.value.trim())
      addDenyCommandVisible.value = false
    }
  }

  const openLink = (url) => {
    if (!url) return
    const api = window.electronAPI
    if (api && typeof api.openExternal === 'function') {
      try {
        const ret = api.openExternal(url)
        if (ret && typeof ret.catch === 'function') ret.catch((e) => console.warn('[setting] openExternal 失败:', e))
      } catch (e) {
        console.warn('[setting] openExternal 调用异常:', e)
      }
    }
  }
  const navigateToModel = () => { window.location.hash = '#/model' }

  const loadSystemInfo = async () => {
    const info = await window.electronAPI?.getSystemInfo()
    if (info) {
      nodeVersion.value = (info.nodeVersion || '18.0.0').replace('v', '')
      npmVersion.value = info.npmVersion || '10.0.0'
      clawhubVersion.value = info.clawhubVersion || '0.8.0'
      openclawVersion.value = info.openclawVersion || '2026.3.13'
      chromeVersion.value = info.chromeVersion || '120.0.0'
      electronVersion.value = info.electronVersion || '28.0.0'
      appVersion.value = info.appVersion || '1.0.0'
    }
  }

  const loadModelList = async () => {
    loadingModels.value = true
    try {
      const r = await modelAdminApi.list()
      modelList.value = r?.models?.length
        ? r.models.map(m => ({ value: m.id, label: m.name || m.id, provider: m.provider || '' }))
        : []
      buildModelCascaderOptions()
    } catch (error) {
      console.error('加载模型列表失败:', error)
      Message.error('加载模型列表失败: ' + (error.message || '未知错误'))
      modelList.value = []; modelCascaderOptions.value = []
    } finally { loadingModels.value = false }
  }

  // 等待 WebSocket 连接
  const waitForConnection = () => {
    return new Promise((resolve) => {
      if (wsManager.isConnected()) {
        resolve(true)
        return
      }
      const unsubscribe = wsManager.subscribe((data) => {
        if (data.type === 'res' && data.payload?.type === 'hello-ok') {
          unsubscribe()
          resolve(true)
        }
      })
      // 超时保护
      setTimeout(() => {
        unsubscribe()
        resolve(false)
      }, 10000)
    })
  }

  onMounted(async () => {
    await waitForConnection()
    await loadConfig()
    await loadSystemInfo()
    loadModelList()
  })

  return {
    showAddDenyCommand, addDenyCommandVisible, newDenyCommand,
    loading, saving, configForm,
    modelList, modelCascaderOptions, primaryModelCascaderValue, fallbackModelCascaderValue, loadingModels,
    testingFeishu, activeTab,
    checkingUpdates, versionCheckerRef,
    appVersion, electronVersion, nodeVersion, chromeVersion, npmVersion, clawhubVersion, openclawVersion,
    buildModelCascaderOptions, handlePrimaryModelChange, handleFallbackModelsChange,
    loadConfig, handleSave, saveConfig,
    checkForUpdates, testFeishuConnection,
    removeDenyCommand, openAddDenyCommandModal, addDenyCommand,
    openLink, navigateToModel, loadSystemInfo, loadModelList,
  }
}
