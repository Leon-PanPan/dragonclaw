<template>
  <a-drawer
    :visible="props.visible"
    :title="props.agent?.name ? '安装 - ' + props.agent.name : '安装智能体'"
    :width="720"
    :footer="null"
    :closable="!saving"
    @update:visible="val => emit('update:visible', val)"
    @close="handleClose"
  >
    <div class="drawer-edit-layout">
      <!-- 左侧：竖排 Tab 列表 -->
      <div class="drawer-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="['drawer-tab-item', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </div>
      </div>

      <!-- 右侧：编辑区 -->
      <div class="drawer-editor">
        <!-- 设置 Tab -->
        <template v-if="activeTab === 'settings'">
          <div class="settings-form">
            <div class="settings-section-title">基础设置</div>

            <!-- 头像 -->
            <div class="form-group">
              <div class="form-label">头像</div>
              <div class="avatar-row">
                <div class="avatar-preview" :style="{ backgroundColor: '#165DFF' }" @click="selectAvatar">
                  <img v-if="formData.avatarPreview" :src="formData.avatarPreview" />
                  <icon-camera v-else />
                </div>
                <span class="avatar-hint">点击选择头像（保存到 ~/.openclaw/assets/avatar/）</span>
                <input type="file" ref="avatarInputRef" accept="image/*" style="display:none" @change="onAvatarChange" />
              </div>
            </div>

            <!-- 智能体 ID -->
            <div class="form-group">
              <div class="form-label">智能体 ID <span class="required">*</span></div>
              <a-input v-model="formData.id" placeholder="cloud-coder（仅英文/数字/-/_）" />
              <div class="form-hint">对应 openclaw.json agents.list[].id，需唯一</div>
            </div>

            <!-- 名称 -->
            <div class="form-group">
              <div class="form-label">智能体名称 <span class="required">*</span></div>
              <a-input v-model="formData.name" placeholder="给智能体起个名字吧" />
            </div>

            <!-- 工作区 -->
            <div class="form-group">
              <div class="form-label">工作区目录 <span class="required">*</span></div>
              <div class="workspace-picker">
                <a-input v-model="formData.workspace" placeholder="选择或输入工作区目录" />
                <a-button @click="selectWorkspaceFolder">
                  <template #icon><icon-folder /></template>
                  浏览
                </a-button>
              </div>
              <div class="form-hint">Gateway 会在该路径下创建工作区与 IDENTITY.md</div>
            </div>

            <!-- 描述 -->
            <div class="form-group">
              <div class="form-label">描述</div>
              <a-textarea v-model="formData.description" placeholder="描述这个智能体的特点..." :rows="2" />
            </div>

            <!-- 默认模型 -->
            <div class="form-group">
              <div class="form-label">默认模型 <span class="required">*</span></div>
              <a-cascader
                v-model="formData.model"
                :options="cascaderOptions"
                :field-names="{ label: 'label', value: 'value', children: 'children' }"
                placeholder="先选择 provider，再选择模型"
                allow-search
                style="width:100%"
              />
              <div class="form-hint">对应 openclaw.json agents.list[].model（provider/modelId 形式）</div>
            </div>
          </div>
        </template>

        <!-- 提示词文件 Tab -->
        <template v-else>
          <div class="editor-header">
            <span class="editor-file">{{ currentPromptFile?.filename }}</span>
            <span class="editor-desc">{{ currentPromptFile?.description }}</span>
          </div>
          <a-textarea
            v-model="promptContents[currentPromptFile?.key]"
            :placeholder="`请输入 ${currentPromptFile?.label} 内容...`"
            :rows="16"
            class="content-textarea"
          />
        </template>

        <!-- 固定底栏：确认安装 -->
        <div class="install-footer">
          <a-button @click="resetForm">重置</a-button>
          <a-button type="primary" :loading="saving" @click="handleInstall">确认安装</a-button>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { watch } from 'vue';
import { useAgentInstallDrawer } from './useAgentInstallDrawer.js';

const props = defineProps({
  visible: Boolean,
  agent: Object,
});

const emit = defineEmits(['update:visible', 'install']);

const {
  avatarInputRef,
  activeTab,
  saving,
  formData,
  promptContents,
  promptTabs,
  currentPromptFile,
  tabs,
  cascaderOptions,
  loadModels,
  selectAvatar,
  onAvatarChange,
  selectWorkspaceFolder,
  resetForm,
  handleInstall: handleInstallInner,
  setSaving,
} = useAgentInstallDrawer(props, emit);

function handleInstall() {
  handleInstallInner();
}

function handleClose() {
  emit('update:visible', false);
}

// 暴露 setSaving 给父组件（doInstall 结束时恢复）
defineExpose({ setSaving });
</script>

<style scoped src="./style.scss"></style>
<style scoped>
/* 安装抽屉底栏（全局，不跟随 Tab 切换） */
.install-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #E5E6EB;
  margin-top: auto;
  flex-shrink: 0;
}

.content-textarea {
  flex: 1;
  resize: none;
  min-height: 0;
}

.required {
  color: #F53FAD;
}
</style>
