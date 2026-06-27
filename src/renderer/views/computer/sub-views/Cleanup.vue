<template>
  <div class="sub-page cleanup-page">
    <div class="section-header">
      <span class="section-title">硬盘清理</span>
      <span class="section-desc">
        <template v-if="scanning">扫描中… {{ progressText }}</template>
        <template v-else-if="scanError">扫描失败：{{ scanError }}</template>
        <template v-else-if="finished">
          共扫描 {{ scannedFiles.toLocaleString() }} 个文件，发现 {{ totalFound.toLocaleString() }} 个可清理项
        </template>
        <template v-else>正在启动扫描…</template>
      </span>
      <span class="section-spacer" />
      <span class="section-total" v-if="finished && totalFound">
        共计 <b>{{ totalSizeText }}</b>
      </span>
    </div>

    <div class="cleanup-tabs">
      <a-tabs v-model:active-key="activeCategory" type="line" size="small" class="cleanup-tabs-nav">
        <a-tab-pane v-for="cat in categories" :key="cat.key">
          <template #title>
            <span>{{ cat.label }} ({{ grouped[cat.key].length }})</span>
          </template>
        </a-tab-pane>
      </a-tabs>
      <div class="cleanup-tabs-right">
        <a-space :size="6" align="center">
          <span class="preview-label">预览</span>
          <a-switch v-model="previewEnabled" size="small" />
        </a-space>
      </div>
    </div>

    <div :class="['cleanup-body', { 'with-preview': previewEnabled }]">
      <div class="cleanup-list-wrap">
        <div class="cleanup-toolbar">
          <a-checkbox :model-value="allChecked" :indeterminate="someChecked && !allChecked" @change="onToggleAll">
            全选
          </a-checkbox>
          <span class="cleanup-toolbar-stat">
            已选 <b>{{ selectedIds.size }}</b> 项 · {{ formatSize(selectedTotalBytes) }}
          </span>
          <span class="cleanup-toolbar-spacer" />
          <a-button type="primary" status="danger" :disabled="!selectedIds.size" @click="onDelete">
            <template #icon><icon-delete /></template>
            删除到回收站
          </a-button>
          <a-button :disabled="!selectedIds.size" @click="onMove">
            <template #icon><icon-import /></template>
            移动…
          </a-button>
        </div>

        <a-table
          :data="currentList"
          :pagination="false"
          :row-selection="{ selectedRowKeys: Array.from(selectedIds) }"
          row-key="id"
          :bordered="false"
          :stripe="true"
          size="medium"
          table-layout-fixed
          :loading="scanning && !files.length"
          class="cleanup-table"
          @row-click="onRowClick"
          @selection-change="onSelectionChange"
        >
          <template #columns>
            <a-table-column title="名称" :width="320">
              <template #cell="{ record }">
                <div class="file-cell">
                  <div class="file-icon" :class="`cat-${record.category}`">
                    <component :is="iconFor(record)" />
                  </div>
                  <div class="file-meta">
                    <span class="file-name" :title="record.name">{{ record.name }}</span>
                    <span class="file-path" :title="record.path">{{ record.path }}</span>
                  </div>
                  <button class="row-zoom" :title="`打开 ${record.name} 所在文件夹`" @click.stop="onReveal(record)">
                    <icon-search />
                  </button>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="大小" :width="120">
              <template #title>
                <button class="header-sort" :title="sortDir === 'desc' ? '当前按大小降序，点击切换为升序' : '当前按大小升序，点击切换为降序'" @click="toggleSort">
                  大小
                  <icon-caret-up v-if="sortDir === 'asc'" />
                  <icon-caret-down v-else />
                </button>
              </template>
              <template #cell="{ record }">
                <span class="file-size">{{ formatSize(record.size) }}</span>
              </template>
            </a-table-column>

            <a-table-column title="修改时间" :width="170">
              <template #cell="{ record }">{{ formatDate(record.mtime) }}</template>
            </a-table-column>

            <a-table-column title="操作" :width="80" fixed="right" align="center">
              <template #cell="{ record }">
                <div class="row-actions" @click.stop>
                  <a-popconfirm
                    content="确定删除此文件？将移至回收站。"
                    ok-text="删除"
                    cancel-text="取消"
                    position="tr"
                    @ok="onDeleteOne(record)"
                  >
                    <a-button type="text" size="small" status="danger">
                      <template #icon><icon-delete /></template>
                    </a-button>
                  </a-popconfirm>
                </div>
              </template>
            </a-table-column>
          </template>

          <template #empty>
            <div class="empty-box" v-if="!scanning">
              <icon-brush class="empty-icon" />
              <span v-if="scanError">{{ scanError }}</span>
              <span v-else-if="finished && !totalFound">没有发现 ≥50MB 的文件</span>
              <span v-else>暂无文件</span>
            </div>
          </template>
        </a-table>
      </div>

      <transition name="preview-fade">
        <div v-if="previewEnabled" class="cleanup-preview">
          <div class="preview-header">
            <span class="preview-title">预览</span>
            <span v-if="previewFile" class="preview-meta-name" :title="previewFile.path">{{ previewFile.name }}</span>
          </div>

          <div class="preview-body" v-if="!previewFile">
            <div class="preview-empty">
              <icon-eye class="preview-empty-icon" />
              <span>选择左侧列表中的文件以预览</span>
            </div>
          </div>

          <div class="preview-body" v-else-if="previewLoading">
            <a-spin />
            <span class="preview-loading-text">加载中…</span>
          </div>

          <div class="preview-body" v-else-if="previewError">
            <icon-image-close class="preview-empty-icon" />
            <span>{{ previewError }}</span>
          </div>

          <div class="preview-body preview-text" v-else-if="previewData && previewData.kind === 'text'">
            <pre>{{ previewData.content }}<span v-if="previewData.truncated" class="preview-truncated">… (已截断，仅显示前 256KB)</span></pre>
          </div>

          <div class="preview-body preview-media" v-else-if="previewData && previewData.kind === 'image'">
            <img :src="imageSrc" :alt="previewFile.name" />
          </div>

          <div class="preview-body preview-media" v-else-if="previewData && previewData.kind === 'video'">
            <video :src="videoSrc" controls preload="metadata" />
          </div>

          <div class="preview-body preview-media" v-else-if="previewData && previewData.kind === 'audio'">
            <audio :src="videoSrc" controls preload="metadata" />
          </div>

          <div class="preview-body preview-meta" v-else-if="previewData && previewData.kind === 'binary'">
            <div class="preview-meta-grid">
              <div class="preview-meta-row"><span class="lab">名称</span><span class="val">{{ previewFile.name }}</span></div>
              <div class="preview-meta-row"><span class="lab">路径</span><span class="val">{{ previewFile.path }}</span></div>
              <div class="preview-meta-row"><span class="lab">大小</span><span class="val">{{ formatSize(previewFile.size) }}</span></div>
              <div class="preview-meta-row"><span class="lab">修改时间</span><span class="val">{{ formatDate(previewFile.mtime) }}</span></div>
              <div class="preview-meta-row"><span class="lab">类型</span><span class="val">{{ previewData.message || '二进制文件' }}</span></div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';

