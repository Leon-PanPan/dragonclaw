/**
 * 打字机逐字输出 composable
 * 参考 opencode 的 createPacedValue 实现
 *
 * 用法：
 *   const { displayText } = useTypewriter(streamingResponse, () => isStreaming.value)
 *   // displayText 会以 ~24ms 的节奏逐字追上 source
 *
 * @param {import('vue').Ref<string>} source - 源文本 ref
 * @param {() => boolean} live - 是否仍在流式输出中
 * @returns {{ displayText: import('vue').Ref<string> }}
 */

import { ref, watch, onUnmounted } from 'vue'

const TEXT_RENDER_PACE_MS = 24
const TEXT_RENDER_SNAP = /[\s.,!?;:)\]]/

function step(size) {
  if (size <= 12) return 2
  if (size <= 48) return 4
  if (size <= 96) return 8
  return Math.min(24, Math.ceil(size / 8))
}

function next(text, start) {
  const end = Math.min(text.length, start + step(text.length - start))
  const max = Math.min(text.length, end + 8)
  for (let i = end; i < max; i++) {
    if (TEXT_RENDER_SNAP.test(text[i] ?? '')) return i + 1
  }
  return end
}

export function useTypewriter(source, live) {
  const displayText = ref(source?.value || '')
  let shown = displayText.value
  let timer = null

  const clearTimer = () => {
    if (timer) { clearTimeout(timer); timer = null }
  }

  const sync = (text) => {
    shown = text
    displayText.value = text
  }

  const run = () => {
    timer = null
    const text = source.value || ''
    if (!live?.()) { sync(text); return }
    if (!text.startsWith(shown) || text.length <= shown.length) {
      sync(text)
      return
    }
    const pos = next(text, shown.length)
    sync(text.slice(0, pos))
    if (pos < text.length) timer = setTimeout(run, TEXT_RENDER_PACE_MS)
  }

  watch(() => source?.value, (val) => {
    if (!val) { clearTimer(); sync(''); return }
    if (!live?.()) { clearTimer(); sync(val); return }
    if (!val.startsWith(shown) || val.length < shown.length) {
      clearTimer()
      sync(val)
      return
    }
    if (val.length === shown.length || timer) return
    timer = setTimeout(run, TEXT_RENDER_PACE_MS)
  }, { immediate: true })

  onUnmounted(() => clearTimer())

  return { displayText }
}
