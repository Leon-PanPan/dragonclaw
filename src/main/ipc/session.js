const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const CH = require('../../../shared/ipc-channels');
const { getDB, saveDatabase } = require('../database');

// ==================== Session DB handlers ====================

// 设置会话工作区路径
ipcMain.handle(CH.SESSION_SET_PROJECT_SPACE, async (event, { sessionId, projectSpace }) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.run(
      `INSERT INTO sessions (session_id, project_space, create_time, update_time)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET project_space = excluded.project_space, update_time = excluded.update_time`,
      [sessionId, projectSpace || '', now, now]
    );
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[DB] 设置工作区失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 重命名会话
ipcMain.handle(CH.SESSION_RENAME, async (event, { sessionId, title }) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // UPSERT: 存在则更新，不存在则插入
    db.run(
      `INSERT INTO sessions (session_id, title, create_time, update_time)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         title = excluded.title,
         update_time = excluded.update_time`,
      [sessionId, title, now, now]
    );
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('[DB] 重命名失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 批量获取会话标题映射
ipcMain.handle(CH.SESSION_GET_TITLES, async () => {
  const db = getDB();
  if (!db) return { success: false, titles: {} };
  try {
    const result = db.exec('SELECT session_id, title FROM sessions');
    const titles = {};
    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        titles[row[0]] = row[1];
      }
    }
    console.log('[DB] 查询会话标题:', titles);
    return { success: true, titles };
  } catch (error) {
    console.error('[DB] 获取标题失败:', error.message);
    return { success: false, titles: {} };
  }
});

// 删除会话标题映射
ipcMain.handle(CH.SESSION_DELETE_TITLE, async (event, sessionId) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
    saveDatabase();
    console.log('[DB] 删除会话标题:', sessionId);
    return { success: true };
  } catch (error) {
    console.error('[DB] 删除标题失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 置顶会话
ipcMain.handle(CH.SESSION_PIN, async (event, { sessionId }) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    // 查询当前最大 rank
    const result = db.exec('SELECT MAX(rank) as max_rank FROM sessions');
    let maxRank = 0;
    if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0] !== null) {
      maxRank = result[0].values[0][0];
    }
    const newRank = maxRank + 1;

    // UPSERT rank
    db.run(
      `INSERT INTO sessions (session_id, title, rank, create_time, update_time)
       VALUES (?, '', ?, datetime('now','localtime'), datetime('now','localtime'))
       ON CONFLICT(session_id) DO UPDATE SET rank = excluded.rank, update_time = excluded.update_time`,
      [sessionId, newRank]
    );
    saveDatabase();
    console.log('[DB] 置顶会话:', sessionId, 'rank:', newRank);
    return { success: true, rank: newRank };
  } catch (error) {
    console.error('[DB] 置顶失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 取消置顶
ipcMain.handle(CH.SESSION_UNPIN, async (event, { sessionId }) => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    db.run(
      'UPDATE sessions SET rank = 0, update_time = datetime(\'now\',\'localtime\') WHERE session_id = ?',
      [sessionId]
    );
    saveDatabase();
    console.log('[DB] 取消置顶:', sessionId);
    return { success: true };
  } catch (error) {
    console.error('[DB] 取消置顶失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 获取所有 rank
ipcMain.handle(CH.SESSION_GET_RANKS, async () => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const result = db.exec('SELECT * FROM sessions WHERE rank > 0 ORDER BY rank DESC');
    const ranks = {};
    if (result.length > 0 && result[0].values.length > 0) {
      for (const row of result[0].values) {
        ranks[row[0]] = row[4]; // row[0]=session_id, row[4]=rank
      }
    }
    return { success: true, ranks };
  } catch (error) {
    console.error('[DB] 获取 ranks 失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 一次性获取所有会话数据（session_id → {title, rank, projectSpace}）
ipcMain.handle(CH.SESSION_GET_ALL, async () => {
  const db = getDB();
  if (!db) return { success: false, error: '数据库未初始化', data: [] };
  try {
    const result = db.exec('SELECT session_id, title, rank, project_space FROM sessions');
    if (result.length === 0 || result[0].values.length === 0) {
      return { success: true, data: {} };
    }
    const map = {};
    for (const row of result[0].values) {
      map[row[0]] = { title: row[1], rank: row[2], projectSpace: row[3] || '' };
    }
    return { success: true, data: map };
  } catch (error) {
    console.error('[DB] 获取所有会话失败:', error.message);
    return { success: false, error: error.message, data: {} };
  }
});

// ==================== Session file handlers ====================

// 获取会话列表
ipcMain.handle(CH.SESSIONS_LIST, async (event, agentId = 'main') => {
  try {
    const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', agentId, 'sessions', 'sessions.json');
    console.log('读取会话列表:', sessionsPath);

    if (fs.existsSync(sessionsPath)) {
      const content = fs.readFileSync(sessionsPath, 'utf-8');
      const sessions = JSON.parse(content);
      // 转换为数组格式
      return Object.entries(sessions).map(([key, value]) => ({
        key,
        ...value
      }));
    }
    return [];
  } catch (error) {
    console.error('获取会话列表失败:', error.message);
    return [];
  }
});

// 获取会话消息历史
ipcMain.handle(CH.SESSION_MESSAGES, async (event, { agentId = 'main', sessionKey }) => {
  try {
    const transcriptPath = path.join(process.env.HOME, '.openclaw', 'agents', agentId, 'sessions', `${sessionKey}.jsonl`);
    console.log('读取会话消息:', transcriptPath);

    if (fs.existsSync(transcriptPath)) {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines.map(line => JSON.parse(line));
    }
    return [];
  } catch (error) {
    console.error('获取会话消息失败:', error.message);
    return [];
  }
});

// 保存会话状态
ipcMain.handle(CH.SAVE_SESSION, async (event, { agentId = 'main', sessionKey, sessionData }) => {
  try {
    const sessionsDir = path.join(process.env.HOME, '.openclaw', 'agents', agentId, 'sessions');
    const sessionsPath = path.join(sessionsDir, 'sessions.json');

    // 确保目录存在
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // 读取现有会话
    let sessions = {};
    if (fs.existsSync(sessionsPath)) {
      sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
    }

    // 更新会话
    sessions[sessionKey] = {
      ...sessions[sessionKey],
      ...sessionData,
      updatedAt: new Date().toISOString()
    };

    // 保存
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('保存会话失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 删除会话
ipcMain.handle(CH.DELETE_SESSION, async (event, { agentId = 'main', sessionKey }) => {
  try {
    const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', agentId, 'sessions', 'sessions.json');
    const transcriptPath = path.join(process.env.HOME, '.openclaw', 'agents', agentId, 'sessions', `${sessionKey}.jsonl`);

    // 从 sessions.json 删除
    if (fs.existsSync(sessionsPath)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      delete sessions[sessionKey];
      fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
    }

    // 删除 transcript 文件
    if (fs.existsSync(transcriptPath)) {
      fs.unlinkSync(transcriptPath);
    }

    return { success: true };
  } catch (error) {
    console.error('删除会话失败:', error.message);
    return { success: false, error: error.message };
  }
});
