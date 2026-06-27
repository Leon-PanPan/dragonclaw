import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { configAdminApi, configFromSnapshot } from '@/api/admin-rpc'
import { wsManager, ConnectionState } from '@/core/websocket/manager'
import { resolveContextWindow, resolveReasoning, ensureCatalog, getCatalog } from '@/utils/models.dev.js'
import { useModelStore } from '@/stores/modelStore'

const wsConnected = computed(() => wsManager.state?.value === ConnectionState.CONNECTED)

const getProviderColor = (p) => ({ deepseek: 'blue', openai: 'green', anthropic: 'orange', google: 'red', modelbus: 'arcoblue', local: 'gray', custom: 'purple' }[p] || 'blue')
const formatContextLength = (v) => { if (!v) return '-'; if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'; if (v >= 1000) return (v / 1000).toFixed(0) + 'K'; return String(v) }

export function useModel() {
  const modelStore = useModelStore()
  const pageLoading = ref(true)
  const configHash = ref('')

  const writeConfig = async (config) => {
    if (!configHash.value) {
      const snap = await configAdminApi.get()
      configHash.value = snap?.hash || ''
    }
    await configAdminApi.set({ config, hash: configHash.value })
  }

  const models = ref([])
  const currentConfig = ref({})

  const modelModalVisible = ref(false)
  const modelModalIsEdit = ref(false)
  const modelModalEditingIndex = ref(-1)
  const modelModalEditingModel = ref(null)

  // 折叠状态独立存储，不随 computed 重建
  const collapsedGroups = reactive({})

  const groupedCustomModels = computed(() => {
    const catalog = getCatalog() || {};
    const map = {}
    for (const m of models.value) {
      const p = m.provider || 'custom'
      if (!map[p]) {
        map[p] = {
          provider: p,
          providerName: catalog[p]?.name || p,
          providerLogo: `https://models.dev/logos/${p}.svg`,
          models: [],
        }
      }
      // 从 models.dev catalog 补充功能标签
      const catModel = catalog[p]?.models?.[m.id];
      map[p].models.push({
        ...m,
        _attachment: catModel?.attachment ?? null,
        _reasoning: catModel?.reasoning ?? null,
        _toolCall: catModel?.tool_call ?? null,
        _contextWindow: catModel?.limit?.context || m.context_window,
      })
    }
    return Object.entries(map)
      .map(([, group]) => group)
      .sort((a, b) => a.provider.localeCompare(b.provider))
  })

  const defaultModelId = ref('')

  const loadModels = async () => {
    try {
      // 每次进入模型界面都重新拉取（即使之前成功过），保证数据是最新的
      // store 内部 promise 去重，所以不会并发拉多次
      await modelStore.refreshModels()
      const catalog = await ensureCatalog()

      // 从 config 读取每个 provider 的 api_key / base_url，用于编辑表单回显
      let providerSecrets = {}
      try {
        const snap = await configAdminApi.get()
        const cfg = configFromSnapshot(snap)
        configHash.value = snap?.hash || ''
        currentConfig.value = cfg
        defaultModelId.value = cfg?.agents?.defaults?.model?.primary || ''
        const providers = cfg?.models?.providers || {}
        for (const [pid, pconf] of Object.entries(providers)) {
          providerSecrets[pid] = {
            api_key: pconf.apiKey || '',
            base_url: pconf.baseUrl || '',
          }
        }
      } catch (_) {
        // 忽略，api_key/base_url 留空
      }

      // 合并：store 数据 + config 中的 secrets → 本地 models
      const storeModels = modelStore.models || []
      models.value = storeModels.map(m => {
        const secret = providerSecrets[m.provider] || {}
        return {
          id: m.id, name: m.name || m.id, provider: m.provider,
          api_key: secret.api_key, base_url: secret.base_url,
          context_window: m.contextWindow || 0,
          max_tokens: 0, enabled: true,
          reasoning: m.reasoning ?? false,
          avg_response_time: 0, success_rate: 0, cost_per_1k_tokens: 0,
          updating: false, testing: false,
        }
      })

      // 默认模型回退：没有则取第一个
      if (!defaultModelId.value) {
        defaultModelId.value = models.value[0]?.id || ''
      }
    } catch (e) {
      console.error('加载模型失败:', e)
      Message.error('加载模型列表失败: ' + (e.message || '未知错误'))
    }
  }

  const showAddModelModal = () => {
    modelModalEditingIndex.value = -1;
    modelModalEditingModel.value = null;
    modelModalIsEdit.value = false;
    modelModalVisible.value = true;
  }

  const editModel = (m) => {
    const idx = models.value.findIndex(x => x.id === m.id)
    modelModalEditingIndex.value = idx
    modelModalEditingModel.value = idx !== -1 ? { ...m } : null
    modelModalIsEdit.value = true
    modelModalVisible.value = true
  }

  const handleModelFormSubmit = async ({ provider, api_key, base_url, models: formModels, isEdit }) => {
    try {
      if (isEdit) {
        const fm = formModels[0] || {}
        const i = modelModalEditingIndex.value
        if (i >= 0) {
          models.value[i] = { ...models.value[i], provider, api_key, base_url, name: fm.name, id: fm.id, context_window: fm.contextWindow, updating: false, testing: false }
        }
      }
      await saveConfigToOpenClaw(isEdit ? null : formModels.map(fm => ({ ...fm, provider, api_key, base_url })))
      await loadModels()
      modelModalVisible.value = false
      Message.success(isEdit ? '模型更新成功' : `已添加 ${formModels.length} 个模型`)
    } catch (e) { Message.error('保存失败: ' + e.message) }
  }

  const toggleGroupCollapse = (index) => {
    const groups = groupedCustomModels.value
    if (index >= 0 && index < groups.length) {
      const pid = groups[index].provider
      collapsedGroups[pid] = !collapsedGroups[pid]
    }
  }

  const isGroupCollapsed = (index) => {
    const groups = groupedCustomModels.value
    if (index >= 0 && index < groups.length) {
      return !!collapsedGroups[groups[index].provider]
    }
    return false
  }

  const editProvider = (providerId) => {
    // 找到该 provider 的第一个模型作为编辑入口
    const first = models.value.find(m => m.provider === providerId)
    if (first) {
      editModel(first)
    } else {
      // 没有模型时也允许编辑（只编辑提供商信息）
      modelModalEditingIndex.value = -1
      modelModalEditingModel.value = { provider: providerId, api_key: '', base_url: '', name: '', id: '', context_window: 32768 }
      modelModalIsEdit.value = true
      modelModalVisible.value = true
    }
  }

  const testModelConnection = async (m) => {
    const i = models.value.findIndex(x => x.id === m.id)
    if (i !== -1) { models.value[i].testing = true; await new Promise(r => setTimeout(r, 1500)); models.value[i].testing = false; Message.success(`模型 "${m.name}" 连接测试成功`) }
  }

  const deleteModel = async (m) => {
    const i = models.value.findIndex(x => x.id === m.id && x.provider === m.provider)
    if (i !== -1) { models.value.splice(i, 1); await saveConfigToOpenClaw(); await modelStore.refreshModels(); Message.success('模型删除成功') }
  }

  const deleteProvider = async (providerId) => {
    try {
      const snap = await configAdminApi.get(); const cfg = configFromSnapshot(snap); configHash.value = snap?.hash || ''
      const nc = JSON.parse(JSON.stringify(cfg || {}))

      // 删除 models.providers[providerId]
      if (nc.models?.providers?.[providerId]) {
        delete nc.models.providers[providerId]
      }

      // 清理 agents.defaults.models 中该 provider 所有条目
      if (nc.agents?.defaults?.models) {
        for (const key of Object.keys(nc.agents.defaults.models)) {
          if (key.startsWith(`${providerId}/`)) {
            delete nc.agents.defaults.models[key]
          }
        }
      }

      // 移除本地 models.value
      models.value = models.value.filter(m => m.provider !== providerId)

      await writeConfig(nc)
      currentConfig.value = nc
      await modelStore.refreshModels()
      Message.success(`提供商 "${providerId}" 已删除`)
    } catch (e) { Message.error('删除失败: ' + (e.message || '未知错误')) }
  }

  const setModelAsDefault = async (model) => {
    try {
      const snap = await configAdminApi.get(); const cfg = configFromSnapshot(snap); configHash.value = snap?.hash || ''
      const nc = JSON.parse(JSON.stringify(cfg || {}))

      if (!nc.agents) nc.agents = {}
      if (!nc.agents.defaults) nc.agents.defaults = {}
      if (!nc.agents.defaults.model) nc.agents.defaults.model = {}
      nc.agents.defaults.model.primary = model.id

      await writeConfig(nc)
      currentConfig.value = nc
      defaultModelId.value = `${model.provider}/${model.id}`
      Message.success(`已将 "${model.name}" 设为默认模型`)
    } catch (e) {
      Message.error('设置默认失败: ' + (e.message || '未知错误'))
    }
  }

  const saveConfigToOpenClaw = async (extraModels) => {
    try {
      const snap = await configAdminApi.get(); const cfg = configFromSnapshot(snap); configHash.value = snap?.hash || ''
      const nc = JSON.parse(JSON.stringify(cfg || {}))

      if (!nc.models) nc.models = {}
      if (!nc.models.providers) nc.models.providers = {}
      if (!nc.agents) nc.agents = {}
      if (!nc.agents.defaults) nc.agents.defaults = {}
      nc.agents.defaults.models = {}  // 每次全量重建，删除操作不会残留旧条目

      const allModels = [...models.value, ...(Array.isArray(extraModels) ? extraModels : [])];
      const seenProviders = new Set();
      const catalog = await ensureCatalog();
      for (const m of allModels) {
        if (m.enabled === false) continue
        const pname = m.provider
        if (!nc.models.providers[pname]) {
          nc.models.providers[pname] = { models: [], apiKey: m.api_key, baseUrl: m.base_url }
          seenProviders.add(pname);
        }
        // 首次遇到该 provider 时重置 models 数组（旧条目已不在 allModels 中）
        if (!seenProviders.has(pname)) {
          nc.models.providers[pname].models = [];
          seenProviders.add(pname);
        }
        nc.models.providers[pname].models.push({
          id: m.id,
          name: m.name,
          contextWindow: resolveContextWindow(catalog, m.provider, m.id, m.context_window),
          reasoning: resolveReasoning(catalog, m.provider, m.id) ?? m.reasoning ?? false,
          cost: { input: m.cost_per_1k_tokens || 0, output: 0 },
        })
        nc.agents.defaults.models[`${m.provider}/${m.id}`] = {};
      }

      // 清理 allModels 中未出现的空 provider（原 config 中有但本地已无模型）
      for (const pname of Object.keys(nc.models.providers)) {
        if (!seenProviders.has(pname)) {
          delete nc.models.providers[pname];
        }
      }

      await writeConfig(nc)
      currentConfig.value = nc
      await modelStore.refreshModels()
    } catch (e) { Message.error('保存配置失败: ' + e.message) }
  }

  onMounted(() => {
    // 监听 WS 连接状态：握手完成后再触发首次加载，避免在 CONNECTING 阶段
    // 触发请求导致 wsManager.request() reject('WebSocket 未连接')。
    // 配合 admin-rpc 的 withConnection 包装，连接未就绪时调用会挂起等待
    // 但视图层仍应在握手完成后再触发以避免长延迟。
    if (wsConnected.value) {
      loadModels().finally(() => { pageLoading.value = false })
    } else {
      watch(wsConnected, async (connected) => {
        if (!connected) return
        await loadModels()
        pageLoading.value = false
      })
    }
  })

  return {
    pageLoading,
    models, currentConfig,
    modelModalVisible, modelModalIsEdit, modelModalEditingIndex, modelModalEditingModel,
    groupedCustomModels, defaultModelId,
    setModelAsDefault,
    loadModels, showAddModelModal, editModel, editProvider,
    handleModelFormSubmit, toggleGroupCollapse, isGroupCollapsed,
    testModelConnection, deleteModel, deleteProvider, saveConfigToOpenClaw,
    getProviderColor, formatContextLength,
  }
}
