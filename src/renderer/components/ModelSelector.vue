<template>
  <a-dropdown trigger="click" position="top">
    <slot name="trigger">
      <span class="ms-trigger">
        <img
          v-if="activeProvider"
          :src="`https://models.dev/logos/${activeProvider}.svg`"
          class="ms-trigger-logo"
          @error="e => e.target.style.display = 'none'"
        />
        <span class="ms-current">{{ currentName || placeholder }}</span>
        <icon-down class="ms-arrow" />
      </span>
    </slot>
    <template #content>
      <div class="ms-dropdown">
        <template v-for="group in modelStore.groupedModels" :key="group.provider">
          <div class="ms-group-header">{{ group.provider }}</div>
          <a-doption
            v-for="model in group.models"
            :key="`${model.provider}/${model.id}`"
            :value="`${model.provider}/${model.id}`"
            :class="{ 'ms-active': isModelSelected(model) }"
            @click="selectModel(model)"
          >
            <span class="ms-option">
              <img
                :src="`https://models.dev/logos/${model.provider}.svg`"
                class="ms-option-logo"
                @error="e => e.target.style.display = 'none'"
              />
              {{ model.name }}
            </span>
          </a-doption>
        </template>
        <div v-if="modelStore.groupedModels.length === 0" class="ms-empty">
          {{ modelStore.loading ? '加载中...' : '暂无模型' }}
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { IconDown } from '@arco-design/web-vue/es/icon'
import { useModelStore } from '@/stores/modelStore'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '选择模型' },
})

const emit = defineEmits(['update:modelValue', 'select'])

const modelStore = useModelStore()
const activeProvider = ref('')
const activeModel = ref('')

const getModelById = (id) => {
  if (!id) return null
  // 优先精确匹配 provider/modelId（与 openclaw.json 格式一致）
  for (const g of modelStore.groupedModels) {
    const m = g.models.find(x => `${x.provider}/${x.id}` === id)
    if (m) return m
  }
  // 回退：纯 model.id 匹配（兼容旧格式；同名不同 provider 时用 activeProvider 消歧义）
  if (activeProvider.value && activeModel.value && activeModel.value === id) {
    for (const g of modelStore.groupedModels) {
      const m = g.models.find(x => x.id === id && x.provider === activeProvider.value)
      if (m) return m
    }
  }
  // 最后回退：全量纯 id 匹配（仅在无法消歧义时返回第一个）
  for (const g of modelStore.groupedModels) {
    const m = g.models.find(x => x.id === id)
    if (m) return m
  }
  return null
}

const currentName = computed(() => {
  if (activeProvider.value && activeModel.value) {
    const m = getModelById(`${activeProvider.value}/${activeModel.value}`)
    if (m) return m.name
  }
  if (!props.modelValue) return ''
  const selected = getModelById(props.modelValue)
  return selected ? selected.name : ''
})

const isModelSelected = (model) => {
  if (activeProvider.value && activeModel.value) {
    return model.provider === activeProvider.value && model.id === activeModel.value
  }
  // v-model 回退
  if (!props.modelValue) return false
  return `${model.provider}/${model.id}` === props.modelValue
}

const selectModel = (model) => {
  activeProvider.value = model.provider
  activeModel.value = model.id
  const fullId = `${model.provider}/${model.id}`
  console.debug('[ModelSelector] selectModel:', fullId, '| reasoning:', model.reasoning, '| reasoningOptions:', model.reasoningOptions)
  emit('update:modelValue', fullId)
  emit('select', {
    provider: model.provider,
    model: model.id,
    name: model.name,
    fullId,
    reasoning: model.reasoning,
    reasoningOptions: model.reasoningOptions,
  })
}

const selectedReasoning = computed(() => {
  if (!activeProvider.value || !activeModel.value) return null
  const m = getModelById(`${activeProvider.value}/${activeModel.value}`)
  return m?.reasoning ?? null
})

const selectedReasoningEfforts = computed(() => {
  if (!activeProvider.value || !activeModel.value) return null
  const m = getModelById(`${activeProvider.value}/${activeModel.value}`)
  const opts = m?.reasoningOptions
  console.debug('[ModelSelector] selectedReasoningEfforts:', activeProvider.value + '/' + activeModel.value, '| reasoningOptions:', opts, '| reasoning:', m?.reasoning)
  if (!opts || !Array.isArray(opts)) return null
  // 优先使用 effort 类型的 values
  const effort = opts.find(o => o.type === 'effort')
  if (effort?.values?.length) return effort.values
  // 如果有 toggle 类型但没有 effort，返回默认级别
  const hasToggle = opts.some(o => o.type === 'toggle')
  if (hasToggle) return ['low', 'medium', 'high']
  return null
})

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    activeProvider.value = ''
    activeModel.value = ''
    return
  }
  const m = getModelById(newVal)
  if (m) {
    activeProvider.value = m.provider
    activeModel.value = m.id
  } else {
    activeProvider.value = ''
    activeModel.value = ''
  }
})

onMounted(async () => {
  // 每次 mount（如打开对话界面、切换对话）都重新拉取，保证拿到最新数据
  // store 内部 promise 去重，不会并发拉多次；但如果上次失败（lastFailedAt>0）会强制重试
  await modelStore.ensureLoaded()
  if (props.modelValue) {
    const m = getModelById(props.modelValue)
    if (m) {
      activeProvider.value = m.provider
      activeModel.value = m.id
    }
  }
})

// 模型列表变化时（例如其他视图新增/删除了模型）重新解析当前选中
watch(() => modelStore.models.length, (newLen) => {
  if (newLen > 0 && props.modelValue) {
    const m = getModelById(props.modelValue)
    if (m) {
      activeProvider.value = m.provider
      activeModel.value = m.id
    }
  }
})

defineExpose({
  currentName,
  activeProvider,
  selectedReasoning,
  selectedReasoningEfforts,
  getModelById,
})
</script>

<style scoped>
.ms-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-text-2);
  user-select: none;
}
.ms-trigger-logo {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}
.ms-trigger:hover {
  background: rgba(0, 0, 0, 0.04);
}
.ms-current {
  color: var(--color-text-1);
}
.ms-arrow {
  font-size: 10px;
  color: var(--color-text-4);
}
.ms-dropdown {
  min-width: 180px;
}

/* 滚动条覆盖 — 组件内自含，不依赖全局 */
.ms-dropdown::-webkit-scrollbar {
  width: 3px;
}
.ms-dropdown::-webkit-scrollbar-track {
  background: transparent;
}
.ms-dropdown::-webkit-scrollbar-thumb {
  background: #D0D5DD;
  border-radius: 2px;
}
.ms-dropdown::-webkit-scrollbar-thumb:hover {
  background: #B0B5BD;
}
.ms-group-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-4);
  padding: 6px 12px 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ms-active {
  color: #165dff !important;
  background-color: #e8f3ff !important;
}
.ms-option {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ms-option-logo {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}
.ms-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--color-text-4);
  text-align: center;
}
</style>
<style>
.arco-scrollbar-thumb-direction-vertical .arco-scrollbar-thumb-bar{
  width: 5px;
}
.arco-scrollbar-track-direction-vertical{
  width: 5px;
}
</style>
