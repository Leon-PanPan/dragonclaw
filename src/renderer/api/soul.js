/**
 * Soul 智能体市场 API
 *
 * 对接 clawc 后端接口，提供 soul 列表和详情查询。
 * 使用 fileApi.fetch 通过 IPC 解决跨域问题。
 */
import { fileApi, systemApi } from '@/api/gateway';
import rootConfig from '@shared/config';

const BASE_URL = rootConfig.clawc?.domain || 'http://api.dragonclaw.cc/';

/**
 * 获取 machine_id 的默认值（异步）。
 * 在 Electron 环境中通过 electronAPI.getMachineId() 获取。
 */
async function defaultMachineId() {
  try {
    return await systemApi.machineId() || '';
  } catch {
    return '';
  }
}

/**
 * 构造请求 URL，拼接 query 参数。
 */
function buildUrl(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${BASE_URL}${path}?${query}` : `${BASE_URL}${path}`;
}

/**
 * 通用请求封装。
 * - 成功时直接返回后端的 data 字段 ({ categories, souls } | 详情对象)。
 * - 失败时返回 { status, message, data: null }。
 */
async function request(path, params = {}) {
  const url = buildUrl(path, params);
  try {
    const result = await fileApi.fetch({ url, method: 'GET' });

    // 主进程返回 { success: false, error: '...' } 时直接透传错误
    if (result.success === false) {
      return { status: 500, message: result.error || '请求失败', data: null };
    }

    // 无响应体时直接返回错误
    if (result.data === undefined || result.data === null || result.data === '') {
      return { status: 500, message: '后端无响应', data: null };
    }

    let body;
    try {
      body = JSON.parse(result.data);
    } catch {
      // JSON 解析失败时带上原始内容前 200 字符方便排查
      const preview = String(result.data).substring(0, 200);
      return { status: 500, message: `响应解析失败: ${preview}`, data: null };
    }

    if (body.status === 200 && body.data != null) {
      return body.data;
    }
    return { status: body.status || 500, message: body.message || '未知错误', data: null };
  } catch (err) {
    return { status: 500, message: err.message || '网络错误', data: null };
  }
}

export const soulApi = {
  /**
   * 获取 soul 列表。
   * @param {Object} opts
   * @param {string} [opts.category] - 分类过滤，不传返回全部。
   * @param {string} [opts.machine_id] - 机器标识，不传自动获取。
   * @param {string} [opts.language] - 语言，默认 zh-CN。
   * @returns {Promise<{ categories: string[], souls: object[] } | { status, message, data: null }>}
   */
  async list({ category = '', machine_id, language = 'zh-CN' } = {}) {
    const mid = machine_id !== undefined ? machine_id : await defaultMachineId();
    const params = { language };
    if (category) params.category = category;
    if (mid) params.machine_id = mid;
    return request('/base/api/addons/clawc/soul/list', params);
  },

  /**
   * 获取 soul 详情。
   * @param {Object} opts
   * @param {number|string} opts.id - soul ID。
   * @param {string} [opts.machine_id] - 机器标识，不传自动获取。
   * @param {string} [opts.language] - 语言，默认 zh-CN。
   * @returns {Promise<object | { status, message, data: null }>}
   */
  async detail({ id, machine_id, language = 'zh-CN' } = {}) {
    if (id === undefined || id === null) {
      return { status: 400, message: '缺少 id 参数', data: null };
    }
    const mid = machine_id !== undefined ? machine_id : await defaultMachineId();
    const params = { id, language };
    if (mid) params.machine_id = mid;
    return request('/base/api/addons/clawc/soul/detail', params);
  },
};
