/**
 * Database Module — SQLite connection, table creation, and data access.
 * Used by IPC handlers via `require('../database')`.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const initSqlJs = require('sql.js');

let db = null;
let SQL = null;

async function initDatabase(openclawConfigPath, smartDir) {
  const dbDir = smartDir || path.join(os.homedir(), '.dragonclaw');
  const dbPath = path.join(dbDir, 'dragonclaw.db');

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  SQL = await initSqlJs();

  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (e) {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
    rank INTEGER NOT NULL DEFAULT 0, project_space TEXT NOT NULL DEFAULT '',
    create_time TEXT NOT NULL DEFAULT '', update_time TEXT NOT NULL DEFAULT ''
  )`);
  // Migration: add project_space column to existing databases
  try { db.run('ALTER TABLE sessions ADD COLUMN project_space TEXT DEFAULT \'\''); } catch (_) {}
  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY, uuid TEXT DEFAULT '', avatar TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT '', workspace TEXT DEFAULT '',
    description TEXT DEFAULT '', prompt TEXT DEFAULT '', type TEXT DEFAULT '',
    model TEXT DEFAULT '', author TEXT DEFAULT '', install_count INTEGER DEFAULT 0,
    category TEXT DEFAULT '', color TEXT DEFAULT '', files TEXT DEFAULT '',
    create_time TEXT NOT NULL DEFAULT '', update_time TEXT NOT NULL DEFAULT ''
  )`);

  console.log('[DB] initialized:', dbPath);
}

function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function saveDatabase() {
  if (!db) return;
  try {
    const userDataPath = require('electron').app.getPath('userData');
    const dbDir = path.resolve(userDataPath, '..', '..', '.dragonclaw');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'dragonclaw.db');
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  } catch (e) { console.error('[DB] save error:', e.message); }
}

module.exports = { initDatabase, getDB, saveDatabase };
