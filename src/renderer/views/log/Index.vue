<template>
  <div class="log-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-title">
        <icon-file class="title-icon" />
        <span>运行日志</span>
      </div>
      <div class="page-actions">
        <a-button @click="clearLogs">
          <template #icon><icon-delete /></template>
          清空日志
        </a-button>
        <a-button @click="toggleAutoRefresh" :type="autoRefresh ? 'primary' : 'secondary'">
          <template #icon><icon-refresh /></template>
          {{ autoRefresh ? '暂停刷新' : '开启刷新' }}
        </a-button>
        <a-button type="primary" @click="copyLogs">
          <template #icon><icon-copy /></template>
          复制日志
        </a-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <a-select
        v-model="logLevel"
        placeholder="日志级别"
        :style="{ width: '100px' }"
      >
        <a-option value="all">全部</a-option>
        <a-option value="info">信息</a-option>
        <a-option value="warn">警告</a-option>
        <a-option value="error">错误</a-option>
        <a-option value="debug">调试</a-option>
      </a-select>
      <a-input-search
        v-model="searchKeyword"
        placeholder="搜索日志..."
        :style="{ width: '180px' }"
        @search="handleSearch"
      />
      <a-select
        v-model="logSource"
        placeholder="日志来源"
        :style="{ width: '100px' }"
      >
        <a-option value="all">全部</a-option>
        <a-option value="openclaw">OpenClaw</a-option>
        <a-option value="electron">Electron</a-option>
        <a-option value="renderer">界面</a-option>
        <a-option value="websocket">WebSocket</a-option>
      </a-select>
    </div>

    <!-- 问题统计 -->
    <div class="stats-cards" v-if="filteredLogs.length > 0">
      <a-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon error">
            <icon-close-circle />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ errorCount }}</div>
            <div class="stat-label">错误</div>
          </div>
        </div>
      </a-card>
      <a-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon warn">
            <icon-exclamation-circle />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ warningCount }}</div>
            <div class="stat-label">警告</div>
          </div>
        </div>
      </a-card>
      <a-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon info">
            <icon-info-circle />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ infoCount }}</div>
            <div class="stat-label">信息</div>
          </div>
        </div>
      </a-card>
      <a-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon total">
            <icon-file />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ filteredLogs.length }}</div>
            <div class="stat-label">总日志数</div>
          </div>
        </div>
      </a-card>
    </div>

    <!-- 日志列表 -->
    <div class="log-container">
      <a-card class="log-card">
        <div class="log-list" ref="logListRef">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-item"
            :class="log.level"
            @click="selectLog(log)"
          >
            <div class="log-item-header">
              <div class="log-level-tag">
                <a-tag :color="getLevelColor(log.level)" size="mini">
                  {{ log.level.toUpperCase() }}
                </a-tag>
                <span class="log-source">{{ log.source }}</span>
              </div>
              <div class="log-time">
                {{ formatTime(log.timestamp) }}
              </div>
            </div>
            <div class="log-content">
              <pre class="log-message">{{ log.message }}</pre>
              <div v-if="log.details" class="log-details">
                <pre>{{ log.details }}</pre>
              </div>
            </div>
            <div v-if="log === selectedLog" class="log-actions">
              <a-button size="mini" @click.stop="copyLog(log)">
                <template #icon>
                  <icon-copy />
                </template>
                复制
              </a-button>
              <a-button size="mini" @click.stop="analyzeLog(log)" v-if="log.level === 'error'">
                <template #icon>
                  <icon-search />
                </template>
                分析错误
              </a-button>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="filteredLogs.length === 0" class="empty-state">
          <icon-file style="font-size: 64px; color: var(--text-secondary);" />
          <h3>暂无日志</h3>
          <p>OpenClaw运行时，日志将显示在这里</p>
        </div>
      </a-card>
    </div>

    <!-- 日志详情模态框 -->
    <a-modal
      v-model:visible="detailModal.visible"
      :title="detailModal.title"
      :width="800"
      :footer="false"
    >
      <div class="log-detail-modal">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">级别：</span>
              <a-tag :color="getLevelColor(detailModal.log?.level)" size="small">
                {{ detailModal.log?.level?.toUpperCase() }}
              </a-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">来源：</span>
              <span class="detail-value">{{ detailModal.log?.source }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">时间：</span>
              <span class="detail-value">{{ formatTime(detailModal.log?.timestamp) }}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>日志内容</h4>
          <pre class="detail-message">{{ detailModal.log?.message }}</pre>
        </div>
        
        <div v-if="detailModal.log?.details" class="detail-section">
          <h4>详细信息</h4>
          <pre class="detail-details">{{ detailModal.log?.details }}</pre>
        </div>
        
        <div class="detail-section" v-if="detailModal.log?.level === 'error'">
          <h4>错误分析</h4>
          <div class="error-analysis">
            <div v-if="detailModal.analysis" class="analysis-content">
              <p>{{ detailModal.analysis }}</p>
            </div>
            <div v-else>
              <a-button @click="analyzeSelectedLog" :loading="analyzing">
                <template #icon>
                  <icon-search />
                </template>
                分析错误原因
              </a-button>
            </div>
          </div>
        </div>
        
        <div class="detail-section" v-if="detailModal.log?.level === 'error'">
          <h4>解决方案建议</h4>
          <div class="solution-suggestions">
            <ul>
              <li v-for="(solution, index) in detailModal.solutions" :key="index">
                {{ solution }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { useLog } from './useLog.js';
const { logs, selectedLog, logListRef, logLevel, searchKeyword, logSource, autoRefresh, detailModal, analyzing, errorCount, warningCount, infoCount, filteredLogs, clearLogs, toggleAutoRefresh, copyLogs, exportLogs, selectLog, copyLog, analyzeLog, analyzeSelectedLog, getLevelColor, formatTime, handleSearch, addLog, loadLogs } = useLog();
</script>

<style scoped src="./style.scss"></style>