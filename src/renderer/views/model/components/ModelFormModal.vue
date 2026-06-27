<template>
  <a-modal
    :visible="visible"
    :title="isEdit ? '编辑模型' : '添加模型'"
    :width="600"
    :footer="null"
    @cancel="handleCancel"
  >
    <div class="model-form">
      <!-- ▸ 提供商信息 -->
      <div class="mf-section">
        <div class="mf-section-title">提供商信息</div>

        <div class="mf-row">
          <span class="mf-label">提供商</span>
          <a-select v-model="form.provider" placeholder="搜索或选择提供商" style="flex:1" allow-search allow-clear @change="onProviderChange">
            <template v-if="providerGroups.recommended.length">
              <a-optgroup label="推荐">
                <a-option v-for="p in providerGroups.recommended" :key="p.id" :value="p.id">
                  <span class="mf-provider-option">
                    <img :src="`https://models.dev/logos/${p.id}.svg`" class="mf-provider-logo" @error="onLogoError" />
                    {{ p.name }}
                  </span>
                </a-option>
              </a-optgroup>
            </template>
            <template v-if="providerGroups.more.length">
              <a-optgroup label="更多">
                <a-option v-for="p in providerGroups.more" :key="p.id" :value="p.id">
                  <span class="mf-provider-option">
                    <img :src="`https://models.dev/logos/${p.id}.svg`" class="mf-provider-logo" @error="onLogoError" />
                    {{ p.name }}
                  </span>
                </a-option>
              </a-optgroup>
            </template>
            <template v-if="providerGroups.extra.length">
              <a-optgroup label="其他">
                <a-option v-for="p in providerGroups.extra" :key="p.id" :value="p.id">
                  <span class="mf-provider-option">
                    <img :src="`https://models.dev/logos/${p.id}.svg`" class="mf-provider-logo" @error="onLogoError" />
                    {{ p.name }}
                  </span>
                </a-option>
              </a-optgroup>
            </template>
          </a-select>
        </div>

        <div class="mf-row">
          <span class="mf-label">API 密钥</span>
          <a-input-password v-model="form.api_key" placeholder="输入 API 密钥" style="flex:1" />
        </div>

        <div class="mf-row">
          <span class="mf-label">基础 URL</span>
          <a-input v-model="form.base_url" placeholder="例如: https://api.deepseek.com" style="flex:1" />
        </div>
      </div>

      <!-- ▸ 模型列表 -->
      <div class="mf-section">
        <div class="mf-section-title">模型列表</div>

        <div
          v-for="(model, idx) in form.models"
          :key="idx"
          class="mf-model-row"
        >
          <div class="mf-model-fields">
            <a-input v-model="model.name" placeholder="模型名称" size="small" style="flex:2" />
            <a-input v-model="model.id" placeholder="模型 ID" size="small" style="flex:2" />
          </div>
          <a-button type="text" size="mini" status="danger" @click="removeModel(idx)" :disabled="form.models.length <= 1 && isEdit">
            <template #icon><icon-delete /></template>
          </a-button>
        </div>

        <a-button type="dashed" long @click="addModel" style="margin-top:4px">
          <template #icon><icon-plus /></template>
          添加模型
        </a-button>
      </div>

      <!-- 操作按钮 -->
      <div class="mf-footer">
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSubmit">保存</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconDelete } from '@arco-design/web-vue/es/icon';
import { ensureCatalog, resolveReasoning, listProviderModels, getCatalog } from '@/utils/models.dev.js';
import { RECOMMENDED, EXTRA_PROVIDERS, getProviderNameSync, getExtraBaseUrl } from './recommendedProviders.js';

const props = defineProps({
  visible: Boolean,
  isEdit: { type: Boolean, default: false },
  editingIndex: { type: Number, default: -1 },
  editingModel: { type: Object, default: null },
});

const emit = defineEmits(['update:visible', 'submit']);

const saving = ref(false);
const catalogLoading = ref(false);
const catalog = ref({});

const form = reactive({
  provider: 'deepseek',
  api_key: '',
  base_url: '',
  models: [{ name: '', id: '', contextWindow: 32768 }],
});

