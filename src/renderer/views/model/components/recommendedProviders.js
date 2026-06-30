/**
 * 推荐提供商 + 特殊提供商（不在 models.dev 中的兜底）
 */

// API 协议类型（受 OpenClaw `MODEL_APIS` 枚举收敛，UI 仅暴露常用四项）
//   来源: openclaw/dist/plugin-sdk/config/types.models.d.ts:2
//   完整枚举: openai-completions | openai-responses | openai-codex-responses
//             | anthropic-messages | google-generative-ai | github-copilot
//             | bedrock-converse-stream | ollama
//   UI 仅暴露 4 种：openai-completions / openai-responses / anthropic-messages / google-generative-ai
export const API_OPTIONS = [
  { value: 'openai-completions',   label: 'OpenAI Completions' },
  { value: 'openai-responses',     label: 'OpenAI Responses' },
  { value: 'anthropic-messages',   label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
];

export const DEFAULT_API = 'openai-completions';

// 推荐顺序（在下拉中置顶）
export const RECOMMENDED = [
  'deepseek', "zhipuai",'minimax', 'modelbus',
  'moonshotai', "stepfun",
  'moonshot', 'alibaba-cn',
  'ollama', 'openai', 'anthropic',
  'openrouter','custom',
];

// models.dev 中不存在的特殊提供商
export const EXTRA_PROVIDERS = {
  ollama:   { id: 'ollama',   name: 'Ollama',          baseUrl: 'http://127.0.0.1:11434/v1',    api: 'openai-completions' },
  modelbus: { id: 'modelbus', name: 'ModelBus',        baseUrl: 'https://api.modelbus.cc',      api: 'openai-completions' },
  custom:   { id: 'custom',   name: '自定义',           baseUrl: '',                              api: 'openai-completions' },
};

// 根据 provider id 推断默认 api 协议
const KNOWN_API_BY_PROVIDER = {
  anthropic: 'anthropic-messages',
  google: 'google-generative-ai',
  ollama: 'openai-completions',
  openai: 'openai-completions',
  openrouter: 'openai-completions',
  deepseek: 'openai-completions',
  moonshot: 'openai-completions',
  moonshotai: 'openai-completions',
  zhipuai: 'openai-completions',
  zai: 'openai-completions',
  'github-copilot': 'openai-completions',
  minimax: 'anthropic-messages',
  'minimax-cn': 'anthropic-messages',
  minimax_cn: 'anthropic-messages',
  synthetic: 'anthropic-messages',
  alibaba: 'openai-completions',
  'alibaba-cn': 'openai-completions',
};

/**
 * 智能推断 provider 默认 api 协议
 *  1. EXTRA_PROVIDERS 里有 → 直接用
 *  2. KNOWN_API_BY_PROVIDER 里有 → 用预设
 *  3. catalog 中 models.dev provider.models 的 baseUrl 包含 'anthropic' 关键字 → anthropic-messages
 *  4. 默认 → openai-completions
 */
export function guessProviderApi(providerId, catalog) {
  if (!providerId) return DEFAULT_API;
  const extra = EXTRA_PROVIDERS[providerId];
  if (extra?.api) return extra.api;
  if (KNOWN_API_BY_PROVIDER[providerId]) return KNOWN_API_BY_PROVIDER[providerId];
  const url = catalog?.[providerId]?.api || '';
  if (typeof url === 'string' && url.includes('anthropic')) return 'anthropic-messages';
  return DEFAULT_API;
}

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
