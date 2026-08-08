const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'chat.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma('journal_mode = WAL');

// Initialize Database Tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT DEFAULT 'global',
      session_id TEXT,
      sender_username TEXT NOT NULL,
      sender_color TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_is_ai INTEGER DEFAULT 0,
      sender_model TEXT,
      text TEXT,
      caption TEXT,
      files_json TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL
    );
  `);
}

// --------------------------------------------------
// AI Session Database Methods
// --------------------------------------------------

function saveAiSession(session) {
  const stmt = db.prepare(`
    INSERT INTO ai_sessions (id, title, username, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      updated_at = excluded.updated_at
  `);
  stmt.run(session.id, session.title, session.username, session.createdAt, session.updatedAt);
}

function getUserSessions(username) {
  const stmt = db.prepare(`
    SELECT * FROM ai_sessions 
    WHERE username = ? 
    ORDER BY updated_at DESC
  `);
  const rows = stmt.all(username || 'Yogesh');
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    username: r.username,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

function getAiSession(id) {
  const sessionRow = db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(id);
  if (!sessionRow) return null;

  const messagesRows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(id);
  const historyRows = db.prepare('SELECT * FROM ai_history WHERE session_id = ? ORDER BY id ASC').all(id);

  const messages = messagesRows.map(m => ({
    id: m.id,
    channel: m.channel,
    sessionId: m.session_id,
    sender: {
      username: m.sender_username,
      color: m.sender_color,
      id: m.sender_id,
      isAi: Boolean(m.sender_is_ai),
      model: m.sender_model
    },
    text: m.text || '',
    caption: m.caption || '',
    files: m.files_json ? JSON.parse(m.files_json) : [],
    timestamp: m.timestamp
  }));

  const history = historyRows.map(h => ({ role: h.role, text: h.text }));

  return {
    id: sessionRow.id,
    title: sessionRow.title,
    username: sessionRow.username,
    createdAt: sessionRow.created_at,
    updatedAt: sessionRow.updated_at,
    messages: messages,
    history: history
  };
}

function deleteAiSession(id) {
  const session = getAiSession(id);
  let filesToUnlink = [];
  if (session && session.messages) {
    session.messages.forEach(m => {
      if (m.files && Array.isArray(m.files)) {
        filesToUnlink.push(...m.files);
      }
    });
  }

  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM ai_history WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM ai_sessions WHERE id = ?').run(id);

  return filesToUnlink;
}

function deleteAllAiSessions(username) {
  const sessions = getUserSessions(username);
  let filesToUnlink = [];
  sessions.forEach(s => {
    const unlinks = deleteAiSession(s.id);
    filesToUnlink.push(...unlinks);
  });
  return filesToUnlink;
}

function addAiHistory(sessionId, role, text) {
  db.prepare('INSERT INTO ai_history (session_id, role, text) VALUES (?, ?, ?)').run(sessionId, role, text);
}

// --------------------------------------------------
// Messages Database Methods
// --------------------------------------------------

function saveMessage(msg) {
  const stmt = db.prepare(`
    INSERT INTO messages (
      id, channel, session_id, sender_username, sender_color, sender_id, 
      sender_is_ai, sender_model, text, caption, files_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      caption = excluded.caption,
      files_json = excluded.files_json
  `);

  stmt.run(
    msg.id,
    msg.channel || 'global',
    msg.sessionId || null,
    msg.sender.username,
    msg.sender.color || '#3b82f6',
    msg.sender.id || 'usr-1',
    msg.sender.isAi ? 1 : 0,
    msg.sender.model || null,
    msg.text || null,
    msg.caption || null,
    msg.files ? JSON.stringify(msg.files) : null,
    msg.timestamp || new Date().toISOString()
  );
}

function getGlobalMessages() {
  const rows = db.prepare("SELECT * FROM messages WHERE channel IS NULL OR channel = 'global' ORDER BY timestamp ASC").all();
  return rows.map(m => ({
    id: m.id,
    channel: 'global',
    sender: {
      username: m.sender_username,
      color: m.sender_color,
      id: m.sender_id,
      isAi: Boolean(m.sender_is_ai),
      model: m.sender_model
    },
    text: m.text || '',
    caption: m.caption || '',
    files: m.files_json ? JSON.parse(m.files_json) : [],
    timestamp: m.timestamp
  }));
}

function deleteMessage(id) {
  const msgRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  let filesToUnlink = [];

  if (msgRow && msgRow.files_json) {
    try {
      filesToUnlink = JSON.parse(msgRow.files_json);
    } catch (e) {}
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  return filesToUnlink;
}

function deleteAllGlobalMessages() {
  const rows = db.prepare("SELECT files_json FROM messages WHERE channel IS NULL OR channel = 'global'").all();
  let filesToUnlink = [];
  rows.forEach(r => {
    if (r.files_json) {
      try {
        filesToUnlink.push(...JSON.parse(r.files_json));
      } catch (e) {}
    }
  });

  db.prepare("DELETE FROM messages WHERE channel IS NULL OR channel = 'global'").run();
  return filesToUnlink;
}

function deleteAllData() {
  const rows = db.prepare('SELECT files_json FROM messages').all();
  let filesToUnlink = [];
  rows.forEach(r => {
    if (r.files_json) {
      try {
        filesToUnlink.push(...JSON.parse(r.files_json));
      } catch (e) {}
    }
  });

  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM ai_history').run();
  db.prepare('DELETE FROM ai_sessions').run();

  return filesToUnlink;
}

// Initialize tables on load
initDatabase();

module.exports = {
  saveAiSession,
  getUserSessions,
  getAiSession,
  deleteAiSession,
  deleteAllAiSessions,
  addAiHistory,
  saveMessage,
  getGlobalMessages,
  deleteMessage,
  deleteAllGlobalMessages,
  deleteAllData
};
