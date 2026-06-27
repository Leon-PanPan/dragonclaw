<template>
  <div class="sub-page manage-page">
    <div class="section-header">
      <span class="section-title">软件管理</span>
      <span class="section-count" v-if="apps.length">{{ apps.length }} 个应用</span>
    </div>

    <a-table
      :data="filteredApps"
      :pagination="false"
      :loading="scanning"
      row-key="id"
      :bordered="false"
      :stripe="true"
      :show-border="false"
      size="medium"
      table-layout-fixed
      class="manage-table no-bordered"
    >
      <template #columns>
        <a-table-column title="应用" :width="320">
          <template #cell="{ record }">
            <div class="app-cell">
              <div class="app-icon">
                <img v-if="record.icon && !failedIcons.has(record.id)" :src="record.icon" :alt="record.name" @error="onIconError($event, record)" />
                <span v-else class="app-icon-fallback" :style="fallbackStyle(record)">{{ initial(record.name) }}</span>
              </div>
              <div class="app-meta">
                <span class="app-name" :title="record.name">{{ record.name }}</span>
                <span class="app-publisher" :title="record.publisher">{{ record.publisher || record.version || record.installPath || '—' }}</span>
              </div>
            </div>
          </template>
        </a-table-column>

        <a-table-column title="开机启动" :width="110" align="center">
          <template #cell="{ record }">
            <a-switch
              :model-value="!!record.autostart"
              :loading="record.__autostartLoading"
              @change="(v) => onToggleAutostart(record, v)"
            />
          </template>
        </a-table-column>

        <a-table-column title="大小" :width="110">
          <template #cell="{ record }">
            <span v-if="record.sizeBytes > 0">{{ formatSize(record.sizeBytes) }}</span>
            <span v-else-if="sizeLoadingSet.has(record.id)" class="size-loading">计算中...</span>
            <span v-else class="size-empty">—</span>
          </template>
        </a-table-column>

        <a-table-column title="安装时间" :width="160">
          <template #cell="{ record }">{{ formatDate(record.installDate) }}</template>
        </a-table-column>

        <a-table-column title="上次打开" :width="160">
          <template #cell="{ record }">{{ formatDate(record.lastUsed) || '—' }}</template>
        </a-table-column>

        <a-table-column title="操作" :width="100" fixed="right" align="center">
          <template #cell="{ record }">
            <a-button type="text" size="small" status="danger" :loading="record.__uninstallLoading" @click="onUninstall(record)">
              <template #icon><icon-delete /></template>
              卸载
            </a-button>
          </template>
        </a-table-column>
      </template>

      <template #empty>
        <div v-if="!scanning" class="empty-box">
          <icon-apps class="empty-icon" />
          <span v-if="scanError">{{ scanError }}</span>
          <span v-else>暂无已安装应用</span>
        </div>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';

const apps = ref([]);
const scanning = ref(false);
const scanError = ref('');
const taskId = ref(0);

const failedIcons = reactive(new Set());
const sizeLoadingSet = reactive(new Set());

const platform = window.electronAPI?.platform || 'unknown';

const filteredApps = computed(() => apps.value);

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
};

const formatDate = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const onIconError = (e, record) => {
  failedIcons.add(record.id);
};

const initial = (name) => {
  if (!name) return '?';
  // Use the first CJK char or first latin letter
  const c = Array.from(name)[0];
  return c ? c.toUpperCase() : '?';
};

const FALLBACK_PALETTE = ['#165DFF', '#722ED1', '#13C2C2', '#52C41A', '#FA8C16', '#EB2F96', '#2F54EB'];
const fallbackStyle = (record) => {
  const name = record.name || '';
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const color = FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
  return { background: color };
};

const startScan = async () => {
  if (scanning.value) {
    await window.electronAPI?.stopScanSoftware?.();
    return;
  }
  apps.value = [];
  scanError.value = '';
  failedIcons.clear();
  sizeLoadingSet.clear();
  scanning.value = true;
  try {
    const ret = await window.electronAPI.scanSoftware();
    taskId.value = ret?.taskId || 0;
  } catch (e) {
    scanning.value = false;
    scanError.value = e.message || '启动扫描失败';
  }
};

const handleProgress = ({ taskId: tid, app }) => {
  if (tid !== taskId.value) return;
  if (app && app.id) {
    apps.value.push(app);
    if (!(app.sizeBytes > 0)) sizeLoadingSet.add(app.id);
  }
};

const handleDone = ({ taskId: tid }) => {
  if (tid !== taskId.value) return;
  scanning.value = false;
};

const handleError = ({ taskId: tid, error }) => {
  if (tid !== taskId.value) return;
  scanning.value = false;
  scanError.value = error || '扫描失败';
};

// 处理图标更新
const handleIconUpdate = ({ taskId: tid, appId, icon }) => {
  if (tid !== taskId.value) return;
  const app = apps.value.find(a => a.id === appId);
  if (app) app.icon = icon;
};

// 处理大小更新
const handleSizeUpdate = ({ taskId: tid, appId, sizeBytes }) => {
  if (tid !== taskId.value) return;
  const app = apps.value.find(a => a.id === appId);
  if (app) {
    app.sizeBytes = sizeBytes;
    sizeLoadingSet.delete(appId);
  }
};

// 处理最后使用时间更新
const handleLastUsedUpdate = ({ taskId: tid, appId, lastUsed }) => {
  if (tid !== taskId.value) return;
  const app = apps.value.find(a => a.id === appId);
  if (app) app.lastUsed = lastUsed;
};

let offs = [];
onMounted(() => {
  offs.push(window.electronAPI?.onSoftwareScanProgress?.(handleProgress) || (() => {}));
  offs.push(window.electronAPI?.onSoftwareScanDone?.(handleDone) || (() => {}));
  offs.push(window.electronAPI?.onSoftwareScanError?.(handleError) || (() => {}));
  offs.push(window.electronAPI?.onSoftwareIconUpdate?.(handleIconUpdate) || (() => {}));
  offs.push(window.electronAPI?.onSoftwareSizeUpdate?.(handleSizeUpdate) || (() => {}));
  offs.push(window.electronAPI?.onSoftwareLastUsedUpdate?.(handleLastUsedUpdate) || (() => {}));
  startScan();
});
onBeforeUnmount(() => { offs.forEach((off) => { try { off && off(); } catch (_) {} }); });

const onToggleAutostart = async (record, val) => {
  record.__autostartLoading = true;
  try {
    const res = await window.electronAPI.toggleAutostart({ app: record, enabled: val });
    if (res?.success) {
      record.autostart = val;
      Message.success(val ? '已设为开机启动' : '已取消开机启动');
    } else {
      Message.error(res?.error || '操作失败');
    }
  } finally {
    record.__autostartLoading = false;
  }
};

const onUninstall = (record) => {
  Modal.confirm({
    title: '确认卸载',
    content: `确定要卸载 "${record.name}" 吗？此操作不可撤销。`,
    okText: '卸载',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      record.__uninstallLoading = true;
      try {
        const res = await window.electronAPI.uninstallSoftwareByApp(record);
        if (res?.success) {
          Message.success(res.note || '卸载指令已发送');
          apps.value = apps.value.filter((a) => a.id !== record.id);
        } else {
          Message.error(res?.error || '卸载失败');
        }
      } finally {
        record.__uninstallLoading = false;
      }
    },
  });
};
</script>