const categories = [
  { key: 'all', label: '全部' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'image', label: '图片' },
  { key: 'document', label: '文档' },
  { key: 'package', label: '安装包' },
  { key: 'other', label: '其他' },
];

const activeCategory = ref('all');
const previewEnabled = ref(false);
const previewFile = ref(null);
const previewData = ref(null);
const previewLoading = ref(false);
const previewError = ref('');
const mediaBlobUrl = ref('');  // blob: URL for video/audio preview

const files = reactive([]);
const selectedIds = reactive(new Set());
const sortDir = ref('desc');  // 'asc' | 'desc'

const scanning = ref(false);
const finished = ref(false);
const scanError = ref('');
const scannedFiles = ref(0);
const totalFound = ref(0);
const taskId = ref(0);
const roots = ref([]);
const currentRoot = ref('');
const elapsedMs = ref(0);

const progressPercent = computed(() => {
  if (!roots.value.length) return scanning.value ? 1 : 0;
  // Soft progress: 0 → 95% from scannedFiles (capped at 200k), 95→100% via elapsed
  const fileRatio = Math.min(1, scannedFiles.value / 200000);
  const timeRatio = scanning.value ? Math.min(1, elapsedMs.value / 60000) : 1;
  return Math.min(100, Math.round((fileRatio * 0.85 + timeRatio * 0.15) * 100));
});

