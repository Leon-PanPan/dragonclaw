/**
 * models.dev 模型目录服务
 *
 * 数据源: https://models.dev/api.json
 * 缓存文件: ~/.dragonclaw/models-dev.json
 * TTL: 24 小时
 *
 * 回退链: 网络 fetch → 本地缓存文件 → 静态嵌入 JSON（无网络兜底）
 *
 * API 返回格式: Record<string, Provider>
 *   Provider: { id, name, api, models: Record<string, Model> }
 *   Model: { id, name, limit: { context, output }, ... }
 */
import { fileApi } from '@/api/gateway';

const CACHE_FILE = 'models-dev.json';
const API_URL = 'https://models.dev/api.json';
const TTL_MS = 24 * 60 * 60 * 1000;

let _catalog = null;
let _pending = null;
let _fallback = null;

async function loadFallback() {
  if (!_fallback) {
    try {
      _fallback = (await import('./models-dev-fallback.json')).default;
    } catch {
      _fallback = {};
    }
  }
  return _fallback;
}

/**
 * 确保模型目录已加载并缓存
 * - 从内存返回（若有）
 * - 从本地缓存文件读（若未过期）
 * - fetch API 并写缓存
 * - 网络不可用 + 无缓存 → 用静态嵌入 JSON 兜底
 */
export async function ensureCatalog() {
  if (_catalog) return _catalog;
  if (_pending) return _pending;

  _pending = (async () => {
    try {
      // 1. 读本地缓存
      let cached = null;
      let mtime = 0;
      try {
        const mtimeResult = await fileApi.mtime({ filename: CACHE_FILE });
        if (mtimeResult?.success) mtime = mtimeResult.mtime;

        const readResult = await fileApi.read({ filename: CACHE_FILE });
        if (readResult?.success && readResult.content) {
          cached = JSON.parse(readResult.content);
        }
      } catch { /* 无缓存或读取失败 */ }

      const now = Date.now();
      if (cached && (now - mtime) < TTL_MS) {
        _catalog = cached;
        return _catalog;
      }

      // 2. fetch 最新数据
      console.log('[models.dev] 拉取最新模型目录...');
      const fetchResult = await fileApi.fetch({ url: API_URL, method: 'GET' });
      if (!fetchResult?.success) {
        if (cached) {
          console.warn('[models.dev] 拉取失败，用旧缓存');
          _catalog = cached;
          return _catalog;
        }
        // 无网络 + 无缓存 → 加载静态嵌入 JSON
        console.warn('[models.dev] 无网络，使用静态托底');
        _catalog = await loadFallback();
        return _catalog;
      }

      const raw = typeof fetchResult.data === 'string'
        ? fetchResult.data
        : JSON.stringify(fetchResult.data);
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // 3. 写本地缓存
      try {
        await fileApi.write({ filename: CACHE_FILE, content: JSON.stringify(data) });
      } catch (e) {
        console.warn('[models.dev] 写缓存失败:', e.message);
      }

      _catalog = data;
      console.log('[models.dev] 缓存已更新, providers:', Object.keys(data).length);
      return _catalog;
    } catch (e) {
      console.error('[models.dev] 加载失败:', e.message);
      // 终极兜底
      _catalog = await loadFallback();
      return _catalog;
    } finally {
      _pending = null;
    }
  })();

  return _pending;
}

/**
 * 从 catalog 中解析 contextWindow
 * 优先级: catalog limit.context → 模型自带值 → 终极兜底 32768
 */
export function resolveContextWindow(catalog, providerId, modelId, fallback) {
  const ctx = catalog?.[providerId]?.models?.[modelId]?.limit?.context;
  return ctx || fallback || 32768;
}

/**
 * 查询单个模型的上下文窗口
 * @returns {{ contextWindow: number, maxTokens: number } | null}
 */
export function lookupModel(catalog, providerId, modelId) {
  const provider = catalog?.[providerId];
  if (!provider?.models) return null;
  const model = provider.models[modelId];
  if (!model?.limit) return null;
  return {
    contextWindow: model.limit.context ?? 0,
    maxTokens: model.limit.output ?? 0,
  };
}

/**
 * 获取指定提供商下所有模型列表
 * @returns {Array<{ id, name, contextWindow, maxTokens }>}
 */
export function listProviderModels(catalog, providerId) {
  const provider = catalog?.[providerId];
  if (!provider?.models) return [];
  return Object.values(provider.models)
    .filter(m => m.id && m.name)
    .map(m => ({
      id: m.id,
      name: m.name,
      contextWindow: m.limit?.context ?? 0,
      maxTokens: m.limit?.output ?? 0,
    }));
}

/**
 * 在 catalog 中精确查找模型（provider + modelId 精确匹配）
 */
function findModelInCatalog(catalog, providerId, modelId) {
  if (!catalog || !providerId || !modelId) return null;
  return catalog[providerId]?.models?.[modelId] ?? null;
}

/**
 * 从 catalog 中解析模型是否支持推理
 * @returns {boolean | null}
 */
export function resolveReasoning(catalog, providerId, modelId) {
  return findModelInCatalog(catalog, providerId, modelId)?.reasoning ?? null;
}

/**
 * 从 catalog 中解析模型的推理选项配置
 * @returns {Array | null} reasoning_options 数组或 null
 */
export function resolveReasoningOptions(catalog, providerId, modelId) {
  return findModelInCatalog(catalog, providerId, modelId)?.reasoning_options ?? null;
}

/**
 * 获取缓存的模型目录（不触发拉取）
 */
export function getCatalog() {
  return _catalog;
}

/**
 * 强制刷新模型目录
 */
export async function refreshCatalog() {
  _catalog = null;
  _pending = null;
  return ensureCatalog();
}
