<template>
  <div class="sub-page organize-page">
    <div class="section-header">
      <span class="section-title">电脑整理</span>
    </div>
    <div class="organize-placeholder">
      <icon-mind-mapping class="placeholder-icon" />
      <span class="placeholder-title">功能开发中</span>
      <span class="placeholder-desc">该功能正在紧锣密鼓地开发，敬请期待。</span>
      <a-button type="primary" @click="goBack">
        <template #icon><icon-left /></template>
        返回
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
const goBack = () => router.push('/computer');
</script>

<style scoped>
.organize-page {
  height: 100%;
}

.organize-page .section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
}

.organize-page .section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1D2129;
}

.organize-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.placeholder-icon {
  font-size: 64px;
  color: #C9CDD4;
}

.placeholder-title {
  font-size: 20px;
  font-weight: 700;
  color: #1D2129;
}

.placeholder-desc {
  font-size: 14px;
  color: #86909C;
}
</style>
