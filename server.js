const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const cors = require('cors');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3005;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${cleanOriginalName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

// Determine file category helper
function getFileCategory(mimeType, filename) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text') || filename.endsWith('.txt') || filename.endsWith('.md')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed') || filename.endsWith('.zip') || filename.endsWith('.rar') || filename.endsWith('.7z')) return 'archive';
  if (filename.endsWith('.js') || filename.endsWith('.py') || filename.endsWith('.json') || filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.cpp') || filename.endsWith('.c') || filename.endsWith('.java')) return 'code';
  return 'other';
}

// Upload Endpoint
app.post('/api/upload', upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => {
      const category = getFileCategory(file.mimetype, file.originalname);
      return {
        id: file.filename,
        originalName: file.originalname,
        originalname: file.originalname,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
        category: category,
        uploadedAt: new Date().toISOString()
      };
    });

    res.json({ success: true, files: uploadedFiles });
  } catch (err) {
    console.error('File Upload Error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// ==========================================================================
// Public REST API v1 Endpoints
// ==========================================================================

// Alias /api/v1/upload to upload handler
app.post('/api/v1/upload', upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => {
      const category = getFileCategory(file.mimetype, file.originalname);
      return {
        id: file.filename,
        originalName: file.originalname,
        originalname: file.originalname,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
        category: category,
        uploadedAt: new Date().toISOString()
      };
    });

    res.json({ success: true, files: uploadedFiles });
  } catch (err) {
    console.error('File Upload Error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// ==========================================================================
// Public REST API v1 Endpoints (Full Web UI Feature Parity)
// ==========================================================================

// GET /api/v1/status - System Health & Endpoints Info
app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'online',
    app: 'Yogesh Chat',
    version: '1.0.0',
    activeUsersCount: activeUsers.size,
    aiSessionsCount: db.getUserSessions('Yogesh').length,
    availableModels: [
      'Gemini 3.6 Flash (High)',
      'Gemini 3.1 Pro (High)',
      'Gemini 3.5 Flash (High)',
      'Claude Sonnet 4.6 (Thinking)',
      'Claude Opus 4.6 (Thinking)',
      'GPT-OSS 120B (Medium)'
    ],
    endpoints: [
      { path: 'GET /api/v1/status', description: 'Check server status and AI capabilities' },
      { path: 'POST /api/v1/upload', description: 'Upload documents, images, audio, or video files' },
      { path: 'POST /api/v1/ai/chat', description: 'Send an AI prompt with optional attached files & session memory' },
      { path: 'GET /api/v1/ai/sessions', description: 'List AI conversation session threads' },
      { path: 'GET /api/v1/ai/sessions/:id', description: 'Get full messages and history for an AI session' },
      { path: 'POST /api/v1/ai/sessions', description: 'Create a new AI conversation session thread' },
      { path: 'DELETE /api/v1/ai/sessions/:id', description: 'Delete an AI conversation session thread' },
      { path: 'DELETE /api/v1/ai/sessions', description: 'Delete ALL AI conversation sessions for a user' },
      { path: 'POST /api/v1/messages', description: 'Broadcast a text message to the Global Lounge chat room' },
      { path: 'POST /api/v1/files', description: 'Broadcast shared files with caption to the Global Lounge chat room' },
      { path: 'GET /api/v1/messages', description: 'Retrieve Global Lounge chat messages history' },
      { path: 'DELETE /api/v1/messages/:id', description: 'Delete a single chat message or shared file' },
      { path: 'DELETE /api/v1/messages', description: 'Delete ALL Global Lounge messages' },
      { path: 'DELETE /api/v1/chats/all', description: 'Clear ALL chats, AI sessions, and uploaded files completely' }
    ]
  });
});

