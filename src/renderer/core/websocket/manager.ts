// WebSocket 管理器 - 实现 OpenClaw Gateway 长连接
// 参考官方 ui/src/ui/gateway.ts 实现

import { ref } from 'vue';
import * as ed from '@noble/ed25519';
import { systemApi } from '@/api/gateway';
import { adminClient } from '@/core/http/admin';

// 注意：不设置 ed.hashes.sha512，使用内置的 sha512Async（基于 Web Crypto）

// 连接状态
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// 存储键
const DEVICE_IDENTITY_STORAGE_KEY = 'openclaw-device-identity-v1';

// Base64URL 编解码 - 使用浏览器内置方法
function base64UrlEncode(bytes: Uint8Array): string {
  // 将 Uint8Array 转换为字节字符串，然后用 btoa 编码
  const binary = String.fromCharCode.apply(null, Array.from(bytes));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 设备身份类型
interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKey: string;
}

// 计算公钥指纹（SHA-256 哈希，官方方式）
async function fingerprintPublicKey(publicKey: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', publicKey.slice().buffer);
  return bytesToHex(new Uint8Array(hash));
}

// 生成新身份 - 使用与官方相同的方法
async function generateIdentity(): Promise<DeviceIdentity> {
  // 使用 noble/ed25519 的 utils.randomSecretKey 生成私钥
  const privateKey = ed.utils.randomSecretKey();
  // 使用 getPublicKeyAsync 获取公钥
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  // 使用公钥的 SHA-256 哈希作为设备 ID
  const deviceId = await fingerprintPublicKey(publicKey);
  
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKey),
    privateKey: base64UrlEncode(privateKey)
  };
}

// 加载或创建设备身份
async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null> {
  try {
    // 检查是否是安全上下文
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.log('不是安全上下文，跳过设备身份');
      return null;
    }

    const raw = localStorage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed.deviceId && parsed.publicKey && parsed.privateKey) {
        // 验证设备 ID 是否与公钥匹配
        const derivedId = await fingerprintPublicKey(base64UrlDecode(parsed.publicKey));
        if (derivedId !== parsed.deviceId) {
          console.log('设备 ID 不匹配，重新生成');
        } else {
          console.log('加载已有设备身份:', parsed.deviceId);
          return {
            deviceId: parsed.deviceId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey
          };
        }
      }
    }
  } catch (e) {
    console.warn('加载设备身份失败:', e);
  }

  // 生成新身份
  try {
    console.log('生成新设备身份...');
    const identity = await generateIdentity();

    localStorage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify({
      version: 1,
      ...identity
    }));

    console.log('新设备身份已生成:', identity.deviceId);
    return identity;
  } catch (e) {
    console.error('生成设备身份失败:', e);
    return null;
  }
}

// 签名 payload
async function signPayload(privateKeyBase64: string, payload: string): Promise<string> {
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  const data = new TextEncoder().encode(payload);
  
  // 使用 noble/ed25519 的 signAsync 方法（异步版本使用内置 sha512Async）
  const signature = await ed.signAsync(data, privateKeyBytes);
  return base64UrlEncode(signature);
}

// 构建设备认证 payload (v2 格式)
function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce
  ].join('|');
}

