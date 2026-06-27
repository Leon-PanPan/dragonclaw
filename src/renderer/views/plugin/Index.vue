<template>
  <div class="plugin-view">
    <div class="page-header">
      <div class="page-title">
        <icon-apps class="title-icon" />
        <span>插件</span>
      </div>
    </div>
    <div class="plugin-grid">
      <div v-for="plugin in plugins" :key="plugin.id" class="plugin-card" @click="openPlugin(plugin)">
        <div class="plugin-icon">
          <a-avatar :size="48" :style="{ backgroundColor: plugin.color }">
            <component :is="plugin.icon" />
          </a-avatar>
        </div>
        <div class="plugin-name">{{ plugin.name }}</div>
        <div class="plugin-desc">{{ plugin.description }}</div>
      </div>
    </div>
    <a-modal v-model:visible="detailModal.visible" :title="detailModal.plugin?.name" :width="600" :footer="null">
      <div v-if="detailModal.plugin" class="plugin-detail">
        <div class="detail-header">
          <a-avatar :size="64" :style="{ backgroundColor: detailModal.plugin.color }">
            <component :is="detailModal.plugin.icon" />
          </a-avatar>
          <div class="detail-info">
            <h3>{{ detailModal.plugin.name }}</h3>
            <p>{{ detailModal.plugin.description }}</p>
          </div>
        </div>
        <div class="detail-section"><h4>功能说明</h4><p>{{ detailModal.plugin.longDescription }}</p></div>
        <div class="detail-actions"><a-button type="primary" @click="configurePlugin(detailModal.plugin)">配置</a-button></div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { usePlugin } from './usePlugin.js';
const { plugins, detailModal, openPlugin, configurePlugin } = usePlugin();
</script>

<style scoped src="./style.scss"></style>