const progressText = computed(() => {
  if (!scanning.value) return '';
  const parts = [];
  if (currentRoot.value) parts.push(shortRoot(currentRoot.value));
  parts.push(`已扫描 ${scannedFiles.value.toLocaleString()}`);
  parts.push(`发现 ${totalFound.value.toLocaleString()}`);
  parts.push(`${(elapsedMs.value / 1000).toFixed(1)}s`);
  return parts.join(' · ');
});

const grouped = computed(() => {
  const map = { all: [], video: [], audio: [], image: [], document: [], package: [], other: [] };
  for (const f of files) {
    map.all.push(f);
    if (map[f.category]) map[f.category].push(f);
  }
  const dir = sortDir.value === 'asc' ? 1 : -1;
  const sorter = (a, b) => dir * (a.size - b.size);
  for (const k of Object.keys(map)) map[k].sort(sorter);
  return map;
});

const currentList = computed(() => grouped.value[activeCategory.value] || []);

const allChecked = computed(() => {
  const list = currentList.value;
  if (!list.length) return false;
  return list.every((f) => selectedIds.has(f.id));
});
const someChecked = computed(() => {
  const list = currentList.value;
  return list.some((f) => selectedIds.has(f.id));
});

const selectedTotalBytes = computed(() => {
  let total = 0;
  for (const f of files) if (selectedIds.has(f.id)) total += f.size;
  return total;
});

const totalSizeBytes = computed(() => {
  let total = 0;
  for (const f of files) total += f.size;
  return total;
});