// POST /api/v1/ai/chat - AI Prompt REST API (Supports Text, Attached Docs, Audio Files, & Sessions)
app.post('/api/v1/ai/chat', (req, res) => {
  const text = (req.body.prompt || req.body.text || '').trim();
  const rawFiles = (req.body.files && Array.isArray(req.body.files)) ? req.body.files : [];

  if (!text && rawFiles.length === 0) {
    return res.status(400).json({ success: false, error: 'Prompt text or attached files are required' });
  }

  const username = (req.body.username || 'API User').trim();
  const reqModel = (req.body.model || 'Gemini 3.6 Flash (High)').trim();
  let sessionId = (req.body.sessionId || '').trim();

  let session = db.getAiSession(sessionId);
  if (!session) {
    sessionId = 'session-' + Date.now() + '-' + Math.round(Math.random() * 1000);
    session = {
      id: sessionId,
      title: text ? (text.length > 24 ? text.substring(0, 24) + '...' : text) : 'API File Analysis',
      username: username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      history: []
    };
    db.saveAiSession(session);
  } else {
    session.updatedAt = new Date().toISOString();
    db.saveAiSession(session);
  }

  // User message object
  const userMsg = {
    id: 'ai-user-' + Date.now() + '-' + Math.round(Math.random() * 1000),
    channel: 'ai',
    sessionId: sessionId,
    sender: { username, color: '#8b5cf6', id: 'api-user' },
    text: text,
    files: rawFiles,
    timestamp: new Date().toISOString()
  };
  db.saveMessage(userMsg);

  // Map file objects for Python bridge
  const fileObjects = rawFiles.map(f => ({
    filename: f.filename,
    originalname: f.originalname || f.originalName || f.filename,
    filepath: path.join(UPLOADS_DIR, f.filename)
  }));

  // Spawn Python AI agent
  const venvPythonPath = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
  const pythonCmd = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';
  const pyScriptPath = path.join(__dirname, 'ai_agent.py');
  const pyProc = spawn(pythonCmd, [pyScriptPath], { cwd: __dirname });

  let stdoutData = '';
  let stderrData = '';

  pyProc.stdout.on('data', (d) => { stdoutData += d.toString(); });
  pyProc.stderr.on('data', (d) => { stderrData += d.toString(); });

  pyProc.on('close', () => {
    let replyText = "I encountered an issue processing your request.";
    let modelName = reqModel;

    if (stdoutData.trim()) {
      try {
        const resObj = JSON.parse(stdoutData.trim());
        if (resObj.success && resObj.reply) {
          replyText = resObj.reply;
          modelName = resObj.model || modelName;
        } else if (resObj.error) {
          replyText = `AI Error: ${resObj.error}`;
        }
      } catch (e) {
        console.error("Failed to parse AI output:", stdoutData);
      }
    }

    db.addAiHistory(sessionId, username, text || 'File Attachment Analysis');
    db.addAiHistory(sessionId, 'Yogesh AI', replyText);
    session.updatedAt = new Date().toISOString();
    db.saveAiSession(session);

    const aiMsg = {
      id: 'ai-res-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      channel: 'ai',
      sessionId: sessionId,
      sender: { username: 'Yogesh AI', color: '#8b5cf6', id: 'ai-bot', isAi: true, model: modelName },
      text: replyText,
      timestamp: new Date().toISOString()
    };
    db.saveMessage(aiMsg);

    // Broadcast live to WebSockets
    io.emit('ai:message:new', userMsg);
    io.emit('ai:message:new', aiMsg);

    res.json({
      success: true,
      reply: replyText,
      model: modelName,
      sessionId: sessionId,
      files: rawFiles
    });
  });

  const payload = JSON.stringify({
    prompt: text,
    username: username,
    history: session.history,
    model: reqModel,
    files: fileObjects
  });
  pyProc.stdin.write(payload);
  pyProc.stdin.end();
});

// GET /api/v1/ai/sessions - List AI Sessions
app.get('/api/v1/ai/sessions', (req, res) => {
  const username = (req.query.username || '').trim();
  const sessions = db.getUserSessions(username || 'Yogesh');
  res.json({ success: true, sessions });
});

