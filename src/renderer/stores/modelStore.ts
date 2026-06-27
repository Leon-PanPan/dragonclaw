// modelStore.ts - 模型列表状态管理
// 集中管理模型列表，所有组件共享响应式状态，解决模型增删后不同步的问题

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { modelAdminApi } from '@/api/admin-rpc'
import { ensureCatalog, resolveReasoning, resolveReasoningOptions } from '@/utils/models.dev'

export interface ModelItem {
  id: string
  name: string
  provider: string
  contextWindow?: number
  reasoning?: boolean | null
  reasoningOptions?: any[] | null
}

export interface GroupedModels {
  provider: string
  models: ModelItem[]
}

export const useModelStore = defineStore('model', () => {
  const models = ref<ModelItem[]>([])
  const loading = ref(false)
  const lastFailedAt = ref(0) // 最近一次失败时间戳；>0 表示需要重试
  let _loadPromise: Promise<void> | null = null

  const groupedModels = computed<GroupedModels[]>(() => {
    const map: Record<string, ModelItem[]> = {}
    for (const m of models.value) {
      const p = m.provider || 'default'
      if (!map[p]) map[p] = []
      map[p].push({
        id: m.id,
        name: m.name || m.id,
        provider: p,
        reasoning: m.reasoning,
        reasoningOptions: m.reasoningOptions,
      })
    }
    return Object.entries(map)
      .map(([provider, list]) => ({ provider, models: list }))
      .sort((a, b) => a.provider.localeCompare(b.provider))
  })

  // 强制从后端拉取（用于添加/删除/改 provider 后的同步）
  // 失败时不抛错，吞掉并标记 lastFailedAt，调用方下次仍能重试
  async function refreshModels(): Promise<void> {
    if (_loadPromise) return _loadPromise
    _loadPromise = (async () => {
      loading.value = true
      try {
        const r = await modelAdminApi.list()
        const rawModels = r?.models || []
        const catalog = await ensureCatalog()
        models.value = rawModels.map(m => {
          const reasoning = resolveReasoning(catalog, m.provider, m.id)
          const reasoningOptions = resolveReasoningOptions(catalog, m.provider, m.id)
          console.debug('[modelStore] model:', m.provider + '/' + m.id, '| reasoning:', reasoning, '| reasoningOptions:', reasoningOptions)
          return {
            id: m.id,
            name: m.name || m.id,
            provider: m.provider || 'default',
            contextWindow: m.contextWindow,
            reasoning,
            reasoningOptions,
          }
        })
        // 成功：清除失败标记
        lastFailedAt.value = 0
      } catch (e) {
        // 失败：保留旧数据（如果有），标记失败以便下次重新拉
        lastFailedAt.value = Date.now()
        console.warn('[modelStore] 加载模型失败，将在下次调用时重试:', (e as Error).message)
      } finally {
        loading.value = false
        _loadPromise = null
      }
    })()
    return _loadPromise
  }

  // 首次进入或内存空时加载；如果之前失败过也强制重试
  async function ensureLoaded(): Promise<void> {
    if (models.value.length > 0 && lastFailedAt.value === 0) return
    return refreshModels()
  }

  function getModelById(id: string): ModelItem | null {
    if (!id) return null
    // 优先精确匹配 provider/modelId
    for (const g of groupedModels.value) {
      const m = g.models.find(x => `${x.provider}/${x.id}` === id)
      if (m) return m
    }
    // 回退：纯 id 匹配
    for (const g of groupedModels.value) {
      const m = g.models.find(x => x.id === id)
      if (m) return m
    }
    return null
  }

  return {
    models,
    loading,
    groupedModels,
    refreshModels,
    ensureLoaded,
    getModelById,
  }
})