// Show e.g. "12.4 GB" — keep one decimal when ≥ 1 GB, otherwise show MB / KB.
const totalSizeText = computed(() => {
  const n = totalSizeBytes.value;
  if (!n) return '0 B';
  const gb = n / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = n / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = n / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${n} B`;
});

// Pick the best <img> src: prefer data URL, then custom-protocol URL, then empty.
const imageSrc = computed(() => {
  const d = previewData.value;
  if (!d || d.kind !== 'image') return '';
  return d.dataUrl || d.fileUrl || '';
});

// Video / audio: when bytes are sent via IPC, build a same-origin Blob URL so
// the <video>/<audio> element can play without webSecurity issues.
const videoSrc = computed(() => {
  const d = previewData.value;
  if (!d || (d.kind !== 'video' && d.kind !== 'audio')) return '';
  return mediaBlobUrl.value || d.fileUrl || '';
});

function revokeMediaBlob() {
  if (mediaBlobUrl.value) {
    try { URL.revokeObjectURL(mediaBlobUrl.value); } catch (_) {}
    mediaBlobUrl.value = '';
  }
}

watch(activeCategory, () => {
  // Switching tabs closes the preview panel and clears the highlight.
  previewEnabled.value = false;
  previewFile.value = null;
  previewData.value = null;
  previewError.value = '';
  revokeMediaBlob();
});

function shortRoot(root) {
  if (!root) return '';
  if (root === '/') return '/';
  // Trim home directory prefix to ~ for compactness.
  const home = window.electronAPI?.env?.HOME || '';
  if (home && root.startsWith(home)) return '~' + root.slice(home.length);
  // Windows: split to parent
  return root;
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function iconFor(record) {
  switch (record.category) {
    case 'video': return 'icon-file-video';
    case 'audio': return 'icon-file-audio';
    case 'image': return 'icon-file-image';
    case 'document': return 'icon-file-pdf';
    case 'package': return 'icon-drive-file';
    default: return 'icon-file';
  }
}

function toggleSort() {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
}

async function onReveal(record) {
  if (!record) return;
  const res = await window.electronAPI.cleanupReveal(record.path);
  if (!res?.success) Message.error(res?.error || '无法打开所在文件夹');
}

async function deletePaths(paths, totalSize) {
  if (!paths.length) return;
  const res = await window.electronAPI.cleanupDelete(paths);
  if (res?.success) {
    const ok = (res.results || []).filter((r) => r.ok).length;
    const fail = (res.results || []).filter((r) => !r.ok);
    const removedIds = new Set();
    for (const r of res.results) {
      if (r.ok) {
        const f = files.find((x) => x.path === r.path);
        if (f) removedIds.add(f.id);
      }
    }
    for (let i = files.length - 1; i >= 0; i -= 1) if (removedIds.has(files[i].id)) files.splice(i, 1);
    for (const id of removedIds) selectedIds.delete(id);
    if (previewFile.value && removedIds.has(previewFile.value.id)) {
      previewFile.value = null; previewData.value = null;
    }
    Message.success(`已移至回收站（成功 ${ok} 个${fail.length ? `，失败 ${fail.length}` : ''}）`);
    if (fail.length) console.warn('[cleanup] delete failures', fail);
  } else {
    Message.error(res?.error || '删除失败');
  }
}

function onSelectionChange(keys) {
  // Sync selectedIds with current-tab rows so cross-tab selections add up
  // to "all files I've ever selected" rather than the table's own model.
  const list = currentList.value;
  const idSet = new Set(list.map((f) => f.id));
  for (const id of Array.from(selectedIds)) {
    if (idSet.has(id) && !keys.includes(id)) selectedIds.delete(id);
  }
  for (const k of keys) if (idSet.has(k)) selectedIds.add(k);
}

function onToggleAll(checked) {
  const list = currentList.value;
  if (checked) for (const f of list) selectedIds.add(f.id);
  else for (const f of list) selectedIds.delete(f.id);
}

async function onRowClick(record) {
  previewFile.value = record;
  previewData.value = null;
  previewError.value = '';
  if (!previewEnabled.value) previewEnabled.value = true;
  await loadPreview(record);
}

watch(previewEnabled, async (on) => {
  if (on && previewFile.value && !previewData.value && !previewError.value) {
    await loadPreview(previewFile.value);
  }
});

async function loadPreview(record) {
  previewLoading.value = true;
  previewError.value = '';
  revokeMediaBlob();
  try {
    const res = await window.electronAPI.cleanupPreview(record.path);
    if (!res?.success) {
      previewError.value = res?.error || '无法预览';
      previewData.value = null;
      return;
    }
    previewData.value = res;
    // For video / audio, IPC returns the raw bytes; wrap them in a Blob so
    // <video>/<audio> can stream from a same-origin blob:// URL.
    if ((res.kind === 'video' || res.kind === 'audio') && res.bytes) {
      const u8 = res.bytes instanceof Uint8Array ? res.bytes : new Uint8Array(res.bytes);
      const blob = new Blob([u8], { type: res.mime || 'application/octet-stream' });
      mediaBlobUrl.value = URL.createObjectURL(blob);
    }
  } catch (e) {
    previewError.value = e.message;
    previewData.value = null;
  } finally {
    previewLoading.value = false;
  }
}

async function onDelete() {
  const paths = files.filter((f) => selectedIds.has(f.id)).map((f) => f.path);
  if (!paths.length) return;
  const totalSize = selectedTotalBytes.value;
  Modal.confirm({
    title: '确认删除',
    content: `将 ${paths.length} 个文件（共 ${formatSize(totalSize)}）移至回收站。回收站可在系统中恢复。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: () => deletePaths(paths),
  });
}

function onDeleteOne(record) {
  // The popconfirm in the template already collects the user confirmation;
  // a second Modal.confirm would create a double prompt. Just do the work.
  return deletePaths([record.path]);
}

