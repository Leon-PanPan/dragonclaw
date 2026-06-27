<template>
  <div class="computer-view">
    <div class="cv-header">
      <div class="cv-header-left">
        <icon-computer class="header-icon" />
        <span class="header-title">电脑助手</span>
      </div>
      <div class="cv-header-right">
        <a-button type="text" size="small" @click="refreshData">
          <template #icon><icon-refresh /></template>
          刷新状态
        </a-button>
      </div>
    </div>

    <div class="cv-body">
      <div class="cv-nav">
        <div
          v-for="item in funcList"
          :key="item.key"
          :class="['nav-item', { active: activeKey === item.key }]"
          @click="goTo(item.key)"
        >
          <div class="nav-icon-wrap" :class="`nav-icon-${item.key}`">
            <component :is="item.icon" class="nav-icon" />
          </div>
          <div class="nav-text">
            <span class="nav-title">{{ item.name }}</span>
            <span class="nav-sub">{{ item.sub }}</span>
          </div>
          <div class="nav-arrow">
            <icon-right />
          </div>
        </div>
      </div>

      <div class="cv-content">
        <router-view v-slot="{ Component }">
          <component :is="Component" v-if="Component" />
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';

const funcList = [
  { key: 'cleanup', name: '硬盘清理', sub: '智能清理磁盘空间', icon: 'icon-brush', path: '/computer/cleanup' },
  { key: 'organize', name: '电脑整理', sub: '让AI全面了解您的电脑', icon: 'icon-mind-mapping', path: '/computer/organize' },
  { key: 'manage', name: '软件管理', sub: '查看和管理已安装应用', icon: 'icon-apps', path: '/computer/manage' },
];

const route = useRoute();
const router = useRouter();

const activeKey = computed(() => {
  const found = funcList.find((f) => f.path === route.path);
  return found ? found.key : funcList[0].key;
});

const goTo = (key) => {
  const target = funcList.find((f) => f.key === key);
  if (target && route.path !== target.path) {
    router.push(target.path);
  }
};

const refreshData = () => Message.success('状态已刷新');
</script>

<style scoped src="./style.scss"></style>