// WebSocket 管理器类
class WebSocketManager {
  private ws: WebSocket | null = null;
  private state = ref(ConnectionState.DISCONNECTED);
  private sessionKey: string | null = null;
  private agentId: string = 'main';
  private authToken: string = '';
  private messageHandler: ((data: any) => void) | null = null;
  private errorHandler: ((error: any) => void) | null = null;
  private _subscribers: Set<(data: any) => void> = new Set();
  private _msgSeq: number = 0;
  private stateChangeHandler: ((state: string) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;
  private connectingId: number = 0;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private heartbeatTimer: number | null = null;
  private connectNonce: string | null = null;
  private closed: boolean = false;
  private deviceIdentity: DeviceIdentity | null = null;
  private url: string = '';
  private connectResolve: (() => void) | null = null;
  private connectId: number = 0; // 用于区分不同连接的 close 事件
  private connectReject: ((err: any) => void) | null = null;
  private lastConnectOptions: any = null; // 保存上次的连接选项，用于重连
  private reconnectTimer: number | null = null;
  private connectingPromise: Promise<void> | null = null; // 用于在 request() 主动 connect 时去重
  private gatewayStatusCheckInterval: number | null = null;
  private _gatewayPort: number = 18789; // 默认端口，可通过配置更新
  private _remoteMode: boolean = false; // 是否为远程模式
  private _remoteUrl: string | null = null; // 远程模式 WebSocket URL（完整 URL）
  private readyWaiters: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: number;
  }> = [];
  private readyRejected: boolean = false;
  private _remotePassword: string = ''; // 远程模式密码
  private _remoteAuthMethod: 'none' | 'token' | 'password' = 'token'; // 远程认证方式