// 构建提供商下拉列表：推荐 / 更多 / 其他
const providerGroups = computed(() => {
  const cat = catalog.value || {};
  const allCatalogIds = Object.keys(cat);
  const recommended = [];
  const more = [];
  const seen = new Set();

  for (const id of RECOMMENDED) {
    seen.add(id);
    if (EXTRA_PROVIDERS[id]) {
      recommended.push({ id, name: EXTRA_PROVIDERS[id].name });
    } else {
      // 即使 catalog 未加载，也用 hardcoded fallback 名显示
      recommended.push({ id, name: getProviderNameSync(id, cat) });
    }
  }
  for (const id of allCatalogIds) {
    if (!seen.has(id) && !EXTRA_PROVIDERS[id]) {
      seen.add(id);
      more.push({ id, name: getProviderNameSync(id, cat) });
    }
  }
  more.sort((a, b) => a.name.localeCompare(b.name));

  const extra = [];
  for (const p of Object.values(EXTRA_PROVIDERS)) {
    if (!seen.has(p.id)) {
      extra.push({ id: p.id, name: p.name });
    }
  }

  return { recommended, more, extra };
});

// 自动加载目录
onMounted(() => {
  ensureCatalog().then(() => {
    catalog.value = getCatalog() || {};
    setDefaultModels('deepseek');
  }).catch(() => {});
});

function setDefaultModels(providerId) {
  const cat = catalog.value || {};
  const catalogModels = listProviderModels(cat, providerId);
  if (catalogModels.length > 0) {
    form.models = catalogModels.map(m => ({ ...m }));
  } else {
    form.models = [{ name: '', id: '', contextWindow: 32768 }];
  }
}

// 重置表单
watch(() => props.visible, (v) => {
  if (!v) return;
  if (props.isEdit && props.editingModel) {
    const m = props.editingModel;
    form.provider = m.provider || 'deepseek';
    form.api_key = m.api_key || '';
    form.base_url = m.base_url || '';
    form.models = [{ name: m.name || '', id: m.id || '', contextWindow: m.context_window || 32768 }];
  } else {
    form.provider = 'deepseek';
    form.api_key = '';
    const defaultBaseUrl = getExtraBaseUrl('deepseek') || catalog.value?.['deepseek']?.api || '';
    form.base_url = defaultBaseUrl;
    setDefaultModels('deepseek');
  }
});

// 切换提供商 → 从 models.dev 填 baseUrl + 模型列表
async function onProviderChange(id) {
  const extra = EXTRA_PROVIDERS[id];
  if (extra) {
    form.base_url = extra.baseUrl || '';
    if (!props.isEdit) form.models = [{ name: '', id: '', contextWindow: 32768 }];
    return;
  }

    catalogLoading.value = true;
  try {
    await ensureCatalog();
    catalog.value = getCatalog() || {};
    const entry = catalog.value[id];
    if (entry) {
      form.base_url = entry.api || '';
      if (!props.isEdit) setDefaultModels(id);
    }
  } finally {
    catalogLoading.value = false;
  }
}

function addModel() {
  form.models.push({ name: '', id: '', contextWindow: 32768 });
}

function removeModel(idx) {
  form.models.splice(idx, 1);
}

function handleSubmit() {
  if (!form.api_key.trim()) {
    Message.warning('请输入 API 密钥');
    return;
  }
  const validModels = form.models.filter(m => m.name.trim() || m.id.trim());
  if (validModels.length === 0) {
    Message.warning('请至少添加一个模型');
    return;
  }
  saving.value = true;
  const cat = catalog.value || {};
  emit('submit', {
    provider: form.provider,
    api_key: form.api_key,
    base_url: form.base_url,
    models: validModels.map(m => ({
      name: m.name || m.id,
      id: m.id || m.name,
      contextWindow: m.contextWindow || 32768,
      reasoning: resolveReasoning(cat, form.provider, m.id || m.name) ?? false,
    })),
    editingIndex: props.editingIndex,
    isEdit: props.isEdit,
  });
}

function handleCancel() {
  emit('update:visible', false);
}

function onLogoError(e) {
  e.target.style.display = 'none';
}

function setSaving(val) {
  saving.value = val;
}

defineExpose({ setSaving });
</script>

<style scoped>
.model-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mf-provider-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mf-provider-logo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
}

.mf-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mf-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1D2129;
  display: flex;
  align-items: center;
}

.mf-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mf-label {
  font-size: 13px;
  color: #4E5969;
  width: 70px;
  flex-shrink: 0;
  text-align: right;
}

.mf-model-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 6px 6px;
  border-radius: 6px;
  background: #F7F8FA;
}

.mf-model-fields {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.mf-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #E5E6EB;
}
</style>
