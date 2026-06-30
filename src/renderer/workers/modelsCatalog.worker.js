/**
 * models.dev catalog Web Worker
 *
 * 在 Worker 线程里执行 2.3MB JSON.parse，避开渲染主线程卡顿。
 * 同时只投影需要的字段（id/name/api/limit/reasoning/tool_call/attachment/reasoning_options），
 * 丢弃 family / cost / modalities 等冗余数据，使 catalog 内存占用降低 ~80%。
 *
 * 通信协议:
 *   主 → worker:  { type: 'parse', content: string }
 *   worker → 主:  { type: 'parsed', catalog: SlimCatalog, elapsedMs: number }
 *                  { type: 'error', error: string }
 *
 * Slim catalog 与原 catalog 的字段名一致（id/name/api/models），便于上层零改动兼容：
 *   resolveContextWindow / resolveReasoning / listProviderModels / lookupModel 等
 *   只读 .limit / .reasoning / .tool_call / .attachment / .models，照常工作。
 */

const KEEP_MODEL_KEYS = [
  'id', 'name',
  'attachment', 'reasoning', 'reasoning_options', 'tool_call',
  'limit',
];

function slimModel(m) {
  if (!m || typeof m !== 'object' || !m.id || !m.name) return null;
  const sm = {};
  for (const k of KEEP_MODEL_KEYS) {
    if (m[k] !== undefined) sm[k] = m[k];
  }
  // 兼容：原 catalog 把 context/output 放在 m.limit.{context,output}
  if (sm.limit && typeof sm.limit === 'object') {
    sm.limit = {
      context: typeof sm.limit.context === 'number' ? sm.limit.context : 0,
      output: typeof sm.limit.output === 'number' ? sm.limit.output : 0,
    };
  } else {
    sm.limit = { context: 0, output: 0 };
  }
  return sm;
}

function slimProvider(p) {
  if (!p || typeof p !== 'object' || !p.id || !p.name) return null;
  const models = {};
  if (p.models && typeof p.models === 'object') {
    for (const [mid, m] of Object.entries(p.models)) {
      const sm = slimModel(m);
      if (sm) models[mid] = sm;
    }
  }
  return {
    id: p.id,
    name: p.name,
    api: typeof p.api === 'string' ? p.api : '',
    models,
  };
}

function parseAndProject(content) {
  const raw = JSON.parse(content);
  const catalog = {};
  for (const [pid, p] of Object.entries(raw)) {
    const sp = slimProvider(p);
    if (sp) catalog[pid] = sp;
  }
  return catalog;
}

self.onmessage = (e) => {
  const data = e.data || {};
  if (data.type !== 'parse') {
    self.postMessage({ type: 'error', error: 'unknown message type' });
    return;
  }
  const start = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
  try {
    const catalog = parseAndProject(data.content);
    const elapsed = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() - start
      : (Date.now() - start);
    self.postMessage({ type: 'parsed', catalog, elapsedMs: elapsed });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err && err.message ? err.message : String(err),
    });
  }
};

export {};
