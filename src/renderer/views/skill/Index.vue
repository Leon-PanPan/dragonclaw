<template>
  <div class="skill-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-title">
        <icon-tool class="title-icon" />
        <span>技能管理</span>
      </div>
      <div class="page-actions">
        <a-button 
          type="primary" 
          @click="handleClawhubLogin"
          :loading="clawhubLogging"
        >
          <template #icon><icon-user /></template>
          {{ clawhubLoggedIn ? '已登录' : 'Clawhub登录' }}
        </a-button>
      </div>
    </div>

    <!-- Tab切换 - 使用竖向菜单样式 -->
    <div class="skills-tabs-wrapper">
      <a-tabs type="rounded" v-model:active-key="activeTab" direction="vertical">
        <!-- 推荐 Tab -->
        <a-tab-pane key="recommended" title="推荐">
          <div class="tab-content">
            <div class="search-bar">
              <a-input-search
                v-model="recommendedKeyword"
                placeholder="搜索推荐技能..."
                :style="{ width: '240px' }"
              />
            </div>
            <div class="skills-table-wrapper">
              <a-table
                :data="filteredRecommendedSkillsAll"
                :bordered="false"
                :stripe="true"
                :pagination="false"
                :loading="refreshing"
              >
                <template #columns>
                  <a-table-column title="技能" :width="250">
                    <template #cell="{ record }">
                      <div class="skill-cell">
                        <a-avatar :size="36" :style="{ backgroundColor: getSkillColor(record.category) }">
                          {{ getSkillIcon(record) }}
                        </a-avatar>
                        <div class="skill-info">
                          <div class="skill-name-row">
                            <span class="skill-name">{{ truncateName(record.name) }}</span>
                            
                            <a-tag v-for="tag in (record.tags || []).slice(0, 2)" :key="tag" size="small" :color="getTagColor(tag)">{{ tag }}</a-tag>
                          </div>
                          <div class="skill-desc-row">{{ record.description }}</div>
                        </div>
                      </div>
                    </template>
                  </a-table-column>
                  <a-table-column title="作者" :width="140">
                    <template #cell="{ record }">
                      <span class="author-name">{{ record.author }}</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="安装量" :width="100">
                    <template #cell="{ record }">
                      {{ record.install_count?.toLocaleString() || 0 }}
                    </template>
                  </a-table-column>
                  <a-table-column title="操作" :width="160" fixed="right">
                    <template #cell="{ record }">
                      <div class="action-buttons">
                        <a-button type="text" size="mini" @click="showSkillDetail(record)">详情</a-button>
                        <a-button v-if="record.installed" type="outline" status="success" size="mini" disabled>已安装</a-button>
                        <a-popconfirm
                          v-else
                          :content="'确认安装技能 &quot;' + (record.name || '') + '&quot;？'"
                          ok-text="安装"
                          cancel-text="取消"
                          @ok="confirmInstall(record)"
                        >
                          <a-button type="primary" size="mini" :loading="record.installing">安装</a-button>
                        </a-popconfirm>
                      </div>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </div>
        </a-tab-pane>

        <!-- 全部 Tab -->
        <a-tab-pane key="all" title="全部">
          <div class="tab-content">
            <div class="search-bar">
              <a-select
                v-model="allCategory"
                placeholder="选择分类"
                :style="{ width: '140px' }"
                allow-clear
              >
                <a-option
                  v-for="cat in categories"
                  :key="cat.id || 'all'"
                  :value="cat.id"
                >{{ cat.name }}</a-option>
              </a-select>
              <a-select
                v-model="allSortBy"
                :style="{ width: '120px' }"
              >
                <a-option value="downloads">下载量</a-option>
                <a-option value="stars">收藏量</a-option>
              </a-select>
              <a-input-search
                v-model="allKeyword"
                placeholder="搜索全部技能..."
                :style="{ width: '200px' }"
                @search="handleAllKeywordSearch"
              />
            </div>
            <div class="skills-table-wrapper">
              <a-table
                :data="paginatedSkills"
                :bordered="false"
                :stripe="true"
                :pagination="false"
                :loading="refreshing"
              >
                <template #columns>
                  <a-table-column title="技能" :width="250">
                    <template #cell="{ record }">
                      <div class="skill-cell">
                        <a-avatar :size="36" :style="{ backgroundColor: getSkillColor(record.category) }">
                          {{ getSkillIcon(record) }}
                        </a-avatar>
                        <div class="skill-info">
                          <div class="skill-name-row">
                            <span class="skill-name">{{ truncateName(record.name) }}</span>
                            <a-tag v-for="tag in (record.tags || []).slice(0, 2)" :key="tag" size="small" :color="getTagColor(tag)">{{ tag }}</a-tag>
                          </div>
                          <div class="skill-desc-row">{{ record.description }}</div>
                        </div>
                      </div>
                    </template>
                  </a-table-column>
                  <a-table-column title="作者" :width="140">
                    <template #cell="{ record }">
                      <span class="author-name">{{ record.author }}</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="安装量" :width="100">
                    <template #cell="{ record }">
                      {{ record.install_count?.toLocaleString() || 0 }}
                    </template>
                  </a-table-column>
                  <a-table-column title="操作" :width="180" fixed="right">
                    <template #cell="{ record }">
                      <div class="action-buttons">
                        <a-button type="text" size="mini" @click="showSkillDetail(record)">详情</a-button>
                        <a-button v-if="record.installed" type="outline" status="success" size="mini" disabled>已安装</a-button>
                        <a-popconfirm
                          v-else
                          :content="'确认安装技能 &quot;' + (record.name || '') + '&quot;？'"
                          ok-text="安装"
                          cancel-text="取消"
                          @ok="confirmInstall(record)"
                        >
                          <a-button type="primary" size="mini" :loading="record.installing">安装</a-button>
                        </a-popconfirm>
                      </div>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
            <!-- 分页组件放在表格下方 -->
            <div class="pagination-wrapper" v-if="allTotal > 0">
              <a-pagination
                v-model:current="allPage"
                v-model:page-size="allPageSize"
                :total="allTotal"
                :show-total="true"
                :page-size-options="[12, 24, 48, 96]"
                @change="handleAllPageChange"
                @page-size-change="handleAllPageSizeChange"
              />
            </div>
          </div>
        </a-tab-pane>

        <!-- 管理 Tab -->
        <a-tab-pane key="manage" title="管理">
          <div class="tab-content">
            <div class="search-bar">
              <a-input-search
                v-model="manageKeyword"
                placeholder="搜索技能..."
                :style="{ width: '240px' }"
              />
              <a-button @click="loadSkillsStatus" :loading="manageLoading">
                <template #icon><icon-refresh /></template>
                刷新
              </a-button>
            </div>
            <div class="skills-manage-wrapper">
              <!-- 加载中 -->
              <div v-if="manageLoading && !skillsReport" class="manage-loading">
                <a-spin :size="36" />
                <p>加载技能列表...</p>
              </div>
              <!-- 技能分组列表 -->
              <div v-else>
                <div v-for="group in groupedSkills" :key="group.source" class="skill-group">
                  <div class="group-header" @click="toggleManageGroup(group.source)">
                    <div class="group-header-left">
                      <span class="group-label">{{ group.label }}</span>
                      <a-tag size="small" color="arcoblue">{{ group.skills.length }}</a-tag>
                    </div>
                    <icon-down class="group-arrow" :class="{ collapsed: isManageGroupCollapsed(group.source) }" />
                  </div>
                  <div v-show="!isManageGroupCollapsed(group.source)" class="group-body">
                    <div v-for="skill in group.skills" :key="skill.skillKey" class="skill-manage-item">
                      <div class="skill-manage-info">
                        <div class="skill-manage-header">
                          <span v-if="skill.emoji" class="skill-emoji">{{ skill.emoji }}</span>
                          <span class="skill-name">{{ skill.name }}</span>
                          <a-tag v-if="skill.disabled" size="small" color="gray">已禁用</a-tag>
                          <a-tag v-if="!skill.eligible" size="small" color="red">不可用</a-tag>
                          <a-tag v-if="skill.bundled" size="small" color="blue">内置</a-tag>
                        </div>
                        <div class="skill-desc">{{ skill.description }}</div>
                        <div v-if="skill.missing?.bins?.length" class="skill-missing">
                          <icon-exclamation-circle />
                          <span>缺失依赖: {{ skill.missing.bins.join(', ') }}</span>
                        </div>
                        <div v-if="skill.primaryEnv" class="skill-apikey-row">
                          <a-input-password
                            v-model="skill._apiKey"
                            :placeholder="'输入 ' + skill.primaryEnv"
                            size="small"
                            :style="{ width: '280px' }"
                          />
                          <a-button size="small" type="primary" @click="saveSkillApiKey(skill)">保存</a-button>
                        </div>
                      </div>
                      <div class="skill-manage-actions">
                        <a-switch
                          :model-value="!skill.disabled"
                          @change="toggleSkillEnabled(skill)"
                          :loading="skill._toggling"
                        />
                        <a-button
                          v-if="skill.install?.length && skill.missing?.bins?.length"
                          type="primary"
                          size="small"
                          @click="installSkillDependency(skill)"
                          :loading="skill._installing"
                        >
                          安装依赖
                        </a-button>
                      </div>
                    </div>
                  </div>
                </div>
                <a-empty v-if="groupedSkills.length === 0 && !manageLoading" description="暂无技能数据" />
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 详情弹窗 -->
    <a-modal
      v-model:visible="detailModal.visible"
      title="详情"
      :width="600"
      :footer="null"
    >
      <div v-if="detailModal.skill" class="skill-detail">
        <div class="detail-header">
          <a-avatar :size="48" :style="{ backgroundColor: getSkillColor(detailModal.skill.category) }">
            {{ getSkillIcon(detailModal.skill) }}
          </a-avatar>
          <div class="detail-info">
            <h3>{{ detailModal.skill.name }}</h3>
            <div class="detail-meta">
              <span>作者: {{ detailModal.skill.author }}</span>
              <span>版本: v{{ detailModal.skill.version || '1.0.0' }}</span>
              <span>安装量: {{ detailModal.skill.install_count?.toLocaleString() || 0 }}</span>
            </div>
          </div>
        </div>
        <div class="detail-section">
          <h4>描述</h4>
          <p>{{ detailModal.skill.description }}</p>
        </div>
        <div class="detail-section" v-if="detailModal.skill.tags?.length">
          <h4>标签</h4>
          <div class="detail-tags">
            <a-tag v-for="tag in detailModal.skill.tags" :key="tag" :color="getTagColor(tag)">{{ tag }}</a-tag>
          </div>
        </div>
        <div class="detail-section" v-if="detailModal.skill.readme">
          <h4>自述文件</h4>
          <div class="detail-tab-content">
            <pre>{{ detailModal.skill.readme }}</pre>
          </div>
        </div>

        <div class="detail-actions">
          <a-button v-if="detailModal.skill.installed" type="outline" status="success" disabled>已安装</a-button>
          <a-button v-else-if="isInstalledBySlug(detailModal.skill)" type="outline" status="success" disabled>已安装</a-button>
          <a-popconfirm
            v-else
            :content="'确认安装技能 &quot;' + (detailModal.skill.name || '') + '&quot;？'"
            ok-text="安装"
            cancel-text="取消"
            @ok="confirmInstall(detailModal.skill)"
          >
            <a-button type="primary" :loading="detailModal.skill.installing">安装</a-button>
          </a-popconfirm>
        </div>
      </div>
    </a-modal>

    <!-- 安装全局 Loading 遮罩 -->
    <div v-if="installingGlobal" class="global-loading">
      <a-spin size="large">
        <template #icon>
          <icon-loading />
        </template>
      </a-spin>
      <p>正在安装技能...</p>
    </div>
  </div>
</template>
<script setup>
import { useSkill } from './useSkill.js';
const {
  activeTab,
  clawhubLoggedIn,
  clawhubLogging,
  handleClawhubLogin,
  recommendedKeyword,
  filteredRecommendedSkillsAll,
  pageLoading,
  refreshing,
  getSkillColor,
  getSkillIcon,
  getTagColor,
  truncateName,
  showSkillDetail,
  allKeyword,
  allCategory,
  allSortBy,
  categories,
  paginatedSkills,
  allPage,
  allPageSize,
  allTotal,
  handleAllPageChange,
  handleAllPageSizeChange,
  handleAllKeywordSearch,
  filteredAgentList,
  isInstalledBySlug,
  openClawHome,
  detailModal,
  confirmInstall,
  installingGlobal,
  // 管理 Tab
  manageKeyword,
  manageLoading,
  skillsReport,
  groupedSkills,
  loadSkillsStatus,
  toggleManageGroup,
  isManageGroupCollapsed,
  toggleSkillEnabled,
  saveSkillApiKey,
  installSkillDependency,
} = useSkill();
</script>

<style scoped src="./style.scss"></style>