async function onMove() {
  const paths = files.filter((f) => selectedIds.has(f.id)).map((f) => f.path);
  if (!paths.length) return;
  const pick = await window.electronAPI.cleanupPickDir('选择移动目标文件夹');
  if (!pick?.success) return;
  const target = pick.path;
  Modal.confirm({
    title: '确认移动',
    content: `将 ${paths.length} 个文件移动到 "${target}"？`,
    okText: '移动',
    cancelText: '取消',
    onOk: async () => {
      const res = await window.electronAPI.cleanupMove(paths, target);
      if (res?.success) {
        const removedIds = new Set();
        for (const r of res.results) {
          if (r.ok) {
            const f = files.find((x) => x.path === r.path);
            if (f) removedIds.add(f.id);
          }
        }
        for (let i = files.length - 1; i >= 0; i -= 1) if (removedIds.has(files[i].id)) files.splice(i, 1);
        for (const id of removedIds) selectedIds.delete(id);
        if (previewFile.value && removedIds.has(previewFile.value.id)) {
          previewFile.value = null; previewData.value = null;
        }
        const ok = (res.results || []).filter((r) => r.ok).length;
        const fail = (res.results || []).filter((r) => !r.ok);
        Message.success(`已移动 ${ok} 个文件${fail.length ? `，失败 ${fail.length}` : ''}`);
      } else {
        Message.error(res?.error || '移动失败');
      }
    },
  });
}

// ── IPC event wiring ──
const handlers = {
  started: ({ taskId: tid, roots: r }) => { if (tid === taskId.value) roots.value = r; },
  rootStart: ({ taskId: tid, root }) => { if (tid === taskId.value) currentRoot.value = root; },
  rootDone: () => {},
  progress: ({ taskId: tid, scannedFiles: sf, foundFiles, elapsedMs: e }) => {
    if (tid !== taskId.value) return;
    scannedFiles.value = sf; totalFound.value = foundFiles; elapsedMs.value = e;
  },
  files: ({ taskId: tid, entries }) => {
    if (tid !== taskId.value) return;
    for (const e of entries) files.push(e);
  },
  done: ({ taskId: tid, scannedFiles: sf, foundFiles, durationMs }) => {
    if (tid !== taskId.value) return;
    scannedFiles.value = sf; totalFound.value = foundFiles; elapsedMs.value = durationMs;
    scanning.value = false;
    finished.value = true;
  },
  error: ({ taskId: tid, error }) => {
    if (tid !== taskId.value) return;
    scanning.value = false;
    finished.value = true;
    scanError.value = error || '扫描失败';
  },
};

let offs = [];
onMounted(async () => {
  offs.push(window.electronAPI.onCleanupStarted(handlers.started) || (() => {}));
  offs.push(window.electronAPI.onCleanupRootStart(handlers.rootStart) || (() => {}));
  offs.push(window.electronAPI.onCleanupRootDone(handlers.rootDone) || (() => {}));
  offs.push(window.electronAPI.onCleanupProgress(handlers.progress) || (() => {}));
  offs.push(window.electronAPI.onCleanupFiles(handlers.files) || (() => {}));
  offs.push(window.electronAPI.onCleanupDone(handlers.done) || (() => {}));
  offs.push(window.electronAPI.onCleanupError(handlers.error) || (() => {}));

  // Auto-start scan
  await startScan();
});

onBeforeUnmount(() => {
  offs.forEach((off) => { try { off && off(); } catch (_) {} });
  revokeMediaBlob();
  // Best-effort cancel so we don't keep the worker spinning in the background.
  window.electronAPI.cleanupStopScan().catch(() => {});
});

async function startScan() {
  if (scanning.value) return;
  files.splice(0, files.length);
  for (const id of Array.from(selectedIds)) selectedIds.delete(id);
  previewFile.value = null; previewData.value = null;
  scanning.value = true; finished.value = false; scanError.value = '';
  scannedFiles.value = 0; totalFound.value = 0; elapsedMs.value = 0;
  roots.value = []; currentRoot.value = '';
  try {
    const ret = await window.electronAPI.cleanupScan();
    taskId.value = ret?.taskId || 0;
  } catch (e) {
    scanning.value = false; finished.value = true;
    scanError.value = e.message || '启动扫描失败';
  }
}
</script>

<style scoped>
.cleanup-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}
:deep(.sub-page) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.section-spacer {
  flex: 1;
}
.section-total {
  font-size: 13px;
  color: #1D2129;
  background: #F2F3F5;
  padding: 4px 10px;
  border-radius: 10px;
  white-space: nowrap;
}
.section-total b {
  color: #165DFF;
  font-weight: 700;
  margin-left: 2px;
}