// GET /api/v1/ai/sessions/:id - Get Single AI Session Details
app.get('/api/v1/ai/sessions/:id', (req, res) => {
  const session = db.getAiSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, session });
});

// POST /api/v1/ai/sessions - Create New AI Session Thread
app.post('/api/v1/ai/sessions', (req, res) => {
  const username = (req.body.username || 'API User').trim();
  const title = (req.body.title || 'New AI Thread').trim();
  const newId = 'session-' + Date.now() + '-' + Math.round(Math.random() * 1000);
  
  const newSession = {
    id: newId,
    title: title,
    username: username,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    history: []
  };

  db.saveAiSession(newSession);
  io.emit('ai:session:list:update', db.getUserSessions(username));
  res.json({ success: true, session: newSession });
});

// DELETE /api/v1/ai/sessions/:id - Delete AI Session Thread
app.delete('/api/v1/ai/sessions/:id', (req, res) => {
  const session = db.getAiSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const unlinks = db.deleteAiSession(req.params.id);
  unlinks.forEach(fileObj => {
    if (fileObj.filename) {
      const fullPath = path.join(UPLOADS_DIR, fileObj.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  io.emit('ai:session:list:update', db.getUserSessions(session.username));
  res.json({ success: true, message: 'Session deleted successfully' });
});

// DELETE /api/v1/ai/sessions - Delete ALL AI Session Threads for User
app.delete('/api/v1/ai/sessions', (req, res) => {
  const username = (req.query.username || 'Yogesh').trim();
  const unlinks = db.deleteAllAiSessions(username);
  unlinks.forEach(fileObj => {
    if (fileObj.filename) {
      const fullPath = path.join(UPLOADS_DIR, fileObj.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  io.emit('ai:session:list:update', []);
  res.json({ success: true, message: 'All AI sessions deleted successfully' });
});

// POST /api/v1/messages - Broadcast Text Message to Global Lounge
app.post('/api/v1/messages', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) {
    return res.status(400).json({ success: false, error: 'Text is required' });
  }

  const username = (req.body.username || 'API Bot').trim();
  const color = getUserColor(username);

  const msg = {
    id: 'msg-' + Date.now() + '-' + Math.round(Math.random() * 1000),
    sender: { username, color, id: 'api-' + Date.now() },
    text: text,
    timestamp: new Date().toISOString()
  };

  db.saveMessage(msg);
  io.emit('message:new', msg);

  res.json({ success: true, message: msg });
});

// POST /api/v1/files - Broadcast Shared Files with Caption to Global Lounge
app.post('/api/v1/files', (req, res) => {
  const rawFiles = (req.body.files && Array.isArray(req.body.files)) ? req.body.files : [];
  if (rawFiles.length === 0) {
    return res.status(400).json({ success: false, error: 'Files array is required' });
  }

  const username = (req.body.username || 'API Bot').trim();
  const caption = (req.body.caption || '').trim();
  const color = getUserColor(username);

  const msg = {
    id: 'file-msg-' + Date.now() + '-' + Math.round(Math.random() * 1000),
    sender: { username, color, id: 'api-' + Date.now() },
    caption: caption,
    files: rawFiles,
    timestamp: new Date().toISOString()
  };

  db.saveMessage(msg);
  io.emit('file:new', msg);

  res.json({ success: true, message: msg });
});

// GET /api/v1/messages - Global Lounge Messages History
app.get('/api/v1/messages', (req, res) => {
  const messages = db.getGlobalMessages();
  res.json({ success: true, messages });
});

// DELETE /api/v1/messages/:id - Delete Message & File from Server Storage
app.delete('/api/v1/messages/:id', (req, res) => {
  const targetId = req.params.id;
  const unlinks = db.deleteMessage(targetId);

  unlinks.forEach(fileObj => {
    if (fileObj.filename) {
      const fullPath = path.join(UPLOADS_DIR, fileObj.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  io.emit('message:deleted', { id: targetId });
  res.json({ success: true, message: 'Message and files deleted successfully' });
});

// DELETE /api/v1/messages - Delete ALL Global Lounge Messages
app.delete('/api/v1/messages', (req, res) => {
  const unlinks = db.deleteAllGlobalMessages();

  unlinks.forEach(fileObj => {
    if (fileObj.filename) {
      const fullPath = path.join(UPLOADS_DIR, fileObj.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  io.emit('messages:cleared:global');
  res.json({ success: true, message: 'All Global Lounge messages deleted successfully' });
});

// DELETE /api/v1/chats/all - Delete ALL Chats, Sessions, & Files Completely
app.delete('/api/v1/chats/all', (req, res) => {
  const unlinks = db.deleteAllData();

  unlinks.forEach(fileObj => {
    if (fileObj.filename) {
      const fullPath = path.join(UPLOADS_DIR, fileObj.filename);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  io.emit('chat:cleared:all');
  res.json({ success: true, message: 'All chats, sessions, and files deleted successfully' });
});

// Socket.IO State Management
const activeUsers = new Map(); // socket.id -> { username, color, joinedAt }
const typingUsers = new Set(); // set of usernames currently typing

function getUserSessionList(username) {
  return db.getUserSessions(username);
}

// Generate consistent avatar color based on username
function getUserColor(username) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#10b981', '#06b6d4', '#3b82f6', '#f59e0b'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle User Join
  socket.on('user:join', (data, callback) => {
    const username = (data.username || '').trim();
    if (!username) {
      if (callback) callback({ success: false, message: 'Username is required' });
      return;
    }

    // Check if username taken by active socket
    const existing = Array.from(activeUsers.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      if (callback) callback({ success: false, message: 'Username is already taken' });
      return;
    }

    const color = getUserColor(username);
    const userObj = {
      id: socket.id,
      username: username,
      color: color,
      joinedAt: new Date().toISOString()
    };

    activeUsers.set(socket.id, userObj);

    // Broadcast system join notification
    io.emit('system:message', {
      id: Date.now() + '-' + Math.random(),
      text: `${username} joined the chat`,
      type: 'join',
      timestamp: new Date().toISOString()
    });

    // Update active user list for everyone
    io.emit('users:update', Array.from(activeUsers.values()));

    if (callback) callback({ success: true, user: userObj });
  });

  // Handle AI Session List Request
  socket.on('ai:session:list', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    socket.emit('ai:session:list:update', getUserSessionList(user.username));
  });

  // Handle AI Session Select
  socket.on('ai:session:select', (data, callback) => {
    const user = activeUsers.get(socket.id);
    if (!user || !data || !data.sessionId) return;
    const session = db.getAiSession(data.sessionId);
    if (session && callback) {
      callback({
        success: true,
        session: {
          id: session.id,
          title: session.title,
          messages: session.messages
        }
      });
    } else if (callback) {
      callback({ success: false, message: 'Session not found' });
    }
  });

  // Handle AI Session Create
  socket.on('ai:session:create', (data, callback) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const newId = 'session-' + Date.now() + '-' + Math.round(Math.random() * 1000);
    const newSession = {
      id: newId,
      title: 'New Conversation',
      username: user.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      history: []
    };

    db.saveAiSession(newSession);
    socket.emit('ai:session:list:update', getUserSessionList(user.username));

    if (callback) callback({ success: true, session: newSession });
  });

  // Handle AI Session Delete
  socket.on('ai:session:delete', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user || !data || !data.sessionId) return;

    const unlinks = db.deleteAiSession(data.sessionId);
    unlinks.forEach(fileObj => {
      if (fileObj.filename) {
        const filePath = path.join(UPLOADS_DIR, fileObj.filename);
        fs.unlink(filePath, (err) => {});
      }
    });

    socket.emit('ai:session:list:update', getUserSessionList(user.username));
  });

  // Handle AI Session Delete All
  socket.on('ai:session:delete:all', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const unlinks = db.deleteAllAiSessions(user.username);
    unlinks.forEach(fileObj => {
      if (fileObj.filename) {
        const filePath = path.join(UPLOADS_DIR, fileObj.filename);
        fs.unlink(filePath, (err) => {});
      }
    });

    socket.emit('ai:session:list:update', []);
  });

  // Handle Text Message
  socket.on('message:send', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const text = (data.text || '').trim();
    if (!text) return;

    const msg = {
      id: 'msg-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      sender: {
        username: user.username,
        color: user.color,
        id: user.id
      },
      text: text,
      timestamp: new Date().toISOString()
    };

    db.saveMessage(msg);
    io.emit('message:new', msg);
  });

  // Handle Shared Files Announcement
  socket.on('file:share', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    if (!data.files || !Array.isArray(data.files) || data.files.length === 0) return;

    const fileMsg = {
      id: 'file-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      sender: {
        username: user.username,
        color: user.color,
        id: user.id
      },
      caption: (data.caption || '').trim(),
      files: data.files,
      timestamp: new Date().toISOString()
    };

    db.saveMessage(fileMsg);
    io.emit('file:new', fileMsg);
  });

  // Handle Message / File Deletion
  socket.on('message:delete', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user || !data || !data.id) return;

    const msgId = data.id;
    const unlinks = db.deleteMessage(msgId);

    unlinks.forEach(fileObj => {
      if (fileObj.filename) {
        const filePath = path.join(UPLOADS_DIR, fileObj.filename);
        fs.unlink(filePath, (err) => {});
      }
    });

    io.emit('message:deleted', { id: msgId, deletedBy: user.username });
  });

  // Handle Clear All Messages in Global Lounge
  socket.on('message:delete:all', () => {
    const unlinks = db.deleteAllGlobalMessages();
    unlinks.forEach(fileObj => {
      if (fileObj.filename) {
        const filePath = path.join(UPLOADS_DIR, fileObj.filename);
        fs.unlink(filePath, (err) => {});
      }
    });

    io.emit('messages:cleared:global');
  });

  // Handle Clear ALL Data (Global Lounge + AI Sessions + Disk Files)
  socket.on('chat:clear:all', () => {
    const unlinks = db.deleteAllData();
    unlinks.forEach(fileObj => {
      if (fileObj.filename) {
        const filePath = path.join(UPLOADS_DIR, fileObj.filename);
        fs.unlink(filePath, (err) => {});
      }
    });

    io.emit('chat:cleared:all');
  });

  // Handle AI Assistant Prompt
  socket.on('ai:send', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const text = (data.text || '').trim();
    if (!text) return;

    let sessionId = (data.sessionId || '').trim();
    let session = db.getAiSession(sessionId);

    if (!session) {
      sessionId = 'session-' + Date.now() + '-' + Math.round(Math.random() * 1000);
      session = {
        id: sessionId,
        title: text.length > 24 ? text.substring(0, 24) + '...' : text,
        username: user.username,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        history: []
      };
      db.saveAiSession(session);
    } else if (session.title === 'New Conversation' || !session.title) {
      session.title = text.length > 24 ? text.substring(0, 24) + '...' : text;
      db.saveAiSession(session);
    } else {
      session.updatedAt = new Date().toISOString();
      db.saveAiSession(session);
    }

    const filesList = (data.files && Array.isArray(data.files)) ? data.files : [];

    // 1. User Prompt Message object
    const userMsg = {
      id: 'ai-user-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      channel: 'ai',
      sessionId: sessionId,
      sender: {
        username: user.username,
        color: user.color,
        id: user.id
      },
      text: text,
      files: filesList,
      timestamp: new Date().toISOString()
    };

    db.saveMessage(userMsg);
    socket.emit('ai:message:new', userMsg);
    socket.emit('ai:session:list:update', getUserSessionList(user.username));

    // 2. Broadcast AI typing status
    socket.emit('ai:typing', { isTyping: true, username: 'Yogesh AI' });

    // 3. Spawn Python AI Agent using .venv Python if present
    const venvPythonPath = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
    const pythonCmd = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';
    const pyScriptPath = path.join(__dirname, 'ai_agent.py');
    const pyProc = spawn(pythonCmd, [pyScriptPath], { cwd: __dirname });
    let stdoutData = '';
    let stderrData = '';

    pyProc.stdout.on('data', (data) => { stdoutData += data.toString(); });
    pyProc.stderr.on('data', (data) => { stderrData += data.toString(); });

    pyProc.on('close', (code) => {
      socket.emit('ai:typing', { isTyping: false, username: 'Yogesh AI' });

      let replyText = "I encountered an issue processing your request. Please try again.";
      let modelName = "gemini-2.5-flash";

      if (stdoutData.trim()) {
        try {
          const resObj = JSON.parse(stdoutData.trim());
          if (resObj.success && resObj.reply) {
            replyText = resObj.reply;
            modelName = resObj.model || modelName;
          } else if (resObj.error) {
            replyText = `AI Error: ${resObj.error}`;
          }
        } catch (e) {
          console.error("Failed to parse AI output:", stdoutData);
        }
      } else if (stderrData) {
        console.error("Python AI agent stderr:", stderrData);
      }

      // Update multi-turn session history & messages in SQLite
      db.addAiHistory(sessionId, user.username, text);
      db.addAiHistory(sessionId, 'Yogesh AI', replyText);
      session.updatedAt = new Date().toISOString();
      db.saveAiSession(session);

      // 4. AI Response Message object
      const aiMsg = {
        id: 'ai-res-' + Date.now() + '-' + Math.round(Math.random() * 1000),
        channel: 'ai',
        sessionId: sessionId,
        sender: {
          username: 'Yogesh AI',
          color: '#8b5cf6',
          id: 'ai-bot',
          isAi: true,
          model: modelName
        },
        text: replyText,
        timestamp: new Date().toISOString()
      };

      db.saveMessage(aiMsg);
      socket.emit('ai:message:new', aiMsg);
      socket.emit('ai:session:list:update', getUserSessionList(user.username));
    });

    const fileObjects = filesList.map(f => ({
      filename: f.filename,
      originalname: f.originalname || f.originalName || f.filename,
      filepath: path.join(UPLOADS_DIR, f.filename)
    }));

    const reqModel = (data.model || 'gemini-3.6-flash').trim();
    const payload = JSON.stringify({
      prompt: text,
      username: user.username,
      history: session.history,
      model: reqModel,
      files: fileObjects
    });
    pyProc.stdin.write(payload);
    pyProc.stdin.end();
  });

  // Handle Typing Indicators
  socket.on('typing:start', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    typingUsers.add(user.username);
    socket.broadcast.emit('typing:update', Array.from(typingUsers));
  });

  socket.on('typing:stop', () => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    typingUsers.delete(user.username);
    socket.broadcast.emit('typing:update', Array.from(typingUsers));
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      typingUsers.delete(user.username);

      io.emit('system:message', {
        id: Date.now() + '-' + Math.random(),
        text: `${user.username} left the chat`,
        type: 'leave',
        timestamp: new Date().toISOString()
      });

      io.emit('users:update', Array.from(activeUsers.values()));
      io.emit('typing:update', Array.from(typingUsers));
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Server with Fallback Port Handling
function startServer(initialPort) {
  server.listen(initialPort, '0.0.0.0')
    .on('listening', () => {
      const port = server.address().port;
      const networkInterfaces = os.networkInterfaces();
      let networkIp = 'Unavailable';

      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            networkIp = net.address;
            break;
          }
        }
      }

      console.log(`===================================================`);
      console.log(`🚀 Yogesh Chat Server running on port ${port}`);
      console.log(`👉 Local:   http://localhost:${port}`);
      console.log(`👉 Network: http://${networkIp}:${port}`);
      console.log(`===================================================`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${initialPort} is in use, trying port ${initialPort + 1}...`);
        startServer(initialPort + 1);
      } else {
        console.error('Server error:', err);
      }
    });
}

startServer(PORT);

