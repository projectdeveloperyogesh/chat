const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
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

// Socket.IO State Management
const activeUsers = new Map(); // socket.id -> { username, color, joinedAt }
const typingUsers = new Set(); // set of usernames currently typing
const chatMessages = new Map(); // messageId -> msgObj
const aiSessionsMap = new Map(); // sessionId -> { id, title, username, createdAt, updatedAt, messages: [], history: [] }

function getUserSessionList(username) {
  const list = [];
  for (const s of aiSessionsMap.values()) {
    if (s.username.toLowerCase() === username.toLowerCase()) {
      list.push({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt
      });
    }
  }
  return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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
    const session = aiSessionsMap.get(data.sessionId);
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

    aiSessionsMap.set(newId, newSession);
    socket.emit('ai:session:list:update', getUserSessionList(user.username));

    if (callback) callback({ success: true, session: newSession });
  });

  // Handle AI Session Delete
  socket.on('ai:session:delete', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user || !data || !data.sessionId) return;

    aiSessionsMap.delete(data.sessionId);
    socket.emit('ai:session:list:update', getUserSessionList(user.username));
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

    chatMessages.set(msg.id, msg);
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

    chatMessages.set(fileMsg.id, fileMsg);
    io.emit('file:new', fileMsg);
  });

  // Handle Message / File Deletion
  socket.on('message:delete', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user || !data || !data.id) return;

    const msgId = data.id;
    const msg = chatMessages.get(msgId);

    // If message has files, clean up disk storage
    if (msg && msg.files && Array.isArray(msg.files)) {
      msg.files.forEach(file => {
        if (file.filename) {
          const filePath = path.join(UPLOADS_DIR, file.filename);
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete file ${filePath}:`, err.message);
            else console.log(`Deleted file from storage: ${file.filename}`);
          });
        }
      });
    }

    chatMessages.delete(msgId);
    io.emit('message:deleted', { id: msgId, deletedBy: user.username });
  });

  // Handle AI Assistant Prompt
  socket.on('ai:send', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const text = (data.text || '').trim();
    if (!text) return;

    let sessionId = (data.sessionId || '').trim();
    let session = aiSessionsMap.get(sessionId);

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
      aiSessionsMap.set(sessionId, session);
    } else if (session.title === 'New Conversation' || !session.title) {
      session.title = text.length > 24 ? text.substring(0, 24) + '...' : text;
    }

    session.updatedAt = new Date().toISOString();

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
      timestamp: new Date().toISOString()
    };

    session.messages.push(userMsg);
    chatMessages.set(userMsg.id, userMsg);
    socket.emit('ai:message:new', userMsg);
    socket.emit('ai:session:list:update', getUserSessionList(user.username));

    // 2. Broadcast AI typing status
    socket.emit('ai:typing', { isTyping: true, username: 'Yogesh AI' });

    // 3. Spawn Python AI Agent with Session History
    const pyScriptPath = path.join(__dirname, 'ai_agent.py');
    const pyArgs = [pyScriptPath, '--prompt', text, '--username', user.username, '--history', JSON.stringify(session.history)];

    execFile('python', pyArgs, { cwd: __dirname, maxBuffer: 10 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
      socket.emit('ai:typing', { isTyping: false, username: 'Yogesh AI' });

      let replyText = "I encountered an issue processing your request. Please try again.";
      let modelName = "gemini-2.5-flash";

      if (!error && stdout) {
        try {
          const resObj = JSON.parse(stdout);
          if (resObj.success && resObj.reply) {
            replyText = resObj.reply;
            modelName = resObj.model || modelName;
          } else if (resObj.error) {
            replyText = `AI Error: ${resObj.error}`;
          }
        } catch (e) {
          console.error("Failed to parse AI output:", stdout);
        }
      } else if (error) {
        console.error("Python AI agent execution error:", error, stderr);
      }

      // Update multi-turn session history & messages
      session.history.push({ role: user.username, text: text });
      session.history.push({ role: 'Yogesh AI', text: replyText });
      session.updatedAt = new Date().toISOString();

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

      session.messages.push(aiMsg);
      chatMessages.set(aiMsg.id, aiMsg);
      socket.emit('ai:message:new', aiMsg);
      socket.emit('ai:session:list:update', getUserSessionList(user.username));
    });
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

