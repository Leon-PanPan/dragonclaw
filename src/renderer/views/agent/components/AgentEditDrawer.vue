<template>
  <a-drawer
    :visible="props.visible"
    :title="agent?.name ? agent.name + ' - 编辑设置' : '编辑智能体'"
    :width="720"
    :footer="null"
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
        <!-- 设置 Tab（头像/工作区/模型） -->
        <template v-if="activeTab === 'settings'">
          <div class="settings-form">
            <div class="settings-section-title">基础设置</div>

            <!-- 头像 -->
            <div class="form-group">
              <div class="form-label">头像</div>
              <div class="avatar-row">
                <div class="avatar-preview" :style="{ backgroundColor: getAgentColor(agent?.id) }" @click="selectAvatar">
                  <img v-if="formData.avatarPreview" :src="formData.avatarPreview" />
                  <icon-camera v-else />
                </div>
                <span class="avatar-hint">点击选择头像</span>
                <input type="file" ref="avatarInputRef" accept="image/*" style="display:none" @change="onAvatarChange" />
              </div>
            </div>

            <!-- 工作区 -->
            <div class="form-group">
              <div class="form-label">工作区</div>
              <div class="workspace-picker">
                <a-input v-model="formData.workspace" placeholder="选择工作区目录" />
                <a-button @click="selectWorkspaceFolder">
                  <template #icon><icon-folder /></template>
                  浏览
                </a-button>
              </div>
              <div class="form-hint">点击浏览选择智能体的工作区文件夹</div>
            </div>

            <!-- 描述 -->
            <div class="form-group">
              <div class="form-label">描述</div>
              <a-textarea v-model="formData.desc" placeholder="描述这个智能体的特点..." :rows="3" />
              <div class="form-hint">简要描述智能体的功能和特点</div>
            </div>

            <!-- 默认模型 -->
            <div class="form-group">
              <div class="form-label">默认模型</div>
              <ModelSelector v-model="formData.model" placeholder="选择默认模型" />
              <div class="form-hint">智能体默认使用的 AI 模型</div>
            </div>

            <div class="form-actions">
              <a-button @click="resetForm">重置</a-button>
              <a-button type="primary" :loading="saving" @click="saveSettings">保存设置</a-button>
            </div>
          </div>
        </template>

        <!-- 提示词 Tab（原有引导文件编辑区） -->
        <template v-else>
          <div class="editor-header">
            <span class="editor-file">{{ currentGuideFile?.filename }}</span>
            <span class="editor-desc">{{ currentGuideFile?.description }}</span>
          </div>
          <a-textarea
            v-model="editContent"
            :placeholder="`请输入 ${currentGuideFile?.label} 内容...`"
            :rows="18"
            class="content-textarea"
            @change="onContentChange"
          />
          <div class="editor-footer-drawer">
            <span class="footer-hint">修改后点击保存将覆盖工作区配置文件</span>
            <div class="footer-actions">
              <a-button @click="resetContent">重置</a-button>
              <a-button type="primary" @click="saveCurrentFile" :loading="saving">保存</a-button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { useAgentEditDrawer } from './useAgentEditDrawer.js';
import ModelSelector from '@/components/ModelSelector.vue';

const props = defineProps({
  visible: Boolean,
  agent: Object,
  guideFiles: Array,
})

const emit = defineEmits(['update:visible', 'save-settings', 'save-file', 'reset-file', 'select-avatar'])

const {
  avatarInputRef,
  activeTab,
  saving,
  formData,
  editContent,
  originalContent,
  lastSaved,
  currentGuideFile,
  getAgentColor,
  selectAvatar,
  onAvatarChange,
  selectWorkspaceFolder,
  resetForm,
  saveSettings,
  resetContent,
  saveCurrentFile,
  onContentChange,
  tabs,
  handleClose,
} = useAgentEditDrawer(props, emit);
</script>

<style scoped src="./style.scss"></style>