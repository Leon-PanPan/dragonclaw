// modeStore.ts - 连接模式状态管理
// 管理本机模式 / 远程模式的切换，以及远程配置的持久化

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configApi } from '@/api/gateway';

export type ConnectionMode = 'local' | 'remote';
export type AuthMethod = 'none' | 'token' | 'password';

export interface RemoteConfig {
  ip: string;
  port: number;
  authMethod: AuthMethod;
  token: string;
  password: string;
}

// 远程配置存储键（存在 ~/.dragonclaw/remote-config.json）
const REMOTE_CONFIG_KEY = 'dragonclaw-remote-config';
const CONNECTION_MODE_KEY = 'dragonclaw-connection-mode';
// 旧键名（升级时一次性迁移，迁移完成后不再使用）
const LEGACY_REMOTE_CONFIG_KEY = 'smart-openclaw-remote-config';
const LEGACY_CONNECTION_MODE_KEY = 'smart-openclaw-connection-mode';

export const useModeStore = defineStore('mode', () => {
  // 当前连接模式
  const mode = ref<ConnectionMode>('local');

  // 远程配置
  const remoteConfig = ref<RemoteConfig>({
    ip: '',
    port: 18789,
    authMethod: 'token',
    token: '',
    password: '',
  });

  // 是否为远程模式
  const isRemote = computed(() => mode.value === 'remote');

  // 当前 WebSocket 地址
  const wsUrl = computed(() => {
    if (mode.value === 'remote' && remoteConfig.value.ip) {
      const { ip, port, authMethod, token } = remoteConfig.value;
      const tokenPart = authMethod === 'token' && token ? `?token=${encodeURIComponent(token)}` : '';
      return `ws://${ip}:${port}${tokenPart}`;
    }
    return null; // 本机模式由 websocketManager 自行决定
  });

  // 切换到本机模式
  function setLocalMode() {
    mode.value = 'local';
    saveMode();
  }

  // 切换到远程模式（需要先传入配置）
  function setRemoteMode(config: RemoteConfig) {
    remoteConfig.value = { ...config };
    mode.value = 'remote';
    saveMode();
    saveRemoteConfig(config);
  }

  // 更新远程配置（不切换模式）
  function updateRemoteConfig(config: RemoteConfig) {
    remoteConfig.value = { ...config };
    saveRemoteConfig(config);
  }

  // 持久化当前模式（写入 localStorage 及 electron 配置）
  function saveMode() {
    try {
      localStorage.setItem(CONNECTION_MODE_KEY, mode.value);
    } catch (e) {
      // ignore
    }
  }

  // 持久化远程配置
  async function saveRemoteConfig(config: RemoteConfig) {
    try {
      // 创建安全副本（密码不持久化）
      const safeConfig = { ...config };
      if (safeConfig.authMethod === 'password') {
        safeConfig.password = '';  // 不保存密码
      }
      
      // 写入 localStorage（快速访问）
      localStorage.setItem(REMOTE_CONFIG_KEY, JSON.stringify(safeConfig));
      // 写入 electron IPC（持久化到文件）
      if (window.electronAPI?.saveRemoteConfig) {
        await configApi.remoteSave(safeConfig);
      }
    } catch (e) {
      console.warn('[modeStore] 保存远程配置失败:', e);
    }
  }

  // 从持久化存储加载配置
  async function loadFromStorage() {
    try {
      // 1. 读取模式（先读新键，没有则尝试旧键并迁移）
      let savedMode = localStorage.getItem(CONNECTION_MODE_KEY) as ConnectionMode | null;
      if (!savedMode) {
        const legacyMode = localStorage.getItem(LEGACY_CONNECTION_MODE_KEY) as ConnectionMode | null;
        if (legacyMode === 'local' || legacyMode === 'remote') {
          savedMode = legacyMode;
          try {
            localStorage.setItem(CONNECTION_MODE_KEY, legacyMode);
            localStorage.removeItem(LEGACY_CONNECTION_MODE_KEY);
          } catch {
            // ignore
          }
        }
      }
      if (savedMode === 'local' || savedMode === 'remote') {
        mode.value = savedMode;
      }

      // 2. 读取远程配置（优先从 electron IPC，退回 localStorage）
      let savedConfig: RemoteConfig | null = null;

      if (window.electronAPI?.loadRemoteConfig) {
        savedConfig = await configApi.remoteLoad();
      }

      if (!savedConfig) {
        let raw = localStorage.getItem(REMOTE_CONFIG_KEY);
        // 旧键迁移：若新键不存在而旧键存在，则回填新键并删除旧键
        if (!raw) {
          const legacyRaw = localStorage.getItem(LEGACY_REMOTE_CONFIG_KEY);
          if (legacyRaw) {
            try {
              localStorage.setItem(REMOTE_CONFIG_KEY, legacyRaw);
              localStorage.removeItem(LEGACY_REMOTE_CONFIG_KEY);
              raw = legacyRaw;
            } catch {
              // ignore
            }
          }
        }
        if (raw) {
          try {
            savedConfig = JSON.parse(raw);
          } catch {
            // ignore
          }
        }
      }

      if (savedConfig && savedConfig.ip) {
        // 向后兼容：如果没有 authMethod 字段，根据 token 推断
        let authMethod = savedConfig.authMethod;
        if (!authMethod) {
          authMethod = savedConfig.token ? 'token' : 'none';
        }
        
        remoteConfig.value = {
          ip: savedConfig.ip || '',
          port: savedConfig.port || 18789,
          authMethod: authMethod,
          token: savedConfig.token || '',
          password: '',  // 密码不从存储加载，每次需要重新输入
        };
      }
    } catch (e) {
      console.warn('[modeStore] 加载配置失败:', e);
    }
  }

  return {
    mode,
    remoteConfig,
    isRemote,
    wsUrl,
    setLocalMode,
    setRemoteMode,
    updateRemoteConfig,
    loadFromStorage,
  };
});
