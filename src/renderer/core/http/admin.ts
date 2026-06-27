/**
 * AdminRpcClient — Gateway HTTP Admin RPC 客户端（单例）
 *
 * 通过 POST /api/v1/admin/rpc 调用 Gateway 管理面方法。
 * 对应协议: https://docs.openclaw.ai/plugins/admin-http-rpc
 *
 * 使用方式:
 *   import { adminClient } from '@/core/http/admin'
 *   adminClient.configure({ port: 18789, token: 'xxx' })
 *   await adminClient.request('health')
 *   await adminClient.request('config.get')
 */

import { fileApi } from '@/api/gateway'

const DEFAULT_PORT = 18789
const DEFAULT_HOST = '127.0.0.1'
const RPC_PATH = '/api/v1/admin/rpc'
const REQUEST_TIMEOUT_MS = 30_000

export class AdminRpcClient {
  private baseUrl: string = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
  private authToken: string = ''

  configure(options: { host?: string; port?: number; token?: string }) {
    const host = options.host || DEFAULT_HOST
    const port = options.port ?? DEFAULT_PORT
    this.baseUrl = `http://${host}:${port}`
    if (options.token !== undefined) {
      this.authToken = options.token
    }
    console.info(`[admin-rpc] 配置: ${this.baseUrl}${RPC_PATH} token=${this.authToken ? '***' : '(无)'}`)
  }

  setToken(token: string) {
    this.authToken = token
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  async request(method: string, params: any = {}): Promise<any> {
    const id = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const body = {
      id,
      method,
      params,
    }

    const url = `${this.baseUrl}${RPC_PATH}`

    const startTime = performance.now()
    console.info(`[admin-rpc] >>> ${method}`, JSON.stringify(params))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const result = await fileApi.fetch({
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const elapsed = Math.round(performance.now() - startTime)

      if (!result || typeof result !== 'object') {
        console.error(`[admin-rpc] <<< ${method} 空响应 (${elapsed}ms)`)
        throw new Error(`[admin-rpc] 响应为空`)
      }

      const status = result.status
      let rawData = result.data

      let data: any = null;
      if (typeof rawData === 'string') {
        try { data = JSON.parse(rawData); } catch (e) {
          console.error(`[admin-rpc] <<< ${method} JSON解析失败 (${elapsed}ms):`, rawData?.substring?.(0, 200))
          throw new Error(`[admin-rpc] 响应不是有效JSON`)
        }
      } else {
        data = rawData
      }

      if (status >= 200 && status < 300) {
        if (data && data.ok === true) {
          console.info(`[admin-rpc] <<< ${method} OK (${elapsed}ms)`)
          return data.payload
        }
        if (data && data.ok === false) {
          const errCode = data.error?.code || 'UNKNOWN_ERROR'
          const errMsg = data.error?.message || '请求失败'
          console.error(`[admin-rpc] <<< ${method} FAIL [${errCode}] ${errMsg} (${elapsed}ms)`)
          throw new Error(`[${errCode}] ${errMsg}`)
        }
        console.info(`[admin-rpc] <<< ${method} ${JSON.stringify(data)} (${elapsed}ms)`)
        return data
      }

      console.error(`[admin-rpc] <<< ${method} HTTP ${status} (${elapsed}ms):`, JSON.stringify(data))
      throw new Error(`[admin-rpc] HTTP ${status}: ${JSON.stringify(data)}`)
    } catch (error: any) {
      clearTimeout(timeoutId)
      const elapsed = Math.round(performance.now() - startTime)
      if (error.name === 'AbortError') {
        console.error(`[admin-rpc] <<< ${method} 超时 (${elapsed}ms)`)
        throw new Error(`[admin-rpc] 请求超时 (${REQUEST_TIMEOUT_MS / 1000}s): ${method}`)
      }
      if (error.message?.startsWith('[admin-rpc]')) {
        throw error
      }
      console.error(`[admin-rpc] <<< ${method} 网络错误 (${elapsed}ms):`, error.message || error)
      throw new Error(`[admin-rpc] 网络错误: ${error.message || error}`)
    }
  }
}

export const adminClient = new AdminRpcClient()
