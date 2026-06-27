// 工具名称和指令的中文化
// 统一管理，避免多处维护导致不一致

// 工具图标
export const TOOL_ICONS = {
  exec: '⚡',
  read: '📖',
  write: '✏️',
  edit: '📝',
  web_search: '🔍',
  web_fetch: '🌐',
  memory_search: '🔮',
  default: '🔧'
};

// 工具名称中文化
export const TOOL_NAME_CN = {
  exec: '执行命令',
  read: '读取文件',
  write: '写入文件',
  edit: '修改文件',
  web_search: '网络搜索',
  web_fetch: '获取网页',
  memory_search: '记忆搜索',
  default: '执行指令'
};

/**
 * 获取工具图标
 */
export function getToolIcon(toolName) {
  return TOOL_ICONS[toolName] || TOOL_ICONS.default;
}

/**
 * 获取工具的中文名称
 */
export function getToolNameCN(toolName) {
  return TOOL_NAME_CN[toolName] || TOOL_NAME_CN.default;
}

/**
 * 获取工具调用的中文描述
 */
export function getToolDescCN(toolName, args) {
  if (!args) return '';
  try {
    const argsObj = typeof args === 'string' ? JSON.parse(args) : args;

    if (toolName === 'exec') {
      const cmd = argsObj.command || '';
      return cmd.length > 35 ? cmd.substring(0, 35) + '...' : cmd;
    }

    if (toolName === 'write') {
      const p = argsObj.path || argsObj.file_path || '';
      const fileName = p.split('/').pop() || p;
      const sizeInfo = argsObj.content ? ` (${argsObj.content.length} 字符)` : '';
      return `${fileName}${sizeInfo}`;
    }

    if (toolName === 'edit') {
      const p = argsObj.path || argsObj.file_path || '';
      const fileName = p.split('/').pop() || p;
      return fileName;
    }

    if (toolName === 'read') {
      const p = argsObj.path || argsObj.file_path || '';
      const fileName = p.split('/').pop() || p;
      return fileName;
    }

    if (toolName === 'web_search') {
      return argsObj.query || '';
    }

    if (toolName === 'web_fetch') {
      const url = argsObj.url || '';
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }

    if (toolName === 'memory_search') {
      return argsObj.query || '';
    }

    // 其他工具，显示参数摘要
    const keys = Object.keys(argsObj).slice(0, 2);
    const preview = keys.map(k => {
      const v = String(argsObj[k] || '');
      return `${k}: ${v.substring(0, 20)}${v.length > 20 ? '...' : ''}`;
    }).join(', ');
    return preview || '';
  } catch (e) {
    return '';
  }
}
