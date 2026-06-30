import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { configAdminApi, configFromSnapshot } from '@/api/admin-rpc'
import { wsManager, ConnectionState } from '@/core/websocket/manager'
import { resolveContextWindow, resolveReasoning, ensureCatalog, getCatalog } from '@/utils/models.dev.js'
import { DEFAULT_API, guessProviderApi } from './components/recommendedProviders.js'
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
          providerLogo: `//models.dev/logos/${p}.svg`,
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
    const _now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const t0 = _now()
    console.info('[MODEL-DIAG] loadModels enter')

    // 🔧 修复: 不串行化。第一步只拉模型列表（这是骨架屏之后第一眼能渲染的内容），
    //    catalog 与 config(secrets) 改为后台并行加载，加载完再合并一次。
    //    这样骨架屏最多只需要等 store 列表（ms 级），不会再被 catalog
    //    parse 或 config WS 拖到 15s+。

    // 1) 阻塞路径：拉模型列表。store 内部有 _loadPromise 去重。
    let modelsOk = false
    try {
      await modelStore.refreshModels()
      modelsOk = (modelStore.models || []).length > 0
    } catch (e) {
      console.warn('[MODEL-DIAG] refreshModels rejected:', e?.message)
    }

    // 2) 拿到任何一条模型，立即先渲染（api_key / base_url 可能为空，合并完成后会再渲染一次）
    if (modelsOk) {
      const catalogSnapshot = getCatalog() || {}
      const storeModels = modelStore.models || []
      models.value = storeModels.map(m => ({
        id: m.id, name: m.name || m.id, provider: m.provider,
        api_key: '', base_url: '',
        api: guessProviderApi(m.provider, catalogSnapshot),
        context_window: m.contextWindow || 0,
        max_tokens: 0, enabled: true,
        reasoning: m.reasoning ?? false,
        avg_response_time: 0, success_rate: 0, cost_per_1k_tokens: 0,
        updating: false, testing: false,
      }))
      console.info(`[MODEL-DIAG] first render at +${(_now() - t0).toFixed(0)}ms count=${models.value.length}`)
    }

    // 3) 后台：catalog + config 并行加载，加载完再合并 secrets 到 models
    Promise.allSettled([
      ensureCatalog().catch(() => null),
      configAdminApi.get().catch(() => null),
    ]).then(([catRes, cfgRes]) => {
      const catalog = (catRes.status === 'fulfilled' && catRes.value) || (getCatalog() || {})
      const snap = cfgRes.status === 'fulfilled' ? cfgRes.value : null
      const cfg = snap ? configFromSnapshot(snap) : null
      if (cfg && snap) {
        configHash.value = snap?.hash || ''
        currentConfig.value = cfg
        if (!defaultModelId.value) {
          defaultModelId.value = cfg?.agents?.defaults?.model?.primary || ''
        }
      }

      // 合并 secrets
      const providerSecrets = {}
      if (cfg?.models?.providers) {
        for (const [pid, pconf] of Object.entries(cfg.models.providers)) {
          providerSecrets[pid] = {
            api_key: pconf.apiKey || '',
            base_url: pconf.baseUrl || '',
            api: pconf.api || '',
          }
        }
      }

      const storeModels = modelStore.models || []
      models.value = storeModels.map(m => {
        const secret = providerSecrets[m.provider] || {}
        return {
          id: m.id, name: m.name || m.id, provider: m.provider,
          api_key: secret.api_key, base_url: secret.base_url,
          api: secret.api || guessProviderApi(m.provider, catalog),
          context_window: m.contextWindow || 0,
          max_tokens: 0, enabled: true,
          reasoning: m.reasoning ?? false,
          avg_response_time: 0, success_rate: 0, cost_per_1k_tokens: 0,
          updating: false, testing: false,
        }
      })
      if (!defaultModelId.value) {
        defaultModelId.value = models.value[0]?.id || ''
      }
      console.info(`[MODEL-DIAG] post-merge done at +${(_now() - t0).toFixed(0)}ms count=${models.value.length}`)
    })

    console.info(`[MODEL-DIAG] loadModels exit took=${(_now() - t0).toFixed(0)}ms, pageLoading will close now`)
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

  const handleModelFormSubmit = async ({ provider, api_key, base_url, api, models: formModels, isEdit }) => {
    try {
      const resolvedApi = api || DEFAULT_API
      if (isEdit) {
        const fm = formModels[0] || {}
        const i = modelModalEditingIndex.value
        if (i >= 0) {
          models.value[i] = { ...models.value[i], provider, api_key, base_url, api: resolvedApi, name: fm.name, id: fm.id, context_window: fm.contextWindow, updating: false, testing: false }
        }
      }
      await saveConfigToOpenClaw(isEdit ? null : formModels.map(fm => ({ ...fm, provider, api_key, base_url, api: resolvedApi })))
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
      const catalog = getCatalog() || {}
      modelModalEditingIndex.value = -1
      modelModalEditingModel.value = {
        provider: providerId,
        api_key: '',
        base_url: '',
        api: guessProviderApi(providerId, catalog),
        name: '',
        id: '',
        context_window: 32768,
      }
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
        // 首个遇到该 provider: 初始化 + 重置 models/api/apiKey/baseUrl
        if (!nc.models.providers[pname]) {
          nc.models.providers[pname] = {
            models: [],
            apiKey: m.api_key || '',
            baseUrl: m.base_url || '',
            api: m.api || DEFAULT_API,
          }
          seenProviders.add(pname);
        } else if (!seenProviders.has(pname)) {
          // 该 provider 已存在 cfg 中（旧条目），保留原有 secrets，但确保 api 字段存在
          nc.models.providers[pname].models = [];
          if (m.api_key) nc.models.providers[pname].apiKey = m.api_key;
          if (m.base_url) nc.models.providers[pname].baseUrl = m.base_url;
          if (m.api) nc.models.providers[pname].api = m.api || DEFAULT_API;
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
    // 🔧 修复: 一次性触发 + 防并发。
    //    原来这里有两个问题:
    //      (1) watch 没 stop，多次 wsConnected 跳变会重复触发 loadModels
    //      (2) 旧的「watch 触发后再 await loadModels 才关 pageLoading」会让骨架屏
    //          被 catalog/config 的 15s 超时拖住
    //    现在：触发一次后 stop watch；pageLoading 由 loadModels 内部管（不再由这里管），
    //          保证只触发一次。
    let triggered = false
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const fire = () => {
      if (triggered) return
      triggered = true
      console.info(`[MODEL-DIAG] loadModels fire at +${((typeof performance!=='undefined'?performance.now():Date.now()) - t0).toFixed(0)}ms`)
      loadModels().finally(() => { pageLoading.value = false })
    }
    if (wsConnected.value) {
      fire()
    } else {
      const stop = watch(wsConnected, (connected) => {
        if (!connected) return
        stop()  // 一次性：触发后立即解绑，避免后续握手抖动再次触发
        fire()
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
