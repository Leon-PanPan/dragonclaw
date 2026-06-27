/**
 * 推荐提供商 + 特殊提供商（不在 models.dev 中的兜底）
 */

// 推荐顺序（在下拉中置顶）
export const RECOMMENDED = [
  'modelbus','openai', 'deepseek', 'anthropic', 'grok',
  'openrouter', 'minimax', 'groq',
  'xai', 
  'moonshot', 'alibaba', 
  'ollama', 'custom',
];

// models.dev 中不存在的特殊提供商
export const EXTRA_PROVIDERS = {
  ollama:   { id: 'ollama',   name: 'Ollama',          baseUrl: 'http://127.0.0.1:11434/v1',    api: 'openai-completions' },
  modelbus: { id: 'modelbus', name: 'ModelBus',        baseUrl: 'https://api.modelbus.cc',      api: 'openai-completions' },
  custom:   { id: 'custom',   name: '自定义',           baseUrl: '',                              api: 'openai-completions' },
};

/**
 * 获取提供商显示名称
 */
export function getProviderName(id, catalog) {
  const extra = EXTRA_PROVIDERS[id];
  if (extra) return extra.name;
  return catalog?.[id]?.name || id;
}

/**
 * 获取提供商显示名称（同步，无 catalog 时 fallback）
 */
export function getProviderNameSync(id, catalog) {
  const extra = EXTRA_PROVIDERS[id];
  if (extra) return extra.name;
  if (catalog?.[id]?.name) return catalog[id].name;

  // 无 catalog 时的硬编码 fallback
  const fallbackMap = {
    openai: 'OpenAI', deepseek: 'DeepSeek', google: 'Google Gemini', anthropic: 'Anthropic',
    grok: 'Grok', openrouter: 'OpenRouter', github: 'GitHub Copilot', minimax: 'MiniMax',
    mistral: 'Mistral', groq: 'Groq', xai: 'xAI (Grok)', perplexity: 'Perplexity',
    together: 'Together AI', cohere: 'Cohere', cerebras: 'Cerebras', deepinfra: 'DeepInfra',
    moonshot: 'Moonshot AI', alibaba: '阿里云百炼', nvidia: 'NVIDIA NIM', venice: 'Venice AI',
    synthetic: 'Synthetic',
  };
  return fallbackMap[id] || id;
}

/**
 * 获取提供商 baseUrl（非 models.dev 提供商）
 */
export function getExtraBaseUrl(id) {
  return EXTRA_PROVIDERS[id]?.baseUrl || '';
}