  // 监听 Gateway 状态变化，自动重连
  private setupGatewayStatusListener() {
    // 监听 gateway-status-changed 事件
    const handler = (event: CustomEvent) => {
      const status = event.detail?.status;
      console.log('收到 Gateway 状态变化:', status);
      
      if (status === 'connected' || status === 'running') {
        // Gateway 已连接/运行，尝试重连
        console.log('Gateway 已就绪，尝试建立 WebSocket 连接...');
        this.reconnectAttempts = 0; // 重置重连计数
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        // 延迟一点再连接，等 Gateway 完全启动
        setTimeout(() => {
          if (this.lastConnectOptions) {
            this.connect(this.lastConnectOptions);
          }
        }, 2000);
      }
    };
    
    window.addEventListener('gateway-status-changed', handler as EventListener);
    
    // 定时检查 Gateway 是否运行（使用纯 TCP 端口检测，不调用 CLI）
    if (!this.gatewayStatusCheckInterval) {
      this.gatewayStatusCheckInterval = window.setInterval(async () => {
        if (this.state.value !== ConnectionState.CONNECTED && this.lastConnectOptions) {
          // 远程模式下跳过本地端口检测，直接尝试重连
          if (this._remoteMode) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts = 0;
              this.connect(this.lastConnectOptions).catch(() => {});
            }
            return;
          }
          // 本机模式：使用 fetch 尝试连接 Gateway 的 HTTP 端点（更快且不阻塞）
          // 使用 no-cors 模式避免 CORS 问题，因为我们只是检测端口是否开放
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            await fetch(`http://127.0.0.1:${this._gatewayPort}/`, {
              signal: controller.signal,
              method: 'GET',
              mode: 'no-cors' // 不检查 CORS，只检测端口是否响应
            });
            clearTimeout(timeoutId);
            
            // 如果 fetch 没有抛出异常，说明 Gateway 在运行（或至少端口有响应）
            console.log('检测到 Gateway 端口响应，尝试 WebSocket 重连...');
            this.reconnectAttempts = 0;
            this.connect(this.lastConnectOptions);
          } catch (e) {
            // 连接失败（ECONNREFUSED、超时或 CORS），说明 Gateway 没运行，不做处理
            // 静默处理，避免刷屏
          }
        }
      }, 5000); // 每5秒检查一次
    }
  }
  
  // 设置 Gateway 端口（从配置文件读取）
  setGatewayPort(port: number) {
    this._gatewayPort = port;
    adminClient.configure({ port });
    console.log(`Gateway 端口已更新为: ${port}`);
  }
  
  // 获取当前 Gateway 端口
  getGatewayPort(): number {
    return this._gatewayPort;
  }

  /**
   * 设置连接模式（本机 / 远程）
   * @param mode 'local' | 'remote'
   * @param remoteConfig 远程配置（mode='remote' 时必须提供）
   */
  setMode(mode: 'local' | 'remote', remoteConfig?: { 
    ip: string; 
    port: number; 
    token?: string;
    password?: string;
    authMethod?: 'none' | 'token' | 'password';
  }) {
    if (mode === 'remote' && remoteConfig) {
      this._remoteMode = true;
      this._remotePassword = remoteConfig.password || '';
      this._remoteAuthMethod = remoteConfig.authMethod || 'token';
      
      // 根据认证方式构建 URL
      let tokenPart = '';
      if (remoteConfig.authMethod === 'token' && remoteConfig.token) {
        tokenPart = `?token=${encodeURIComponent(remoteConfig.token)}`;
      }
      this._remoteUrl = `ws://${remoteConfig.ip}:${remoteConfig.port}${tokenPart}`;
      
      adminClient.configure({ host: remoteConfig.ip, port: remoteConfig.port, token: remoteConfig.token });
      console.log(`[wsManager] 切换到远程模式: ${remoteConfig.ip}:${remoteConfig.port}, 认证方式: ${this._remoteAuthMethod}`);
    } else {
      this._remoteMode = false;
      this._remoteUrl = null;
      this._remotePassword = '';
      this._remoteAuthMethod = 'token';
      adminClient.configure({ host: '127.0.0.1', port: this._gatewayPort });
      console.log(`[wsManager] 切换到本机模式`);
    }
  }

  // 获取当前连接是否为远程模式
  isRemoteMode(): boolean {
    return this._remoteMode;
  }

  // 连接到 WebSocket Gateway
  async connect(options: {
    agentId?: string;
    token?: string;
    sessionKey?: string | null;
    onMessage?: (data: any) => void;
    onError?: (error: any) => void;
    onStateChange?: (state: string) => void;
  } = {}): Promise<void> {
    // 如果已经连接（握手完成），直接返回
    if (this.state.value === ConnectionState.CONNECTED) {
      console.log('WebSocket 已连接（握手完成），复用现有连接');
      return Promise.resolve();
    }
    
    // 如果正在连接中（握手未完成），等待
    if (this.state.value === ConnectionState.CONNECTING) {
      console.log('WebSocket 正在连接中，等待握手完成...');
      return new Promise((resolve, reject) => {
        const checkConnected = setInterval(() => {
          if (this.state.value === ConnectionState.CONNECTED) {
            clearInterval(checkConnected);
            resolve();
          } else if (this.state.value === ConnectionState.ERROR || this.state.value === ConnectionState.DISCONNECTED) {
            clearInterval(checkConnected);
            reject(new Error('连接失败'));
          }
        }, 100);
        // 超时
        setTimeout(() => {
          clearInterval(checkConnected);
          if (this.state.value !== ConnectionState.CONNECTED) {
            reject(new Error('等待连接超时'));
          }
        }, 15000);
      });
    }

    const {
      agentId = 'main',
      token = '',
      sessionKey = null,
      onMessage = null,
      onError = null,
      onStateChange = null
    } = options;

    this.agentId = agentId;
    this.authToken = token;
    this.sessionKey = sessionKey;
    this.messageHandler = onMessage;
    this.errorHandler = onError;
    this.stateChangeHandler = onStateChange;

    if (token) {
      adminClient.setToken(token);
    }
    
    // 保存连接选项用于后续重连
    this.lastConnectOptions = options;
    // 新一次连接尝试，重置已失败标志，允许新的 request() 再次排队等待
    this.readyRejected = false;

    // 断开旧连接
    if (this.ws) {
      this.ws.close(1000, 'reconnect');
    }

    // 为新连接生成唯一 ID，用于区分 close 事件
    const thisConnectId = ++this.connectId;
    console.log(`开始连接 #${thisConnectId}`);

    this.closed = false;
    this.setState(ConnectionState.CONNECTING);

    // 获取 WebSocket URL
    if (this._remoteMode && this._remoteUrl) {
      // 远程模式：使用完整的远程 URL（已包含 token 参数）
      this.url = this._remoteUrl;
    } else {
      // 本机模式：连接本地 Gateway
      const gatewayPort = this._gatewayPort;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || '127.0.0.1';
      this.url = `${protocol}//${host}:${gatewayPort}`;
    }

    console.log('连接 WebSocket:', this.url);

    // 加载设备身份
    this.deviceIdentity = await loadOrCreateDeviceIdentity();
    if (this.deviceIdentity) {
      console.log('设备身份已加载:', this.deviceIdentity.deviceId);
    } else {
      console.log('未使用设备身份（检查配置）');
    }

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      const thisId = thisConnectId; // 保存当前连接的 ID
      try {
        this.ws = new WebSocket(this.url);

        const connectTimeout = setTimeout(() => {
          if (this.connectId === thisId) {
            const err = new Error('WebSocket 连接超时');
            reject(err);
          }
        }, 15000);

        this.ws.addEventListener('open', () => {
          console.log(`连接 #${thisId} WebSocket 打开，等待 challenge...`);
          this.logWsMessage('connect', { action: 'open', url: this.url });
        });

        this.ws.addEventListener('message', (event) => {
          this.handleMessage(event, thisId);
        });

        this.ws.addEventListener('close', (event) => {
          clearTimeout(connectTimeout);
          console.log(`连接 #${thisId} WebSocket 关闭:`, event.code, event.reason);
          this.logWsMessage('disconnect', { action: 'close', code: event.code, reason: event.reason });
          this.stopHeartbeat();
          this.setState(ConnectionState.DISCONNECTED);
          
          // 只有当前连接的 close 事件才处理
          if (this.connectId === thisId) {
            if (event.code === 1000) {
              // 正常关闭，停止重连
              console.log(`连接 #${thisId} 正常关闭，停止重连`);
              this.closed = true;
            } else if (event.reason === 'service restart' || event.code === 1012) {
              // 服务重启，稍后重连
              console.log(`连接 #${thisId} 服务重启，稍后重连...`);
              if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => {
                  if (!this.closed && this.lastConnectOptions) {
                    this.connect(this.lastConnectOptions);
                  }
                }, this.reconnectDelay * this.reconnectAttempts);
              } else {
                console.log(`连接 #${thisId} 重连次数已用完，等待服务恢复...`);
                this.readyRejected = true;
              }
            } else {
              // 非正常关闭，尝试重连
              if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`连接 #${thisId} 非正常关闭 (code=${event.code})，尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                setTimeout(() => {
                  if (!this.closed && this.lastConnectOptions) {
                    this.connect(this.lastConnectOptions);
                  }
                }, this.reconnectDelay * this.reconnectAttempts);
              } else {
                console.log(`连接 #${thisId} 重连次数已用完，停止重连`);
                // 标记为永久失败，避免后续 request 永远等
                this.readyRejected = true;
                // 通知外部连接失败
                this.errorHandler?.(new Error('连接失败，重连次数已用完'));
              }
            }
          }
        });

        this.ws.addEventListener('error', (error) => {
          clearTimeout(connectTimeout);
          console.error('WebSocket 错误:', error);
          this.logWsMessage('error', { action: 'error', error: String(error) });
          this.setState(ConnectionState.ERROR);
          
          // 清除待处理的 connect Promise
          if (this.connectReject) {
            this.connectReject(error);
            this.connectResolve = null;
            this.connectReject = null;
          }
          
          this.errorHandler?.(error);
          reject(error);
        });

      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        this.setState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  // 发送 connect 请求
  private async sendConnect(): Promise<void> {
    const clientId = 'openclaw-control-ui';
    const clientVersion = '1.0.0';
    const platform = 'web';
    const clientMode = 'ui';
    const role = 'operator';
    const scopes = ['operator.read', 'operator.write', 'operator.admin', 'operator.pairing'];

    // 构建 auth - 根据认证方式
    const auth: any = {};
    if (this._remoteMode) {
      // 远程模式：根据认证方式发送不同的认证信息
      if (this._remoteAuthMethod === 'token' && this.authToken) {
        auth.token = this.authToken;
      } else if (this._remoteAuthMethod === 'password' && this._remotePassword) {
        auth.password = this._remotePassword;
      }
      // 'none' 模式不发送任何认证信息
    } else {
      // 本机模式：使用 token 认证
      if (this.authToken) {
        auth.token = this.authToken;
      }
    }

    // 构建 device
    let device: any = undefined;
    if (this.deviceIdentity && this.connectNonce) {
      const signedAtMs = Date.now();
      const payload = buildDeviceAuthPayload({
        deviceId: this.deviceIdentity.deviceId,
        clientId,
        clientMode,
        role,
        scopes,
        signedAtMs,
        token: this.authToken || null,
        nonce: this.connectNonce
      });
      
      const signature = await signPayload(this.deviceIdentity.privateKey, payload);
      
      device = {
        id: this.deviceIdentity.deviceId,
        publicKey: this.deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce: this.connectNonce
      };
    }

    const connectParams = {
      minProtocol: 3,
      maxProtocol: 4,
      client: {
        id: clientId,
        version: clientVersion,
        platform,
        mode: clientMode
      },
      role,
      scopes,
      device,
      caps: ['tool-events'],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language
    };

    // console.log('发送 connect 请求:', JSON.stringify(connectParams, null, 2));

    const frameId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    this.send({
      type: 'req',
      id: frameId,
      method: 'connect',
      params: connectParams
    });
  }

  // 处理消息
  private handleMessage(event: MessageEvent, thisId: number) {
    try {
      const data = JSON.parse(event.data as string);
      // 记录接收到的消息
      this.logWsMessage('receive', data);

      // 打印 agent/chat 事件的完整结构用于调试思考内容字段
      if (data.type === 'event' && (data.event === 'agent' || data.event === 'chat')) {
        console.info('[WS-RAW]', data.event, 'stream:', data.payload?.stream, 'state:', data.payload?.state,
          'keys:', JSON.stringify(Object.keys(data.payload || {})));
        console.info('[WS-RAW-FULL]', JSON.stringify(data).substring(0, 2000));
      }

      // 注释掉详细日志，避免刷屏
      // console.log('WebSocket 收到消息:', JSON.stringify(data, null, 2));

      // 处理 connect.challenge - 收到后发送 connect 请求
      if (data.type === 'event' && data.event === 'connect.challenge') {
        this.connectNonce = data.payload?.nonce || '';
        // 收到 challenge 后发送 connect
        this.sendConnect().then(() => {
          // 连接成功，Promise 会在收到 hello-ok 时 resolve
        }).catch((err) => {
          // 连接失败
          console.error('Connect 失败:', err);
        });
        return;
      }

      // 处理 hello-ok
      if (data.type === 'res' && data.ok && data.payload?.type === 'hello-ok') {
        // console.log('握手成功!');
        this.reconnectAttempts = 0;
        this.setState(ConnectionState.CONNECTED);
        this.startHeartbeat();
        if (this.connectId === thisId) {
          this.connectResolve?.();
          this.connectResolve = null;
          this.connectReject = null;
        }
        return;
      }

      // 处理错误响应
      if (data.type === 'res' && !data.ok) {
        console.error('收到错误响应:', data.error);
        
        // 如果是 connect 错误，拒绝 Promise
        if (data.id?.includes('connect')) {
          this.connectReject?.(data.error);
          this.connectResolve = null;
          this.connectReject = null;
        }
        
        // 处理 pending request 的错误
        if (data.id && this.pendingRequests.has(data.id)) {
          const { reject } = this.pendingRequests.get(data.id)!;
          this.pendingRequests.delete(data.id);
          reject(data.error);
        }
        
        this.errorHandler?.(data.error);
        
        // 如果是 connect 错误，关闭连接
        if (data.id?.includes('connect')) {
          this.ws?.close(4008, 'connect failed');
        }
        return;
      }
      
      // 处理成功响应
      if (data.type === 'res' && data.ok) {
        // 如果是 connect 成功，已在 hello-ok 处理
        if (data.id?.includes('connect')) {
          // 已处理
        } else if (data.id && this.pendingRequests.has(data.id)) {
          // 处理 pending request 的成功响应
          const { resolve } = this.pendingRequests.get(data.id)!;
          this.pendingRequests.delete(data.id);
          resolve(data.payload);
        }
        // 广播给订阅者
        this._msgSeq++;
        console.debug(`[WS->] #${this._msgSeq} type=${data.type} id=${data.id || '-'}`);
        this._subscribers.forEach(fn => fn(data));
        return;
      }

      // 处理聊天响应事件
      if (data.type === 'event' && data.event === 'chat') {
        this.messageHandler?.(data);
        this._msgSeq++;
        console.debug(`[WS->] #${this._msgSeq} id=${data.id || data.seq || '-'} type=${data.type} event=${data.event}`);
        this._subscribers.forEach(fn => fn(data));
        return;
      }

      // 处理其他事件
      if (data.type === 'event') {
        this.messageHandler?.(data);
        this._msgSeq++;
        console.debug(`[WS->] #${this._msgSeq} id=${data.id || data.seq || '-'} type=${data.type} event=${data.event}`);
        this._subscribers.forEach(fn => fn(data));
      }

    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  // WebSocket 通信日志（记录所有消息）
  private logWsMessage(direction: 'send' | 'receive', data: any) {
    try {
      // 尝试解析原始数据（如果是字符串）
      let msgObj = data;
      if (typeof data === 'string') {
        try {
          msgObj = JSON.parse(data);
        } catch (e) {
          msgObj = { raw: data };
        }
      }
      // 记录所有消息（包括 ping/pong 等内部消息）
      if (window.electronAPI?.writeWsLog) {
        systemApi.writeWsLog({ direction, data: msgObj }).catch(() => {});
      }
    } catch (e) {
      console.warn('[logWsMessage] 日志写入失败:', e.message);
    }
  }

  // 发送消息
  send(message: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const jsonStr = JSON.stringify(message);
      // 记录发送的请求
      this.logWsMessage('send', message);
      this.ws.send(jsonStr);
      return true;
    } else {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }
  }

  // 当前是否真正可用（state 与底层 ws.readyState 一致）
  isReady(): boolean {
    return this.state.value === ConnectionState.CONNECTED
      && !!this.ws
      && this.ws.readyState === WebSocket.OPEN;
  }

  // 发送聊天消息
  sendChat(content: string, sessionKey?: string | null) {
    const chatRequest = {
      type: 'req',
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      method: 'chat.send',
      params: {
        sessionKey: sessionKey ?? this.sessionKey,
        message: content,  // message 是字符串，不是对象
        idempotencyKey: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }
    };

    // console.log('发送聊天请求:', JSON.stringify(chatRequest, null, 2));
    this.send(chatRequest);
  }

  // 发送 directive
  // 发送会话配置更新（替代旧的 directive 方式）
  updateSession(sessionKey: string, updates: {
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
  }) {
    const request = {
      type: 'req',
      id: `patch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      method: 'sessions.patch',
      params: {
        key: sessionKey,
        ...updates
      }
    };
    // console.log('发送 sessions.patch:', JSON.stringify(request, null, 2));
    this.send(request);
  }

  // 获取会话列表（WS：sessions.list 不在 admin-http-rpc 允许列表中）
  async listSessions(): Promise<any> {
    return this.request('sessions.list', {});
  }

  // 获取单个会话（WS）
  async getSession(sessionKey: string): Promise<any> {
    return this.request('sessions.get', { key: sessionKey });
  }

  // 获取智能体列表
  async listAgents(): Promise<any> {
    return this.request('agents.list', {});
  }

  // 获取模型列表
  async listModels(): Promise<any> {
    return this.request('models.list', {});
  }

  // 获取聊天记录
  async getChatHistory(sessionKey: string, limit: number = 50): Promise<any> {
    return this.request('chat.history', { sessionKey, limit });
  }

  // 删除会话
  async deleteSession(sessionKey: string): Promise<any> {
    return this.request('sessions.delete', { key: sessionKey });
  }

  // 订阅 WebSocket 消息（支持多个视图同时监听）
  subscribe(callback: (data: any) => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  // 等待连接就绪（用于在未连接时自动等待）
  whenReady(timeoutMs: number = 15000): Promise<void> {
    if (this.state.value === ConnectionState.CONNECTED) {
      return Promise.resolve();
    }
    if (this.readyRejected) {
      return Promise.reject(new Error('WebSocket 连接已失败'));
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: 0 as number
      };
      waiter.timer = window.setTimeout(() => {
        const idx = this.readyWaiters.indexOf(waiter);
        if (idx >= 0) this.readyWaiters.splice(idx, 1);
        reject(new Error('WS 等待就绪超时'));
      }, timeoutMs);
      this.readyWaiters.push(waiter);
    });
  }

  // 发送请求并等待响应（未连接时自动等待连接就绪）
  request(method: string, params: any = {}, options: { waitTimeoutMs?: number } = {}): Promise<any> {
    // 双重检查：state 与 ws.readyState 都必须是可用状态，否则走 whenReady
    if (this.isReady()) {
      return this._doRequest(method, params);
    }
    // 如果看起来在连接中（state CONNECTING 且 ws 真的在握手中），就直接等
    if (this.state.value === ConnectionState.CONNECTING && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.whenReady(options.waitTimeoutMs ?? 15000).then(() => this._doRequest(method, params));
    }
    // state DISCONNECTED/ERROR 且没有正在连接 → 主动触发一次 connect，再等就绪
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      // 防止并发 connect
      if (!this.connectingPromise) {
        console.log(`[wsManager] request 时未连接，自动触发 connect (method=${method})`);
        this.connectingPromise = this.connect(this.lastConnectOptions || { agentId: this.agentId, token: this.authToken, sessionKey: this.sessionKey })
          .catch((err) => { this.connectingPromise = null; throw err; });
        this.connectingPromise.finally(() => { this.connectingPromise = null; });
      }
    }
    return this.whenReady(options.waitTimeoutMs ?? 15000).then(() => this._doRequest(method, params));
  }

  // 实际执行请求（假设已连接）
  private _doRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      // 再次确认 ws 真的可用（避免 isReady 通过但底层 ws 已关闭的极端竞态）
      if (!this.isReady()) {
        reject(new Error('WebSocket 未连接（ready 检查未通过）'));
        return;
      }
      const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const request = {
        type: 'req',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      if (!this.send(request)) {
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket 未连接'));
        return;
      }

      // 超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`请求 ${method} 超时`));
        }
      }, 30000);
    });
  }

  // 设置连接状态
  private setState(newState: string) {
    this.state.value = newState;
    this.stateChangeHandler?.(newState);

    if (newState === ConnectionState.CONNECTED) {
      // 连接就绪：flush 所有等待者
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach(w => { clearTimeout(w.timer); w.resolve(); });
    } else if (newState === ConnectionState.DISCONNECTED) {
      // 断线：reject 所有等待者（标记为已断开，但不锁死，新一次 connect 会重置）
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach(w => { clearTimeout(w.timer); w.reject(new Error('WebSocket 已断开')); });
    }
  }

  // 开始心跳 - 暂时禁用，因为 ping 帧格式可能不对
  private startHeartbeat() {
    this.stopHeartbeat();
    // 心跳暂时禁用
    // this.heartbeatTimer = window.setInterval(() => {
    //   if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    //     this.send({ type: 'ping' });
    //   }
    // }, 15000);
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 断开连接
  disconnect(code: number = 1000) {
    this.closed = true;
    this.stopHeartbeat();

    // 立即拒绝所有等待连接就绪的请求
    if (this.readyWaiters.length) {
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach(w => { clearTimeout(w.timer); w.reject(new Error('WebSocket 已断开')); });
    }

    // 清除 Gateway 状态检查定时器
    if (this.gatewayStatusCheckInterval) {
      window.clearInterval(this.gatewayStatusCheckInterval);
      this.gatewayStatusCheckInterval = null;
    }

    if (this.ws) {
      this.ws.close(code, 'disconnect');
      this.ws = null;
    }
    this.setState(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 导出单例
export const wsManager = new WebSocketManager();

// 初始化 Gateway 状态监听
wsManager.setupGatewayStatusListener();

export default wsManager;
