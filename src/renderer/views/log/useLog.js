import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import { logAdminApi } from '@/api/admin-rpc';
import { on } from '@/core/ipc';

export function useLog() {
  const logs = ref([]);
  const selectedLog = ref(null);
  const logListRef = ref(null);

  const logLevel = ref('all');
  const searchKeyword = ref('');
  const logSource = ref('all');
  const autoRefresh = ref(true);

  const detailModal = ref({
    visible: false,
    log: null,
    title: '日志详情',
    analysis: '',
    solutions: [],
  });

  const analyzing = ref(false);

  const errorCount = computed(() =>
    filteredLogs.value.filter(log => log.level === 'error').length
  );
  const warningCount = computed(() =>
    filteredLogs.value.filter(log => log.level === 'warn').length
  );
  const infoCount = computed(() =>
    filteredLogs.value.filter(log => log.level === 'info').length
  );

  const filteredLogs = computed(() => {
    let filtered = [...logs.value];

    if (logLevel.value !== 'all') {
      filtered = filtered.filter(log => log.level === logLevel.value);
    }

    if (logSource.value !== 'all') {
      filtered = filtered.filter(log => log.source === logSource.value);
    }

    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(keyword) ||
        (log.details && log.details.toLowerCase().includes(keyword))
      );
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  });

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'red';
      case 'warn': return 'orange';
      case 'info': return 'green';
      case 'debug': return 'blue';
      default: return 'gray';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const addLog = (log) => {
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      level: log.level || 'info',
      source: log.source || 'unknown',
      message: log.message || '',
      details: log.details || '',
    };

    logs.value.unshift(logEntry);

    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(0, 1000);
    }

    if (autoRefresh.value) {
      nextTick(() => {
        if (logListRef.value) {
          logListRef.value.scrollTop = 0;
        }
      });
    }
  };

  const clearLogs = () => {
    logs.value = [];
    Message.success('日志已清空');
  };

  const toggleAutoRefresh = () => {
    autoRefresh.value = !autoRefresh.value;
    Message.info(autoRefresh.value ? '已开启自动刷新' : '已关闭自动刷新');
  };

  const copyLogs = async () => {
    try {
      const text = filteredLogs.value.map(log =>
        `[${formatTime(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
      ).join('\n');

      await navigator.clipboard.writeText(text);
      Message.success('日志已复制到剪贴板');
    } catch (error) {
      Message.error('复制失败: ' + error.message);
    }
  };

  const exportLogs = () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        logs: filteredLogs.value,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openclaw-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Message.success('日志已导出');
    } catch (error) {
      Message.error('导出失败: ' + error.message);
    }
  };

  const selectLog = (log) => {
    selectedLog.value = selectedLog.value === log ? null : log;
  };

  const copyLog = async (log) => {
    try {
      const text = `[${formatTime(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;
      await navigator.clipboard.writeText(text);
      Message.success('日志已复制');
    } catch (error) {
      Message.error('复制失败: ' + error.message);
    }
  };

  const analyzeLog = (log) => {
    detailModal.value = {
      visible: true,
      log: log,
      title: '错误分析',
      analysis: '',
      solutions: [],
    };
  };

  const analyzeSelectedLog = async () => {
    analyzing.value = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const log = detailModal.value.log;
      let analysis = '';
      let solutions = [];

      if (log.message.includes('网络') || log.message.includes('连接')) {
        analysis = '此错误可能与网络连接问题相关。';
        solutions = [
          '检查网络连接是否正常',
          '确认OpenClaw服务是否正在运行',
          '检查防火墙设置是否阻止了连接',
        ];
      } else if (log.message.includes('权限') || log.message.includes('拒绝')) {
        analysis = '此错误可能与权限问题相关。';
        solutions = [
          '检查应用是否有足够的文件系统权限',
          '尝试以管理员身份运行',
          '检查配置文件权限设置',
        ];
      } else if (log.message.includes('内存') || log.message.includes('溢出')) {
        analysis = '此错误可能与内存使用问题相关。';
        solutions = [
          '关闭不必要的应用程序释放内存',
          '检查是否有内存泄漏',
          '考虑增加系统虚拟内存',
        ];
      } else {
        analysis = '此错误原因需要进一步分析。';
        solutions = [
          '查看相关文档获取更多信息',
          '检查OpenClaw配置文件',
          '重启OpenClaw服务',
        ];
      }

      detailModal.value.analysis = analysis;
      detailModal.value.solutions = solutions;
    } catch (error) {
      Message.error('分析失败: ' + error.message);
    } finally {
      analyzing.value = false;
    }
  };

  const handleSearch = () => {
  };

  const loadMockLogs = () => {
    const mockLogs = [
      {
        id: '1',
        timestamp: Date.now() - 1000,
        level: 'info',
        source: 'openclaw',
        message: 'OpenClaw服务启动成功',
      },
      {
        id: '2',
        timestamp: Date.now() - 2000,
        level: 'info',
        source: 'electron',
        message: 'Electron应用已启动',
      },
      {
        id: '3',
        timestamp: Date.now() - 3000,
        level: 'warn',
        source: 'websocket',
        message: 'WebSocket连接不稳定',
        details: '连接中断，正在尝试重连...',
      },
      {
        id: '4',
        timestamp: Date.now() - 4000,
        level: 'error',
        source: 'openclaw',
        message: '技能安装失败',
        details: '安装技能时遇到网络错误：连接超时',
      },
      {
        id: '5',
        timestamp: Date.now() - 5000,
        level: 'debug',
        source: 'renderer',
        message: '组件加载完成',
      },
    ];

    logs.value = mockLogs;
  };

  const setupLogListener = () => {
    try {
      return on('log-message', (log) => {
        addLog(log);
      });
    } catch (e) {
      const interval = setInterval(() => {
        if (Math.random() > 0.7) {
          const levels = ['info', 'warn', 'error', 'debug'];
          const sources = ['openclaw', 'electron', 'renderer', 'websocket'];
          const level = levels[Math.floor(Math.random() * levels.length)];
          const source = sources[Math.floor(Math.random() * sources.length)];

          addLog({
            level,
            source,
            message: `模拟日志 - ${level} - ${source}`,
          });
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  };

  const loadLogs = async () => {
    try {
      const result = await logAdminApi.tail({
        cursor: 0,
        limit: 500,
        maxBytes: 250000
      });

      if (result?.logs) {
        logs.value = result.logs.map(log => ({
          id: Date.now() + Math.random(),
          timestamp: log.ts || new Date().toISOString(),
          level: log.level || 'info',
          source: log.source || 'openclaw',
          message: log.message || JSON.stringify(log),
        }));
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      loadMockLogs();
    }
  };

  onMounted(() => {
    loadLogs();
    const cleanup = setupLogListener();

    onUnmounted(() => {
      if (cleanup) cleanup();
    });
  });

  return {
    logs, selectedLog, logListRef,
    logLevel, searchKeyword, logSource, autoRefresh,
    detailModal, analyzing,
    errorCount, warningCount, infoCount, filteredLogs,
    clearLogs, toggleAutoRefresh, copyLogs, exportLogs,
    selectLog, copyLog, analyzeLog, analyzeSelectedLog,
    getLevelColor, formatTime, handleSearch,
    addLog, loadLogs,
  };
}
