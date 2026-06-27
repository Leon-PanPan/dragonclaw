const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const CH = require('../../../shared/ipc-channels');
const { getDB, saveDatabase } = require('../database');

function _rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

// 获取所有智能体
ipcMain.handle(CH.AGENT_LIST, async () => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化', data: [] };
  try {
    const result = db.exec('SELECT * FROM agents ORDER BY create_time DESC');
    return { success: true, data: _rowsToObjects(result) };
  } catch (e) { return { success: false, error: e.message, data: [] }; }
});

// 获取单个智能体
ipcMain.handle(CH.AGENT_GET, async (event, id) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化', data: null };
  try {
    const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return { success: true, data: row };
    }
    stmt.free();
    return { success: true, data: null };
  } catch (e) { return { success: false, error: e.message, data: null }; }
});

// 创建智能体
ipcMain.handle(CH.AGENT_CREATE, async (event, agent) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.run(`INSERT INTO agents (id, uuid, avatar, name, workspace, description, prompt, type, model, author, install_count, category, color, files, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agent.id, agent.uuid || '', agent.avatar || '', agent.name, agent.workspace || '',
       agent.description || '', agent.prompt || '', agent.type || 'local', agent.model || '',
       agent.author || '', agent.install_count || 0, agent.category || '', agent.color || '',
       agent.files || '[]', now, now]);
    saveDatabase();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// 更新智能体
ipcMain.handle(CH.AGENT_UPDATE, async (event, { id, updates }) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const fields = [];
    const values = [];
    const allowed = ['uuid', 'avatar', 'name', 'workspace', 'description', 'prompt', 'type', 'model', 'author', 'install_count', 'category', 'color', 'files'];
    for (const key of allowed) {
      if (updates.hasOwnProperty(key)) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return { success: true };
    values.push(id);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.run(`UPDATE agents SET ${fields.join(', ')}, update_time = ? WHERE id = ?`, [...values, now]);
    saveDatabase();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// 删除智能体
ipcMain.handle(CH.AGENT_DELETE, async (event, id) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    db.run('DELETE FROM agents WHERE id = ?', [id]);
    saveDatabase();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// 按类型查询
ipcMain.handle(CH.AGENT_LIST_BY_TYPE, async (event, type) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化', data: [] };
  try {
    const stmt = db.prepare('SELECT * FROM agents WHERE type = ? ORDER BY create_time DESC');
    stmt.bind([type]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { success: true, data: rows };
  } catch (e) { return { success: false, error: e.message, data: [] }; }
});

// 打开目录选择对话框
ipcMain.handle(CH.SHOW_OPEN_DIRECTORY, async (event, options) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: (options && options.title) || '选择目录',
      defaultPath: (options && options.defaultPath) || undefined,
    });
    return result;
  } catch (e) {
    console.error('[show-open-directory] 失败:', e);
    return { canceled: true, filePaths: [], error: e.message };
  }
});

// 保存头像 base64 到 ~/.openclaw/assets/avatar/
ipcMain.handle(CH.SAVE_AVATAR, async (event, { base64, filename }) => {
  try {
    if (!base64) return { success: false, error: 'base64 不能为空' };
    if (!filename) return { success: false, error: 'filename 不能为空' };

    const homeDir = app.getPath('home');
    const avatarDir = path.join(homeDir, '.openclaw', 'assets', 'avatar');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(avatarDir, safeName);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.log(`[save-avatar] 写入: ${filePath} (${buffer.length} bytes)`);
    return { success: true, path: filePath };
  } catch (e) {
    console.error('[save-avatar] 失败:', e);
    return { success: false, error: e.message };
  }
});
