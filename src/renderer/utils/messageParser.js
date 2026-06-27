// 消息内容解析工具
// 支持 Markdown、代码高亮、JSON 格式化等
// 关键设计：只有当内容是纯代码/JSON块时才格式化，否则直接作为 Markdown 渲染

import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// 初始化 markdown-it 并配置代码高亮和表格样式
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    // 如果有语言标识，使用 highlight.js 高亮
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs code-block"><code>` +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               `</code></pre>`;
      } catch (__) {}
    }
    // 默认情况
    return `<pre class="hljs code-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  }
}).use(function(md) {
  // 为表格添加边框样式
  md.renderer.rules.table_open = function(tokens, idx, options, env, self) {
    return '<table class="md-table">';
  };
  
  // 重写链接渲染，添加外部链接标记
  const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    const aIndex = idx;
    const hrefIndex = tokens[idx].attrIndex('href');
    const href = hrefIndex >= 0 ? tokens[idx].attrs[hrefIndex][1] : '';
    
    // 给外部链接添加 external-link class 和图标
    if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
      tokens[idx].attrPush(['class', 'external-link']);
      tokens[idx].attrPush(['target', '_blank']);
    }
    
    // 渲染链接 token
    let result = defaultRender(tokens, idx, options, env, self);
    
    // 在链接文本后添加外部图标（仅外部链接）
    if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
      result = result.replace('</a>', '<span class="external-icon">↗</span></a>');
    }
    
    return result;
  };
});

/**
 * 解析消息内容
 * 
 * 策略：
 * 1. 如果内容完全是代码块（``` 包裹），解析为代码
 * 2. 如果内容完全是 JSON（以 { 或 [ 开头和结尾），格式化 JSON
 * 3. 否则直接作为 Markdown 渲染（markdown-it 会正确处理内部的代码块）
 * 
 * @param {string} content - 原始消息内容
 * @returns {object} - { type, content, html }
 */
export const parseMessageContent = (content) => {
  if (!content) return { type: 'text', content: '', html: '' };
  
  // 确保 content 是字符串
  if (typeof content !== 'string') {
    content = String(content);
  }
  
  const trimmed = content.trim();
  
  // 情况1：检测是否是完全被 ``` 包裹的代码块
  // 匹配 ```language\n...\n``` 或 ```\n...\n```
  const fencedCodeMatch = trimmed.match(/^```(\w*)\n([\s\S]*?)\n```$/);
  if (fencedCodeMatch) {
    const language = fencedCodeMatch[1] || 'plaintext';
    const code = fencedCodeMatch[2];
    
    // 如果是 JSON 格式的代码块，格式化显示
    if (language === 'json' || language === '') {
      try {
        const parsed = JSON.parse(code);
        return {
          type: 'json',
          content: code,
          formatted: JSON.stringify(parsed, null, 2),
          html: md.render('```json\n' + JSON.stringify(parsed, null, 2) + '\n```')
        };
      } catch (e) {
        // 不是 JSON，继续作为普通代码处理
      }
    }
    
    return {
      type: 'code',
      language: language,
      content: code,
      html: md.render('```' + language + '\n' + code + '\n```')
    };
  }
  
  // 情况2：检测是否是纯 JSON（没有代码块标记，但整个内容是 JSON）
  // 只有当内容以 { 或 [ 开头和结尾时才认为是 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        type: 'json',
        content: trimmed,
        formatted: JSON.stringify(parsed, null, 2),
        html: md.render('```json\n' + JSON.stringify(parsed, null, 2) + '\n```')
      };
    } catch (e) {
      // 不是有效的 JSON，继续作为 Markdown 处理
    }
  }
  
  // 情况3：普通文本/混合内容 - 直接作为 Markdown 渲染
  // markdown-it 会正确处理内部的代码块、列表等
  return {
    type: 'markdown',
    content: trimmed,
    html: md.render(trimmed)
  };
};

/**
 * 解析 content 数组，提取纯文本
 * @param {array} content - 内容数组
 * @returns {string} - 纯文本内容
 */
export const extractTextFromContent = (content) => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('');
  }
  return String(content);
};

/**
 * 获取 content 数组中的主要文本内容
 * @param {array} content - 内容数组
 * @returns {string} - 纯文本内容
 */
export const getTextContentFromContent = (content) => {
  return extractTextFromContent(content);
};

/**
 * 解析 assistant 消息的 content 数组，提取思考内容和工具调用
 * @param {array} content - assistant 消息的 content 数组
 * @returns {object} - { thinkingItems, toolCallItems }
 */
export const parseAssistantContent = (content) => {
  if (!Array.isArray(content)) {
    return { thinkingItems: [], toolCallItems: [] };
  }

  const thinkingItems = [];
  const toolCallItems = [];

  for (const item of content) {
    if (item.type === 'thinking') {
      thinkingItems.push({
        type: 'thinking',
        content: item.thinking || '',
        raw: item
      });
    } else if (item.type === 'toolCall') {
      toolCallItems.push({
        type: 'toolCall',
        id: item.id,
        name: item.name,
        arguments: item.arguments,
        raw: item
      });
    }
  }

  return { thinkingItems, toolCallItems };
};

// 获取内容类型的显示标签
export const getContentTypeLabel = (type) => {
  const labels = {
    'json': 'JSON',
    'code': '代码',
    'sql': 'SQL',
    'multiline-code': '代码块',
    'markdown': '文本'
  };
  return labels[type] || '文本';
};

// 复制内容到剪贴板
export const copyToClipboard = async (content) => {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};
