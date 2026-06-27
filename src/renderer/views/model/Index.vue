<template>
  <div class="model-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-title">
        <icon-relation class="title-icon" />
        <span>模型管理</span>
      </div>
      <div class="page-actions">
        <a-button type="primary" size="small" @click="showAddModelModal">
          <template #icon><icon-plus /></template>
          添加模型
        </a-button>
      </div>
    </div>

    <!-- 自定义模型列表 -->
     <div class="model-list">
      <div class="custom-list">
        <!-- 骨架屏 -->
        <template v-if="pageLoading">
          <a-skeleton :animation="true" class="skeleton-model-full">
            <div v-for="i in 3" :key="i" class="skeleton-provider-group">
              <div class="skeleton-provider-header">
                <a-skeleton-shape shape="circle" size="small" class="skeleton-provider-logo" />
                <a-skeleton-line :rows="1" :line-height="16" :widths="['120px']" />
              </div>
              <div class="skeleton-model-table">
                <div class="skeleton-table-header">
                  <a-skeleton-line :rows="1" :line-height="12" :widths="['100%']" />
                </div>
                <div v-for="j in 3" :key="j" class="skeleton-table-row">
                  <a-skeleton-line :rows="1" :line-height="14" :widths="['100%']" />
                </div>
              </div>
            </div>
          </a-skeleton>
        </template>
        <template v-else>
        <div v-if="groupedCustomModels.length === 0" class="custom-empty">
          <a-empty description="暂未配置任何模型，点击右上角添加" />
        </div>

        <div v-for="(group, gi) in groupedCustomModels" :key="group.provider" class="provider-group">
          <!-- Provider 分组头 -->
          <div class="provider-header" @click="toggleGroupCollapse(gi)">
            <div class="provider-info">
              <img
                :src="group.providerLogo"
                class="provider-logo"
                @error="e => e.target.style.display = 'none'"
              />
              <span class="provider-name">{{ group.providerName }}</span>
              <a-tag :color="getProviderColor(group.provider)" size="small">{{ group.provider }}</a-tag>
              <span class="provider-count">{{ group.models.length }} 个模型</span>
            </div>
            <div class="provider-actions" @click.stop>
              <a-popconfirm content="确定删除该提供商及其所有模型？" @ok="onDeleteProvider(group.provider)">
                <a-button type="text" size="small" status="danger" :loading="deletingProviderId === group.provider">
                  <template #icon><icon-delete /></template>
                  删除提供商
                </a-button>
              </a-popconfirm>
              <span class="collapse-arrow" :class="{ collapsed: isGroupCollapsed(gi) }">
                <icon-up />
              </span>
            </div>
          </div>

          <!-- 模型列表 -->
          <div v-show="!isGroupCollapsed(gi)" class="model-table">
            <div class="table-header">
              <span class="col-name">模型名称</span>
              <span class="col-cap">支持功能</span>
              <span class="col-ctx">上下文长度</span>
              <span class="col-resp">响应时间</span>
              <span class="col-act">操作</span>
            </div>
            <div v-for="model in group.models" :key="model.id" class="table-row">
              <span class="col-name">
                <span class="model-name">{{ model.name }}</span>
                <span class="model-id">{{ model.id }}</span>
              </span>
              <span class="col-cap">
                <span class="cap-icon" :class="{ active: model._toolCall !== false }" title="工具调用">
                  <icon-tool />
                </span>
                <span class="cap-icon" :class="{ active: model._reasoning !== false }" title="思考">
                  <icon-bulb />
                </span>
                <span class="cap-icon" :class="{ active: model._attachment !== false }" title="附件">
                  <icon-file />
                </span>
              </span>
              <span class="col-ctx">
                <span class="col-value">{{ formatContextLength(model._contextWindow) }}</span>
              </span>
              <span class="col-resp">
                <span class="col-value">{{ model.avg_response_time ? model.avg_response_time + ' ms' : '-' }}</span>
              </span>
              <span class="col-act">
                <a-button
                  v-if="defaultModelId === `${model.provider}/${model.id}`"
                  type="text"
                  size="mini"
                  disabled
                >已设默认</a-button>
                <a-button
                  v-else
                  type="text"
                  size="mini"
                  @click="setModelAsDefault(model)"
                >设为默认</a-button>
                <a-button type="text" size="mini" @click="testModelConnection(model)">测试</a-button>
                <a-popconfirm content="确定删除该模型？" @ok="onDeleteModel(model)">
                  <a-button type="text" size="mini" status="danger" :loading="deletingModelId === model.id">删除</a-button>
                </a-popconfirm>
              </span>
            </div>
          </div>
        </div>
        </template>
      </div>
     </div>
    

    <!-- 添加/编辑模型弹窗 -->
    <ModelFormModal
      ref="modelFormModalRef"
      v-model:visible="modelModalVisible"
      :is-edit="modelModalIsEdit"
      :editing-index="modelModalEditingIndex"
      :editing-model="modelModalEditingModel"
      @submit="onModelFormSubmit"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { IconPlus, IconEdit, IconUp, IconRelation, IconTool, IconBulb, IconFile, IconDelete } from '@arco-design/web-vue/es/icon'
import { useModel } from './useModel.js';
import ModelFormModal from './components/ModelFormModal.vue';
const {
  pageLoading,
  models, currentConfig,
  modelModalVisible, modelModalIsEdit, modelModalEditingIndex, modelModalEditingModel,
  groupedCustomModels, defaultModelId,
  setModelAsDefault,
  loadModels, showAddModelModal, editModel,
  handleModelFormSubmit, toggleGroupCollapse, isGroupCollapsed,
  testModelConnection, deleteModel, deleteProvider,
  getProviderColor, formatContextLength,
} = useModel();

const modelFormModalRef = ref(null);
const deletingModelId = ref(null);
const deletingProviderId = ref(null);

async function onDeleteModel(model) {
  deletingModelId.value = model.id;
  try { await deleteModel(model); } finally { deletingModelId.value = null; }
}

async function onDeleteProvider(pid) {
  deletingProviderId.value = pid;
  try { await deleteProvider(pid); } finally { deletingProviderId.value = null; }
}

async function onModelFormSubmit(payload) {
  await handleModelFormSubmit(payload);
  modelFormModalRef.value?.setSaving(false);
}
</script>

<style scoped src="./style.scss"></style>