.cleanup-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.cleanup-tabs :deep(.arco-tabs-nav-type-line .arco-tabs-header-title) {
  padding: 4px 8px;
  font-size: 13px;
}
.cleanup-tabs :deep(.arco-tabs-nav-type-line) {
  --tabs-line-margin-title-horizontal: 14px;
}
.cleanup-tabs-nav {
  flex: 1;
  min-width: 0;
}
.cleanup-tabs :deep(.arco-tabs) {
  flex: 1;
  min-width: 0;
}
.cleanup-tabs-right {
  flex-shrink: 0;
  padding-right: 4px;
}
.preview-label {
  font-size: 13px;
  color: #4E5969;
}

.cleanup-progress {
  margin-bottom: 12px;
}

.cleanup-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cleanup-body.with-preview {
  flex-direction: row;
  gap: 12px;
}

.cleanup-list-wrap {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  padding: 0;
  overflow: auto;
}

.cleanup-body.with-preview .cleanup-list-wrap {
  flex: 1 1 60%;
}

.cleanup-list-wrap .cleanup-toolbar {
  padding: 12px 12px 4px;
  flex-shrink: 0;
}

.cleanup-list-wrap .cleanup-table {
  flex: 0 1 auto;
  min-height: 0;
  padding: 0 12px 12px;
  overflow: visible;
}

.cleanup-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 4px 6px;
}
.cleanup-toolbar-stat {
  font-size: 12px;
  color: #4E5969;
}
.cleanup-toolbar-spacer {
  flex: 1;
}

.cleanup-table {
  flex: 1;
  min-height: 0;
}

.file-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.file-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background: #F2F3F5;
  color: #86909C;
}
.file-icon.cat-video { background: #FFF1F0; color: #F53F3F; }
.file-icon.cat-audio { background: #F0F5FF; color: #165DFF; }
.file-icon.cat-image { background: #F0FFF4; color: #00B42A; }
.file-icon.cat-document { background: #FFF7E6; color: #FF7D00; }
.file-icon.cat-package { background: #F9F0FF; color: #722ED1; }
.file-icon.cat-other { background: #F2F3F5; color: #86909C; }
.file-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.file-name {
  font-size: 13px;
  font-weight: 600;
  color: #1D2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-path {
  font-size: 11px;
  color: #86909C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-size {
  font-weight: 600;
  color: #1D2129;
}

.file-root {
  font-size: 12px;
  color: #86909C;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.row-zoom {
  appearance: none;
  border: none;
  background: transparent;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  color: #86909C;
  display: none;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}
.row-zoom :deep(.arco-icon) {
  font-size: 16px;
}
.cleanup-table :deep(.arco-table-tr):hover .row-zoom {
  display: inline-flex;
}
.row-zoom:hover {
  color: #165DFF;
  background: #F0F5FF;
}

.header-sort {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.header-sort :deep(.arco-icon) {
  font-size: 12px;
  color: #165DFF;
}
.header-sort:hover {
  color: #165DFF;
}

/* Preview panel */
.cleanup-preview {
  flex: 1 1 40%;
  min-width: 0;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #F2F3F5;
  margin-bottom: 10px;
}
.preview-title {
  font-size: 14px;
  font-weight: 700;
  color: #1D2129;
}
.preview-meta-name {
  flex: 1;
  font-size: 12px;
  color: #86909C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  color: #4E5969;
  font-size: 13px;
}
.preview-body.preview-text {
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
}
.preview-body.preview-text pre {
  flex: 1;
  margin: 0;
  padding: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  color: #1D2129;
}
.preview-truncated {
  color: #C9CDD4;
  font-style: italic;
}
.preview-body.preview-media {
  background: #0F1419;
  border-radius: 8px;
}
.preview-body.preview-media img,
.preview-body.preview-media video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.preview-body.preview-media audio {
  width: 80%;
}
.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #86909C;
}
.preview-empty-icon {
  font-size: 36px;
  color: #C9CDD4;
}
.preview-loading-text {
  margin-left: 10px;
}
.preview-meta-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 12px;
}
.preview-meta-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 13px;
}
.preview-meta-row .lab {
  width: 80px;
  flex-shrink: 0;
  color: #86909C;
}
.preview-meta-row .val {
  flex: 1;
  min-width: 0;
  color: #1D2129;
  word-break: break-all;
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.2s ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
