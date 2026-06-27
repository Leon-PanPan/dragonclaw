<template>
  <div class="kanban-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-title">
        <icon-dashboard class="title-icon" />
        <span>智能体执行看板</span>
        <a-tag v-if="activeCount > 0" color="arcoblue" size="small">
          {{ activeCount }} 个活跃
        </a-tag>
      </div>
      <div class="page-actions">
        <a-button @click="loadAllData">
          <template #icon><icon-refresh /></template>
          刷新
        </a-button>
      </div>
    </div>

    <!-- 看板主体 -->
    <div class="kanban-body">
      <!-- 骨架屏 -->
      <template v-if="pageLoading">
        <a-skeleton :animation="true" class="skeleton-kanban-full">
          <div class="skeleton-kanban-body">
            <div v-for="i in 3" :key="i" class="skeleton-agent-column">
              <div class="skeleton-column-header">
                <a-skeleton-shape shape="circle" size="small" class="skeleton-column-avatar" />
                <a-skeleton-line :rows="1" :line-height="14" :widths="['60%']" />
              </div>
              <div class="skeleton-column-body">
                <div v-for="j in 2" :key="j" class="skeleton-task-card">
                  <a-skeleton-line :rows="1" :line-height="12" :widths="['100%']" />
                  <div class="skeleton-task-rows">
                    <a-skeleton-line :rows="2" :line-height="12" :line-spacing="8" :widths="['80%', '55%']" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-skeleton>
      </template>
      <template v-else>
      <div v-if="agentKanbans.length === 0" class="kanban-empty">
        <icon-robot class="empty-icon-large" />
        <div class="empty-text">暂无在线智能体</div>
        <div class="empty-hint">请确保 OpenClaw Gateway 已启动</div>
      </div>

      <div
        v-for="agent in agentKanbans"
        :key="agent.id"
        class="agent-column"
      >
        <!-- Agent 卡片头部 -->
        <div class="agent-header" :style="{ borderColor: agent.color }">
          <div class="agent-avatar" :style="{ backgroundColor: agent.color }">
            {{ agent.name?.charAt(0)?.toUpperCase() || 'A' }}
          </div>
          <div class="agent-info">
            <div class="agent-name">{{ agent.name || agent.id }}</div>
            <div class="agent-status">
              <span class="status-dot" :class="agent.isActive ? 'active' : 'idle'"></span>
              {{ agent.isActive ? '执行中' : '空闲' }}
            </div>
          </div>
          <div class="agent-count" v-if="agent.taskSets.length > 0">
            {{ agent.taskSets.length }}
          </div>
        </div>

        <!-- Agent 列头汇总 -->
        <div
          v-if="agent.summary.thinkingCount + agent.summary.toolCallCount + agent.taskSets.length > 0"
          class="agent-summary"
        >
          <span class="summary-item">📋 {{ agent.taskSets.length }}任务</span>
          <span class="summary-sep">·</span>
          <span class="summary-item">🔧 {{ agent.summary.toolCallCount }}工具</span>
          <span class="summary-sep">·</span>
          <span class="summary-item">{{ formatTokenCount(agent.summary.tokenTotal) }}</span>
        </div>

        <!-- 任务列表 -->
        <div class="task-list">
          <div v-if="agent.taskSets.length === 0" class="task-empty">
            <icon-check-circle class="empty-icon" />
            <span>暂无执行任务</span>
          </div>

          <!-- 指令集列表 -->
          <div
            v-for="taskSet in agent.taskSets"
            :key="taskSet.id"
            class="task-set-card"
            :class="{ 'is-executing': taskSet.isExecuting, 'just-completed': taskSet._justCompleted }"
            :style="taskSet.isExecuting ? { borderLeftColor: agent.color } : {}"
          >
            <!-- 任务标题（用户发送的消息） -->
            <div class="task-set-header">
              <div class="task-set-user">
                <!-- 执行状态 dot -->
                <span class="task-status-dot" :class="taskSet.isExecuting ? 'executing' : 'completed'"></span>
                <!-- 任务内容（多余省略，鼠标悬停显示全部） -->
                <span class="user-message" :title="taskSet.userMessage">
                  {{ taskSet.userMessage || '未知任务' }}
                </span>
                <!-- 帮助图标：鼠标悬停显示完整内容 -->
                <a-tooltip :content="taskSet.userMessage || '未知任务'" :disabled="!taskSet.userMessage">
                  <icon-question-circle class="task-help-icon" />
                </a-tooltip>
              </div>
              <!-- 任务发起时间 -->
              <div class="task-set-time">{{ taskSet.time }}</div>
            </div>

            <!-- 指令列表 -->
            <div class="instruction-list" v-if="taskSet.instructions.length > 0">
              <div
                v-for="(instruction, idx) in taskSet.instructions"
                :key="instruction.id"
                class="instruction-item"
                :class="['status-' + instruction.status, { 'is-new': instruction._isNew }]"
                @click="showInstructionDetail(agent.id, taskSet, instruction)"
              >
                <!-- 状态图标 -->
                <div class="instruction-status">
                  <template v-if="instruction.status === 'running'">
                    <icon-sync class="spin-icon" />
                  </template>
                  <template v-else-if="instruction.status === 'success'">
                    <icon-check-circle class="success-icon" />
                  </template>
                  <template v-else-if="instruction.status === 'error'">
                    <icon-close-circle class="error-icon" />
                  </template>
                </div>

                <!-- 指令内容 -->
                <div class="instruction-content">
                  <!-- 思考内容 -->
                  <div v-if="instruction.thinkingText" class="instruction-thinking">
                    {{ instruction.thinkingText }}
                  </div>
                  <!-- 指令工具 -->
                  <div class="instruction-tool">
                    <span class="tool-icon">{{ instruction.icon }}</span>
                    <span class="tool-name">{{ instruction.toolNameCN }}</span>
                    <span class="tool-desc" :title="instruction.argsDisplay">
                      {{ instruction.commandDesc || '' }}
                    </span>
                  </div>
                  <!-- 元信息 -->
                  <div class="instruction-meta">
                    <span class="instruction-time">{{ instruction.time }}</span>
                    <span v-if="instruction.status === 'running' && instruction.elapsed" class="instruction-elapsed">
                      {{ instruction.elapsed }}
                    </span>
                    <span v-else class="instruction-state">
                      {{ instruction.status === 'success' ? '完成' : instruction.status === 'error' ? '失败' : '执行中' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 无指令时的空状态 -->
            <div v-else-if="!taskSet.isExecuting" class="task-no-instructions">
              <span>无指令记录</span>
            </div>

            <!-- 任务统计行 -->
            <div class="task-stats" v-if="taskSet.stats">
              <span class="stats-item">🧠 {{ taskSet.stats.thinkingCount || 0 }}次思考</span>
              <span class="stats-sep">·</span>
              <span class="stats-item">🔧 {{ taskSet.stats.toolCallCount || 0 }}次工具</span>
              <span class="stats-sep">·</span>
              <span class="stats-item">📊 {{ formatTokenCount(taskSet.stats.tokenTotal) }}</span>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- 指令详情抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="drawerTitle"
      :width="620"
      placement="right"
      :footer="null"
      @close="drawerVisible = false"
    >
      <div v-if="currentInstruction" class="drawer-content">
        <!-- 执行状态 -->
        <div :class="['drawer-status', 'status-' + currentInstruction.status]">
          <template v-if="currentInstruction.status === 'running'">
            <icon-sync class="spin-icon" /> 执行中...
          </template>
          <template v-else-if="currentInstruction.status === 'success'">
            <icon-check-circle /> 执行成功
          </template>
          <template v-else-if="currentInstruction.status === 'error'">
            <icon-close-circle /> 执行失败
          </template>
        </div>

        <!-- 思考内容 -->
        <div v-if="currentInstruction.thinkingText" class="drawer-section">
          <div class="drawer-section-title">思考内容</div>
          <div class="drawer-thinking">{{ currentInstruction.thinkingText }}</div>
        </div>

        <!-- 执行参数 -->
        <div v-if="currentInstruction.argsDisplay" class="drawer-section">
          <div class="drawer-section-title">执行参数</div>
          <pre class="drawer-code">{{ currentInstruction.argsDisplay }}</pre>
        </div>

        <!-- 执行结果 -->
        <div v-if="currentInstruction.result" class="drawer-section">
          <div class="drawer-section-title">执行结果</div>
          <div class="drawer-result" v-html="currentInstruction.resultHtml || currentInstruction.result"></div>
        </div>

        <!-- 无结果 -->
        <div v-else-if="currentInstruction.status === 'running'" class="drawer-executing">
          正在执行中，请稍候...
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { useKanban } from './useKanban.js';
const {
  pageLoading,
  agentKanbans,
  activeCount,
  drawerVisible,
  drawerTitle,
  currentInstruction,
  handleWsMessage,
  showInstructionDetail,
  updateElapsedTimes,
  formatTime,
  formatTokenCount,
  loadAllData,
} = useKanban();
</script>

<style scoped src="./style.scss"></style>
