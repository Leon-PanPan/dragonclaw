// 工具调用抽屉展示格式化工具
// 职责：根据工具名与参数生成「执行指令」摘要，根据结果内容按类型渲染「执行结果」

import hljs from 'highlight.js'

const escapeHtml = (str) => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const parseArgs = (args) => {
  if (!args) return null
  if (typeof args === 'string') {
    try {
      return JSON.parse(args)
    } catch (e) {
      return args
    }
  }
  if (typeof args === 'object') return args
  return null
}

// 命令类工具：包含 command/cmd 字段，可视为「执行指令」
const COMMAND_TOOLS = new Set(['exec', 'bash', 'powershell', 'pwsh', 'run', 'shell', 'cmd', 'sh', 'zsh', 'process'])

export const isCommandTool = (toolName) => COMMAND_TOOLS.has(toolName)

// 提取命令文本（exec 等工具），无命令返回空串
export const extractCommand = (args) => {
  const obj = parseArgs(args)
  if (!obj || typeof obj !== 'object') return ''
  const cmd = obj.command || obj.cmd || ''
  return typeof cmd === 'string' ? cmd.trim() : ''
}

// 生成可读摘要（非命令类工具），不展示 JSON
export const formatArgsSummary = (toolName, args) => {
  const obj = parseArgs(args)
  if (!toolName) return ''
  if (!obj || typeof obj !== 'object') {
    return typeof args === 'string' && args ? (args.length > 80 ? args.substring(0, 80) + '...' : args) : ''
  }
  const path = obj.path || obj.file_path
  const fileName = typeof path === 'string' ? path.split('/').pop() : ''
  switch (toolName) {
    case 'write': {
      const size = obj.content ? `（${obj.content.length} 字符）` : ''
      return `写入 ${fileName || path || '未知文件'}${size}`
    }
    case 'edit':
      return `修改 ${fileName || path || '未知文件'}`
    case 'read':
      return `读取 ${fileName || path || '未知文件'}`
    case 'web_search':
      return `搜索: ${obj.query || ''}`
    case 'web_fetch':
      return `获取 ${obj.url || '未知链接'}`
    case 'memory_search':
      return `记忆搜索: ${obj.query || ''}`
    case 'list':
    case 'glob':
    case 'grep':
      return path ? `检索 ${path}` : ''
    default:
      return `调用 ${toolName}`
  }
}

// 检测字符串是否为代码
const isCodeContent = (str) => {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()
  return (
    trimmed.startsWith('```') ||
    /^[ ]{4,}\S/m.test(trimmed) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    trimmed.includes('diff --git') ||
    /^\s*\d+:\s/m.test(trimmed) ||
    /^\/[^\s]+\.[a-z]+$/m.test(trimmed) ||
    /^\s*\$|^\s*>/m.test(trimmed) ||
    (trimmed.includes('\n') && /[{}();]/.test(trimmed))
  )
}

const highlightCode = (code, language = 'plaintext') => {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch (e) {}
  }
  try {
    return hljs.highlightAuto(code).value
  } catch (e) {
    return escapeHtml(code)
  }
}

// ==================== 行号渲染 ====================

const VOID_TAGS = new Set(['br', 'img', 'hr', 'input', 'meta', 'link'])

// 将高亮后的 HTML 按 \n 拆成多行，同时保证每行是合法闭合的 HTML
// （跨行 token（如多行字符串、注释）会在行边界自动关闭并重新打开 span）
const splitHighlightedHtml = (html) => {
  const lines = []
  const openTags = [] // 栈：{ tag, fragment }
  let current = ''
  let i = 0
  const len = html.length
  const readTagEnd = (start) => {
    let j = start
    while (j < len && html[j] !== '>') j++
    return Math.min(j + 1, len)
  }
  const closeAll = () => {
    let out = current
    for (let s = openTags.length - 1; s >= 0; s--) out += `</${openTags[s].tag}>`
    return out
  }
  const reopenAll = () => {
    let out = ''
    for (const t of openTags) out += t.fragment
    return out
  }

  while (i < len) {
    const ch = html[i]
    if (ch === '<') {
      if (html[i + 1] === '/') {
        const end = readTagEnd(i)
        const frag = html.slice(i, end)
        const tagName = (frag.match(/<\/([\w-]+)\s*>/) || [])[1] || ''
        for (let s = openTags.length - 1; s >= 0; s--) {
          if (openTags[s].tag === tagName) {
            openTags.length = s
            break
          }
        }
        current += frag
        i = end
        continue
      }
      const end = readTagEnd(i)
      const frag = html.slice(i, end)
      const m = frag.match(/^<([\w-]+)([^>]*)\/?>/)
      if (m) {
        const tag = m[1]
        if (!VOID_TAGS.has(tag.toLowerCase())) {
          openTags.push({ tag, fragment: frag })
        }
      }
      current += frag
      i = end
      continue
    }
    if (ch === '\n') {
      lines.push(closeAll())
      current = reopenAll()
      i++
      continue
    }
    current += ch
    i++
  }
  lines.push(closeAll())
  return lines
}

