<template>
  <div class="agent-config-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-title">
        <a-button v-if="viewMode !== 'discover'" type="text" size="small" @click="viewMode = 'discover'" class="back-btn">
          <template #icon><icon-left /></template>
        </a-button>
        <icon-robot class="title-icon" />
        <span v-if="viewMode === 'discover'">发现智能体</span>
        <span v-else-if="viewMode === 'my'">我创建的智能体</span>
        <span v-else>{{ getSelectedAgentName() || '编辑智能体' }}</span>
      </div>
      <div class="page-actions">
        <a-button type="text" @click="viewMode = 'my'" :class="{ 'action-active': viewMode === 'my' }">
          <template #icon><icon-user /></template>
          我创建的
        </a-button>
        <a-button type="primary" @click="showAddModal = true">
          <template #icon><icon-plus /></template>
          新建智能体
        </a-button>
        <a-button type="text" @click="showSettingsModal = true" class="settings-btn">
          <template #icon><icon-settings /></template>
        </a-button>
      </div>
    </div>

    <!-- ========== 发现页视图（默认） ========== -->
    <div v-if="viewMode === 'discover'" class="discover-view">
      <!-- 骨架屏 -->
      <template v-if="pageLoading">
        <a-skeleton :animation="true" class="skeleton-discover-full">
          <div class="skeleton-category-tabs">
            <a-skeleton-shape v-for="i in 5" :key="i" shape="square" size="small" class="skeleton-tab" />
          </div>
          <div class="skeleton-discover-grid">
            <div v-for="i in 6" :key="i" class="skeleton-discover-card">
              <a-skeleton-shape shape="circle" size="small" class="skeleton-avatar" />
              <div class="skeleton-card-lines">
                <a-skeleton-line :rows="2" :line-height="14" :line-spacing="8" :widths="['60%', '85%']" />
              </div>
              <a-skeleton-shape shape="square" size="small" class="skeleton-action" />
            </div>
          </div>
        </a-skeleton>
      </template>
      <!-- 真实内容 -->
      <template v-else>
      <!-- 顶部分类 Tab -->
      <div class="category-tabs">
        <div
          v-for="cat in categories" :key="cat.slug"
          class="category-tab"
          :class="{ active: activeCategory === cat.slug }"
          @click="activeCategory = cat.slug"
        >{{ cat.name }}</div>
      </div>

      <!-- Agent 卡片网格 -->
      <div class="discover-grid">
        <div v-for="agent in filteredDiscoverAgents" :key="agent.id" class="discover-card" @click="showAgentDetail(agent)">
          <div class="discover-card-avatar" :style="{ backgroundColor: getAgentColor(agent.id) }">
            <span v-if="agent.emoji" class="avatar-emoji">{{ agent.emoji }}</span>
            <img v-else-if="agent.avatar" :src="agent.avatar" />
            <span v-else class="avatar-letter">{{ (agent.name || agent.id).charAt(0).toUpperCase() }}</span>
          </div>
          <div class="discover-card-body">
            <div class="discover-card-name">{{ agent.name }}</div>
            <div class="discover-card-desc">{{ agent.description || '暂无描述' }}</div>
          </div>
          <div class="discover-card-action">
            <a-tag v-if="isAgentInstalled(agent.id)" color="green" size="small">已安装</a-tag>
            <a-button v-else type="outline" size="mini" @click.stop="openInstallModal(agent)">安装</a-button>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- ========== "我创建的"视图 ========== -->
    <div v-if="viewMode === 'my'" class="my-agents-view">
      <!-- 骨架屏 -->
      <template v-if="pageLoading">
        <a-skeleton :animation="true" class="skeleton-my-full">
          <div class="skeleton-my-header">
            <a-skeleton-line :rows="1" :line-height="18" :widths="['30%']" />
          </div>
          <div class="skeleton-my-list">
            <div v-for="i in 4" :key="i" class="skeleton-my-card">
              <a-skeleton-shape shape="circle" size="small" class="skeleton-avatar" />
              <div class="skeleton-card-lines">
                <a-skeleton-line :rows="2" :line-height="14" :line-spacing="8" :widths="['45%', '65%']" />
              </div>
              <div class="skeleton-my-actions">
                <a-skeleton-shape shape="square" size="small" class="skeleton-btn" />
                <a-skeleton-shape shape="square" size="small" class="skeleton-btn" />
              </div>
            </div>
          </div>
        </a-skeleton>
      </template>
      <!-- 真实内容 -->
      <template v-else>
      <div class="my-agents-list" style="margin-top: 15px;">
        <div
          v-for="agent in agents" :key="agent.id"
          class="my-agent-card"
        >
          <img v-if="agent.avatar" :src="agent.avatar" class="my-agent-avatar-img" />
          <div v-else class="my-agent-avatar" :style="{ backgroundColor: getAgentColor(agent.id) }">
            {{ (agent.name || agent.id).charAt(0).toUpperCase() }}
          </div>
          <div class="my-agent-info">
            <div class="my-agent-name">
              {{ agent.name || agent.id }}
              <a-tag v-if="agent.model" size="small" color="arcoblue">{{ getModelDisplayName(agent.model) }}</a-tag>
            </div>
            <div class="my-agent-desc">{{ agent.description || '暂无描述' }}</div>
          </div>
          <div class="my-agent-actions">
            <a-button type="text" size="small" @click.stop="openEditDrawer(agent)">编辑</a-button>
            <a-popconfirm content="确定删除该智能体？" @ok="onDeleteMyAgent(agent.id)">
              <a-button type="text" size="small" status="danger" :loading="deletingAgentId === agent.id">删除</a-button>
            </a-popconfirm>
          </div>
        </div>
        <div v-if="agents.length === 0" class="my-agents-empty">
          <a-empty description="还没创建过智能体，去发现页看看吧" />
        </div>
      </div>
      </template>
    </div>

    <!-- ========== 编辑视图：引导文件配置区 ========== -->
    <div v-if="viewMode === 'edit'" class="config-layout">
      <!-- 左侧：智能体列表 -->
      <div class="agent-sidebar">
        <div class="agent-list">
          <div
            v-for="agent in agents"
            :key="agent.id"
            class="agent-item"
            :class="{ 'is-active': selectedAgentId === agent.id, 'is-default': agent.id === 'cto' }"
            @click="selectAgent(agent.id)"
          >
            <div class="agent-avatar" :style="{ backgroundColor: getAgentColor(agent.id) }">
              {{ agent.name?.charAt(0)?.toUpperCase() || agent.id.charAt(0).toUpperCase() }}
            </div>
            <div class="agent-info">
              <div class="agent-name">{{ agent.name || agent.id }}</div>
              <div class="agent-workspace">{{ agent.workspace || '默认工作区' }}</div>
            </div>
            <a-tag v-if="selectedAgentId === agent.id" color="arcoblue" size="small">当前</a-tag>
          </div>
        </div>
      </div>

      <!-- 右侧：引导文件编辑区 -->
      <div class="config-main">
        <div class="config-tabs">
          <div
            v-for="tab in guideFiles"
            :key="tab.key"
            class="config-tab"
            :class="{ 'is-active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <span class="tab-label">{{ tab.label }}</span>
            <span class="tab-hint">{{ tab.filename }}</span>
          </div>
        </div>

        <div class="config-editor">
          <div class="editor-header">
            <div class="editor-title">
              <span class="editor-file">{{ currentGuideFile?.filename }}</span>
              <span class="editor-desc">{{ currentGuideFile?.description }}</span>
            </div>
          </div>

          <div class="editor-body">
            <div v-if="loading" class="editor-loading">
              <icon-loading />
              <span>加载中...</span>
            </div>
            <div v-else-if="fileNotFound" class="editor-not-found">
              <icon-file type="image/svg+xml" />
              <div class="not-found-title">文件不存在或已删除</div>
              <div class="not-found-desc">{{ currentGuideFile?.filename }} 在当前智能体的工作区中不存在</div>
              <div class="not-found-tip">这不影响正常使用，您可以切换到其他文件或保存新内容</div>
            </div>
            <a-textarea
              v-else
              v-model="editContent"
              :placeholder="`请输入 ${currentGuideFile?.label} 内容...`"
              :rows="20"
              class="content-textarea"
              @change="onContentChange"
            />
          </div>

          <div class="editor-footer">
            <div class="footer-left">
              <icon-info-circle class="footer-icon" />
              <span>修改后点击"保存"按钮将覆盖对应的工作区配置文件</span>
              <span v-if="lastSaved" class="last-saved">，上次保存: {{ lastSaved }}</span>
            </div>
            <div class="footer-right">
              <a-button @click="resetContent" :disabled="!hasChanges">
                <template #icon><icon-refresh /></template>
                重置
              </a-button>
              <a-button type="primary" @click="saveCurrentFile" :loading="saving">
                <template #icon><icon-save /></template>
                保存 {{ currentGuideFile?.label }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 设置弹窗 ========== -->
    <a-modal v-model:visible="showSettingsModal" title="智能体设置" :width="460" :footer="null">
      <div class="settings-item">
        <div class="settings-item-left">
          <div class="settings-label">多智能体模式</div>
          <div class="settings-desc">开启后可使用多个智能体协同工作</div>
        </div>
        <a-switch v-model="multiAgentMode" @change="onMultiAgentModeChange" />
      </div>
    </a-modal>

    <!-- ========== 新建智能体弹窗（增强版） ========== -->
    <a-modal v-model:visible="showAddModal" title="新建智能体" :width="540" @ok="createAgent" @cancel="closeAddModal" ok-text="创建">
      <!-- 头像 -->
      <div class="form-group">
        <div class="form-label">头像</div>
        <div class="avatar-upload">
          <div class="avatar-preview" @click="selectAvatar">
            <img v-if="newAgentForm.avatarPreview" :src="newAgentForm.avatarPreview" />
            <icon-camera v-else />
          </div>
          <span class="avatar-hint">点击选择头像图片</span>
          <input type="file" ref="avatarInputRef" accept="image/*" style="display:none" @change="onAvatarChange" />
        </div>
      </div>

      <!-- 名称 -->
      <div class="form-group">
        <div class="form-label">智能体名称 <span class="required">*</span></div>
        <a-input v-model="newAgentForm.name" placeholder="给小强起个名字吧" />
      </div>

      <!-- 工作区 -->
      <div class="form-group">
        <div class="form-label">工作区目录 <span class="required">*</span></div>
        <div class="workspace-picker">
          <a-input v-model="newAgentForm.workspace" placeholder="选择或输入工作区目录" />
          <a-button @click="selectWorkspaceFolder">
            <template #icon><icon-folder /></template>
            浏览
          </a-button>
        </div>
        <div class="form-hint">点击浏览选择文件夹，目录名将作为智能体 ID</div>
      </div>

      <!-- 描述 -->
      <div class="form-group">
        <div class="form-label">描述</div>
        <a-textarea v-model="newAgentForm.description" placeholder="描述这个智能体的特点..." :rows="3" />
      </div>

      <!-- 默认模型 -->
      <div class="form-group">
        <div class="form-label">默认模型</div>
        <ModelSelector v-model="newAgentForm.model" placeholder="选择默认模型" />
        <div class="form-hint">智能体默认使用的 AI 模型（按 provider 分组）</div>
      </div>

    </a-modal>

    <!-- ========== 安装抽屉（右侧滑出） ========== -->
    <AgentInstallDrawer
      ref="installDrawerRef"
      v-model:visible="showInstallDrawer"
      :agent="installTargetAgent"
      @install="onInstallSubmit"
    />

    <!-- ========== 安装进度弹窗 ========== -->
    <a-modal
      v-model:visible="showInstallProgress"
      :closable="installProgressDone"
      :mask-closable="installProgressDone"
      :footer="null"
      title="安装进度"
      :width="380"
    >
      <div class="progress-list">
        <div
          v-for="step in installSteps"
          :key="step.key"
          class="progress-item"
          :class="'progress-' + step.status"
        >
          <span class="progress-indicator">
            <icon-loading v-if="step.status === 'active'" class="spin" />
            <icon-check-circle-fill v-else-if="step.status === 'done'" />
            <icon-close-circle-fill v-else-if="step.status === 'error'" />
            <span v-else class="progress-bullet"></span>
          </span>
          <span class="progress-label">{{ step.label }}</span>
        </div>
        <div v-if="installProgressDone" class="progress-bar">
          <a-button type="primary" size="small" @click="onCloseProgress">关闭</a-button>
        </div>
      </div>
    </a-modal>

    <!-- ========== 智能体详情弹窗 ========== -->
    <a-modal v-model:visible="showAgentDetailModal" :title="detailAgent?.name" :width="640" :footer="null">
      <div class="detail-header">
        <img v-if="detailAgent?.avatar" :src="detailAgent.avatar" class="detail-avatar" />
        <div v-else class="detail-avatar-placeholder" :style="{ backgroundColor: getAgentColor(detailAgent?.id) }">
          {{ (detailAgent?.name || detailAgent?.id || 'A').charAt(0).toUpperCase() }}
        </div>
        <div class="detail-info">
          <div class="detail-name">{{ detailAgent?.name }}</div>
          <div class="detail-author">by {{ detailAgent?.author || '未知' }}</div>
          <div class="detail-count">{{ detailAgent?.installCount || 0 }}人安装</div>
        </div>
        <div class="detail-action">
          <a-button type="primary" v-if="!isAgentInstalled(detailAgent?.id)" @click="openInstallModal(detailAgent)">安装</a-button>
          <a-button v-else status="danger" @click="uninstallAgent(detailAgent)">卸载</a-button>
        </div>
      </div>
      <a-divider />
      <div class="detail-desc-text">{{ detailAgent?.description }}</div>
      <a-divider />
      <div class="detail-content">
        <a-spin v-if="detailLoading" class="detail-loading" tip="加载智能体详情..." />
        <a-tabs v-else>
          <a-tab-pane v-for="file in detailAgentFiles" :key="file.key" :title="file.label">
            <div class="detail-file-content">
              <div class="detail-file-header">{{ file.filename }}</div>
              <div class="detail-file-body" v-html="file.content || '<p style=\'color:#86909C\'>暂无内容</p>'"></div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- ========== 云端同步弹窗 ========== -->
    <a-modal
      v-model:visible="showCloudModal"
      title="从云端同步智能体"
      :width="700"
      @cancel="showCloudModal = false"
      :footer="null"
    >
      <div class="cloud-list">
        <a-empty v-if="cloudAgents.length === 0" description="暂无可用的云端智能体（Mock数据）" />

        <div v-else class="cloud-grid">
          <div
            v-for="cloud in cloudAgents"
            :key="cloud.id"
            class="cloud-card"
            :class="{ 'is-added': isAgentAdded(cloud.id) }"
          >
            <div class="cloud-card-header">
              <div class="cloud-avatar" :style="{ backgroundColor: cloud.color || '#165DFF' }">
                {{ cloud.name?.charAt(0) || 'A' }}
              </div>
              <div class="cloud-info">
                <div class="cloud-name">{{ cloud.name }}</div>
                <div class="cloud-author">by {{ cloud.author }}</div>
              </div>
              <a-tag v-if="isAgentAdded(cloud.id)" color="green">已添加</a-tag>
              <a-button v-else type="primary" size="small" @click="addFromCloud(cloud)">
                添加
              </a-button>
            </div>
            <div class="cloud-desc">{{ cloud.description }}</div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- ========== 编辑抽屉（右侧滑出） ========== -->
    <AgentEditDrawer
      v-model:visible="showEditDrawer"
      :agent="editingAgent"
      :guide-files="guideFiles"
      @save-settings="onDrawerSaveSettings"
    />
  </div>
</template>

<script setup>
import { useAgent } from './useAgent.js';
import AgentEditDrawer from './components/AgentEditDrawer.vue';
import AgentInstallDrawer from './components/AgentInstallDrawer.vue';
import { ref } from 'vue';
import ModelSelector from '@/components/ModelSelector.vue';

const {
  viewMode,
  agents,
  categories,
  discoverAgents,
  filteredDiscoverAgents,
  multiAgentMode,
  selectedAgentId,
  currentGuideFile,
  editContent,
  originalContent,
  saving,
  activeTab,
  activeCategory,
  showAddModal,
  showSettingsModal,
  showAgentDetailModal,
  showInstallDrawer,
  showEditDrawer,
  showCloudModal,
  detailAgent,
  detailAgentFiles,
  newAgentForm,
  installTargetAgent,
  cloudAgents,
  fileNotFound,
  hasChanges,
  guideFiles,
  editingAgent,
  pageLoading,
  loading,
  detailLoading,
  lastSaved,
  detailInstalling,
  showInstallProgress,
  installSteps,
  installProgressDone,
  avatarInputRef,
  getAgentColor,
  getSelectedAgentName,
  getModelName,
  getModelDisplayName,
  selectAgent,
  openEditDrawer,
  showAgentDetail,
  isAgentAdded,
  isAgentInstalled,
  loadAgents,
  loadCurrentFile,
  saveCurrentFile,
  resetContent,
  onContentChange,
  onMultiAgentModeChange,
  closeAddModal,
  createAgent,
  selectAvatar,
  onAvatarChange,
  selectWorkspaceFolder,
  syncFromCloud,
  addFromCloud,
  openInstallModal,
  closeInstallDrawer,
  doInstall,
  uninstallAgent,
  deleteMyAgent,
  onDrawerSaveSettings,
} = useAgent();

const installDrawerRef = ref(null);
const deletingAgentId = ref(null);

async function onDeleteMyAgent(agentId) {
  deletingAgentId.value = agentId;
  try {
    await deleteMyAgent(agentId);
  } finally {
    deletingAgentId.value = null;
  }
}

async function onInstallSubmit(payload) {
  await doInstall(payload);
  installDrawerRef.value?.setSaving(false);
}

function onCloseProgress() {
  showInstallProgress.value = false;
  Message.success('智能体安装成功');
}
</script>

<script>
export default {
  name: 'AgentView'
};
</script>

<style scoped src="./style.scss"></style>
