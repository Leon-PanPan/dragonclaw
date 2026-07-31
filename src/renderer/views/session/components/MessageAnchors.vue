<template>
  <Teleport to="body">
    <div v-if="anchors.length > 0" class="message-anchors" @mouseenter="visible = true" @mouseleave="visible = false">
    <Transition name="anchors-fade">
      <div v-if="visible" class="anchors-card">
        <div class="anchors-card-title">历史记录</div>
        <div
          v-for="anchor in anchors"
          :key="anchor.id"
          class="anchors-card-item"
          @click="scrollTo(anchor.id)"
        >
          <span class="anchors-card-dot" />
          <span class="anchors-card-text">{{ anchor.preview }}</span>
        </div>
      </div>
    </Transition>
    <div
      v-for="anchor in anchors"
      :key="anchor.id"
      class="anchor-item"
      @click="scrollTo(anchor.id)"
    >
      <span class="anchor-dot" />
    </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { extractTextFromContent } from '@/utils/messageParser'

const props = defineProps({
  groupedMessages: { type: Array, default: () => [] },
})

const visible = ref(false)

const anchors = computed(() => {
  return props.groupedMessages
    .filter(g => g.type === 'user' && g.item)
    .map(g => {
      const text = extractTextFromContent(g.item.content) || ''
      return {
        id: g.id,
        preview: text.length > 30 ? text.substring(0, 30) + '...' : text,
      }
    })
})

function scrollTo(msgId) {
  const el = document.querySelector(`[data-msg-id="${msgId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>

<style>
.message-anchors {
  position: fixed;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 100;
}

.anchor-item {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 3px;
}

.anchor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
  transition: background 0.15s;
  flex-shrink: 0;
}

.anchor-item:hover .anchor-dot,
.anchors-card-item:hover .anchors-card-dot {
  background: var(--primary-color, #2A5CAA);
}

.anchors-card {
  position: absolute;
  right: 22px;
  top: 0;
  width: 200px;
  max-height: 400px;
  overflow-y: auto;
  background: #fff;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
  border-radius: 5px;
  padding: 10px 0;
}

.anchors-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-3);
  padding: 0 12px 8px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.anchors-card-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.1s;
}

.anchors-card-item:hover {
  background: rgba(var(--primary-6), 0.06);
}

.anchors-card-item:hover .anchors-card-text {
  color: var(--primary-color, #2A5CAA);
}

.anchors-card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
  flex-shrink: 0;
  margin-top: 5px;
  transition: background 0.15s;
}

.anchors-card-text {
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  word-break: break-word;
  transition: color 0.1s;
}

.anchors-fade-enter-active,
.anchors-fade-leave-active {
  transition: opacity 0.15s ease;
}

.anchors-fade-enter-from,
.anchors-fade-leave-to {
  opacity: 0;
}
</style>