// 渲染高亮 HTML：单行用普通 pre，多行带行号
const renderCodeHtml = (highlightedHtml) => {
  const lines = splitHighlightedHtml(highlightedHtml)
  if (lines.length <= 1) {
    return `<pre class="hljs code-block"><code>${highlightedHtml}</code></pre>`
  }
  let out = `<div class="codeblock">`
  lines.forEach((l, idx) => {
    out += `<div class="code-line"><span class="code-line-num">${idx + 1}</span><span class="code-line-content">${l || ''}</span></div>`
  })
  out += '</div>'
  return out
}

// 渲染纯文本：单行用 pre，多行带行号（无语法着色，extraClass 用于着色如 stderr）
const renderPlainHtml = (text, extraClass = '') => {
  const safe = String(text)
  const lines = safe.split('\n')
  const contentCls = extraClass ? `code-line-content ${extraClass}` : 'code-line-content'
  if (lines.length <= 1) {
    return `<pre class="${extraClass || 'code-block'}">${escapeHtml(safe)}</pre>`
  }
  let out = `<div class="codeblock">`
  lines.forEach((l, idx) => {
    out += `<div class="code-line"><span class="code-line-num">${idx + 1}</span><span class="${contentCls}">${escapeHtml(l)}</span></div>`
  })
  out += '</div>'
  return out
}

// 多行命令 → 带行号的 bash 高亮块；单行返回空串（由 `$` 终端样式展示）
export const formatCommandHtml = (command) => {
  if (!command) return ''
  const lines = String(command).split('\n')
  if (lines.length <= 1) return ''
  return renderCodeHtml(highlightCode(command, 'bash'))
}

// 结果对象是否形如命令输出 { stdout / stderr / exitCode / output }
const looksLikeCommandOutput = (obj) => {
  if (!obj || typeof obj !== 'object') return false
  return obj.stdout !== undefined || obj.stderr !== undefined || obj.exitCode !== undefined || obj.output !== undefined
}

// 渲染命令输出（终端风格 + 行号）
const renderCommandOutput = (obj) => {
  const parts = []
  const stdout = typeof obj.stdout === 'string' ? obj.stdout : obj.output
  const stderr = obj.stderr
  if (stdout) {
    parts.push(`<div class="term-line-title">标准输出</div>${renderPlainHtml(stdout, 'term-stdout')}`)
  }
  if (stderr) {
    parts.push(`<div class="term-line-title">标准错误</div>${renderPlainHtml(stderr, 'term-stderr')}`)
  }
  const exitCode = obj.exitCode !== undefined ? obj.exitCode : (obj.exit_code !== undefined ? obj.exit_code : null)
  if (exitCode !== null && exitCode !== undefined) {
    const ok = Number(exitCode) === 0
    parts.push(`<span class="term-exit ${ok ? 'term-exit-ok' : 'term-exit-err'}">退出码: ${escapeHtml(String(exitCode))}</span>`)
  }
  return `<div class="term-block">${parts.join('')}</div>`
}

// 渲染 JSON 代码块（格式化 + 高亮 + 行号）
const renderJsonBlock = (jsonStr) => {
  try {
    const parsed = JSON.parse(jsonStr)
    const formatted = JSON.stringify(parsed, null, 2)
    return renderCodeHtml(highlightCode(formatted, 'json'))
  } catch (e) {
    return renderCodeHtml(highlightCode(jsonStr))
  }
}

/**
 * 格式化执行结果 HTML
 * @param {*} content 结果内容（字符串或对象）
 * @param {boolean} isError 是否执行出错
 * @returns {string} html
 */
export const formatResultHtml = (content, isError = false) => {
  if (content === undefined || content === null) return ''
  const str = typeof content === 'string' ? content : JSON.stringify(content)
  if (!str) return ''
  const trimmed = str.trim()

  if (isError) {
    return `<div class="result-error">${renderPlainHtml(str, 'term-error')}</div>`
  }

  // 图片结果
  if (trimmed.startsWith('data:image/')) {
    return `<img class="result-image" src="${escapeHtml(trimmed)}" alt="执行结果图片" />`
  }

  // 完全由 ``` 包裹的代码块
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```(\w*)\n?([\s\S]*?)\n?```$/)
    if (match) {
      const language = match[1] || 'plaintext'
      const code = match[2]
      if (language === 'json') {
        try {
          return renderJsonBlock(JSON.stringify(JSON.parse(code), null, 2))
        } catch (e) {}
      }
      return renderCodeHtml(highlightCode(code, language))
    }
  }

  // JSON 对象：优先识别命令输出结构，其次格式化 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed)
      if (looksLikeCommandOutput(parsed)) {
        return renderCommandOutput(parsed)
      }
      return renderJsonBlock(trimmed)
    } catch (e) {}
  }

  // 代码特征内容：高亮展示（多行带行号）
  if (isCodeContent(str)) {
    return renderCodeHtml(highlightCode(str))
  }

  // 普通文本：多行带行号着色，单行保持纯文本
  if (str.includes('\n')) {
    return renderCodeHtml(highlightCode(str))
  }
  return `<pre class="result-text">${escapeHtml(str)}</pre>`
}
