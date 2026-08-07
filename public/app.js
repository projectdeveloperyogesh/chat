// ==========================================================================
// Yogesh Chat - Client Application JavaScript
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Socket.io Connection
  const socket = io();

  // DOM Elements
  const joinModal = document.getElementById('join-modal');
  const joinForm = document.getElementById('join-form');
  const usernameInput = document.getElementById('username-input');
  const joinError = document.getElementById('join-error');
  const appContainer = document.getElementById('app-container');

  const myAvatar = document.getElementById('my-avatar');
  const myUsername = document.getElementById('my-username');
  const userList = document.getElementById('user-list');
  const userCountBadge = document.getElementById('user-count-badge');
  const headerAvatars = document.getElementById('header-avatars');

  const sidebar = document.getElementById('sidebar');
  const openSidebarBtn = document.getElementById('open-sidebar-btn');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  const dropZone = document.getElementById('drop-zone');
  const sidebarFileInput = document.getElementById('sidebar-file-input');
  const chatFileInput = document.getElementById('chat-file-input');
  const attachBtn = document.getElementById('attach-btn');

  const messageContainer = document.getElementById('message-container');
  const chatForm = document.getElementById('chat-form');
  const chatMessageInput = document.getElementById('chat-message-input');
  const typingIndicator = document.getElementById('typing-indicator');
  const typingText = document.getElementById('typing-text');

  const pendingAttachmentsBar = document.getElementById('pending-attachments');
  const attachmentPreviews = document.getElementById('attachment-previews');
  const attachedCount = document.getElementById('attached-count');
  const clearAttachmentsBtn = document.getElementById('clear-attachments-btn');

  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxFilename = document.getElementById('lightbox-filename');
  const lightboxDownload = document.getElementById('lightbox-download');
  const closeLightboxBtn = document.getElementById('close-lightbox-btn');

  // Application State
  let currentUser = null;
  let stagedFiles = [];
  let typingTimeout = null;
  let activeChannel = 'global'; // 'global' | 'ai'
  const messagesStore = { global: [], ai: [] };

  // AI Conversation Session ID (persisted per browser session)
  let aiSessionId = localStorage.getItem('yogesh_ai_session_id');
  if (!aiSessionId) {
    aiSessionId = 'session-' + Date.now() + '-' + Math.round(Math.random() * 1000);
    localStorage.setItem('yogesh_ai_session_id', aiSessionId);
  }

  // Channel & Session Header Elements
  const channelTitle = document.querySelector('.channel-info h2');
  const channelSub = document.querySelector('.channel-info p');
  const newAiSessionBtn = document.getElementById('new-ai-session-btn');

  // AI Sidebar Thread Elements
  const aiThreadsSection = document.getElementById('ai-threads-section');
  const addAiThreadBtn = document.getElementById('add-ai-thread-btn');
  const aiSessionList = document.getElementById('ai-session-list');

  // --------------------------------------------------
  // Helper Functions
  // --------------------------------------------------

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function parseMarkdown(text) {
    let esc = escapeHTML(text);
    // Code blocks ```...```
    esc = esc.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code `...`
    esc = esc.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **...**
    esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *...*
    esc = esc.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Line breaks
    esc = esc.replace(/\n/g, '<br>');
    return esc;
  }

  function getCategoryIcon(category) {
    switch (category) {
      case 'image': return 'fa-image';
      case 'video': return 'fa-video';
      case 'audio': return 'fa-music';
      case 'document': return 'fa-file-lines';
      case 'archive': return 'fa-file-zipper';
      case 'code': return 'fa-file-code';
      default: return 'fa-file';
    }
  }

  function scrollToBottom() {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  // --------------------------------------------------
  // Channel & Session Switching
  // --------------------------------------------------

  function switchChannel(channel) {
    if (activeChannel === channel) return;
    activeChannel = channel;

    // Update Sidebar Navigation active state
    document.querySelectorAll('.channel-item').forEach(item => {
      if (item.getAttribute('data-channel') === channel) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Header Text & Icons
    if (channel === 'ai') {
      channelTitle.innerHTML = `<i class="fa-solid fa-robot"></i> ai-assistant <span class="badge ai-badge">Gemini AI</span>`;
      channelSub.textContent = `Ask questions, generate code, or discuss topics with Antigravity CLI`;
      if (newAiSessionBtn) newAiSessionBtn.classList.remove('hidden');
      if (aiThreadsSection) aiThreadsSection.classList.remove('hidden');
      socket.emit('ai:session:list');
    } else {
      channelTitle.innerHTML = `<i class="fa-solid fa-hashtag"></i> global-lounge`;
      channelSub.textContent = `Share messages, images, videos & documents instantly`;
      if (newAiSessionBtn) newAiSessionBtn.classList.add('hidden');
      if (aiThreadsSection) aiThreadsSection.classList.add('hidden');
    }

    renderChannelMessages();
  }

  function createNewAiSession() {
    socket.emit('ai:session:create', {}, (res) => {
      if (res && res.success && res.session) {
        aiSessionId = res.session.id;
        localStorage.setItem('yogesh_ai_session_id', aiSessionId);
        messagesStore.ai = [];
        renderChannelMessages();
      }
    });
  }

  if (newAiSessionBtn) newAiSessionBtn.addEventListener('click', createNewAiSession);
  if (addAiThreadBtn) addAiThreadBtn.addEventListener('click', createNewAiSession);

  function renderChannelMessages() {
    messageContainer.innerHTML = '';

    if (activeChannel === 'ai') {
      if (messagesStore.ai.length === 0) {
        const banner = document.createElement('div');
        banner.className = 'chat-welcome-banner';
        banner.innerHTML = `
          <div class="welcome-icon" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">
            <i class="fa-solid fa-robot"></i>
          </div>
          <h3>Welcome to Yogesh AI Assistant</h3>
          <p>Ask anything! Powered by Python AI Agent & Gemini Model Engine.</p>
        `;
        messageContainer.appendChild(banner);
      } else {
        messagesStore.ai.forEach(node => messageContainer.appendChild(node.cloneNode(true)));
      }
    } else {
      if (messagesStore.global.length === 0) {
        const banner = document.createElement('div');
        banner.className = 'chat-welcome-banner';
        banner.innerHTML = `
          <div class="welcome-icon"><i class="fa-solid fa-shield-halved"></i></div>
          <h3>Welcome to the Global Lounge</h3>
          <p>Share text, photos, audio, videos, or raw documents effortlessly.</p>
        `;
        messageContainer.appendChild(banner);
      } else {
        messagesStore.global.forEach(node => messageContainer.appendChild(node.cloneNode(true)));
      }
    }

    // Re-bind click listeners for dynamically cloned message elements
    bindMessageInteractions();
    scrollToBottom();
  }

  function bindMessageInteractions() {
    document.querySelectorAll('.msg-delete-btn').forEach(btn => {
      btn.onclick = () => {
        const msgId = btn.getAttribute('data-id');
        if (confirm('Delete this message for everyone?')) {
          socket.emit('message:delete', { id: msgId });
        }
      };
    });

    document.querySelectorAll('.preview-img').forEach(img => {
      img.onclick = () => {
        lightboxImg.src = img.getAttribute('data-url');
        lightboxFilename.textContent = img.getAttribute('data-name');
        lightboxDownload.href = img.getAttribute('data-url');
        lightboxDownload.download = img.getAttribute('data-name');
        lightboxModal.classList.remove('hidden');
      };
    });
  }

  // Bind channel item click listeners
  document.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => {
      const ch = item.getAttribute('data-channel');
      switchChannel(ch);
    });
  });

  // --------------------------------------------------
  // Sidebar Mobile Toggle
  // --------------------------------------------------

  openSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
  });

  closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });

  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });

  // --------------------------------------------------
  // Join Flow
  // --------------------------------------------------

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (!username) return;

    joinError.textContent = '';

    socket.emit('user:join', { username }, (response) => {
      if (response.success) {
        currentUser = response.user;
        myUsername.textContent = currentUser.username;
        myAvatar.textContent = currentUser.username.charAt(0);
        myAvatar.style.backgroundColor = currentUser.color;

        joinModal.classList.add('hidden');
        appContainer.classList.remove('hidden');
        chatMessageInput.focus();
      } else {
        joinError.textContent = response.message || 'Failed to join.';
      }
    });
  });

  // --------------------------------------------------
  // File Upload & Staging
  // --------------------------------------------------

  function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      stagedFiles.push(files[i]);
    }
    renderStagedFiles();
  }

  function renderStagedFiles() {
    if (stagedFiles.length === 0) {
      pendingAttachmentsBar.classList.add('hidden');
      attachmentPreviews.innerHTML = '';
      return;
    }

    pendingAttachmentsBar.classList.remove('hidden');
    attachedCount.textContent = stagedFiles.length;
    attachmentPreviews.innerHTML = '';

    stagedFiles.forEach((file, index) => {
      const pill = document.createElement('div');
      pill.className = 'attachment-pill';
      pill.innerHTML = `
        <i class="fa-solid fa-file"></i>
        <span>${escapeHTML(file.name)} (${formatBytes(file.size)})</span>
        <i class="fa-solid fa-xmark remove-attach" data-index="${index}"></i>
      `;
      attachmentPreviews.appendChild(pill);
    });

    // Remove attachment click handler
    document.querySelectorAll('.remove-attach').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        stagedFiles.splice(idx, 1);
        renderStagedFiles();
      });
    });
  }

  clearAttachmentsBtn.addEventListener('click', () => {
    stagedFiles = [];
    renderStagedFiles();
  });

  attachBtn.addEventListener('click', () => chatFileInput.click());
  chatFileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

  dropZone.addEventListener('click', () => sidebarFileInput.click());
  sidebarFileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

  // Drag & Drop event listeners on Drop Zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      handleFileSelect(dt.files);
    }
  });

  // Global Drag & Drop into Chat Window
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  });

  async function uploadStagedFiles() {
    if (stagedFiles.length === 0) return [];

    const formData = new FormData();
    stagedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        return data.files;
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
        return [];
      }
    } catch (err) {
      console.error('File upload network error:', err);
      alert('File upload failed due to network error.');
      return [];
    }
  }

  // --------------------------------------------------
  // Chat Form Submission
  // --------------------------------------------------

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatMessageInput.value.trim();
    const hasFiles = stagedFiles.length > 0;

    if (!text && !hasFiles) return;

    if (activeChannel === 'ai') {
      // AI Channel Submission with Multi-Turn Conversation Session ID
      socket.emit('ai:send', { text, sessionId: aiSessionId });
      chatMessageInput.value = '';
    } else {
      // Global Lounge Channel Submission
      if (hasFiles) {
        const uploadedFiles = await uploadStagedFiles();
        if (uploadedFiles.length > 0) {
          socket.emit('file:share', {
            files: uploadedFiles,
            caption: text
          });
          stagedFiles = [];
          renderStagedFiles();
          chatMessageInput.value = '';
        }
      } else {
        socket.emit('message:send', { text });
        chatMessageInput.value = '';
      }
    }

    socket.emit('typing:stop');
  });

  // --------------------------------------------------
  // Typing Indicator Logic
  // --------------------------------------------------

  chatMessageInput.addEventListener('input', () => {
    socket.emit('typing:start');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('typing:stop');
    }, 1500);
  });

  // --------------------------------------------------
  // Socket Event Listeners
  // --------------------------------------------------

  // Users Update
  socket.on('users:update', (users) => {
    userCountBadge.textContent = users.length;
    userList.innerHTML = '';
    headerAvatars.innerHTML = '';

    users.forEach((u, index) => {
      // Sidebar user item
      const li = document.createElement('li');
      li.className = `user-item ${u.username === currentUser?.username ? 'you' : ''}`;
      li.innerHTML = `
        <div class="user-avatar" style="background-color: ${u.color}">
          ${escapeHTML(u.username.charAt(0).toUpperCase())}
        </div>
        <span class="user-name">${escapeHTML(u.username)} ${u.username === currentUser?.username ? '(You)' : ''}</span>
      `;
      userList.appendChild(li);

      // Stacked avatar in header (first 5 users)
      if (index < 5) {
        const av = document.createElement('div');
        av.className = 'avatar-stack-item';
        av.style.backgroundColor = u.color;
        av.textContent = u.username.charAt(0).toUpperCase();
        av.title = u.username;
        headerAvatars.appendChild(av);
      }
    });
  });

  // System Message
  socket.on('system:message', (msg) => {
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-msg';
    sysDiv.innerHTML = `<span>${escapeHTML(msg.text)} • ${formatTime(msg.timestamp)}</span>`;
    messageContainer.appendChild(sysDiv);
    scrollToBottom();
  });

  // Incoming Text Message
  socket.on('message:new', (msg) => {
    const isOutgoing = msg.sender.username === currentUser?.username;
    
    const msgWrapper = document.createElement('div');
    msgWrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgWrapper.setAttribute('data-id', msg.id);
    
    msgWrapper.innerHTML = `
      <div class="msg-avatar" style="background-color: ${msg.sender.color}">
        ${escapeHTML(msg.sender.username.charAt(0).toUpperCase())}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-sender">${escapeHTML(msg.sender.username)}</span>
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
          <button class="msg-delete-btn" data-id="${msg.id}" title="Delete Message">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="msg-bubble">
          ${escapeHTML(msg.text)}
        </div>
      </div>
    `;

    // Bind delete button
    msgWrapper.querySelector('.msg-delete-btn').addEventListener('click', () => {
      if (confirm('Delete this message for everyone?')) {
        socket.emit('message:delete', { id: msg.id });
      }
    });

    messagesStore.global.push(msgWrapper);
    if (activeChannel === 'global') {
      messageContainer.appendChild(msgWrapper);
      scrollToBottom();
    }
  });

  // Incoming Shared Files
  socket.on('file:new', (msg) => {
    const isOutgoing = msg.sender.username === currentUser?.username;

    const msgWrapper = document.createElement('div');
    msgWrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgWrapper.setAttribute('data-id', msg.id);

    let filesHTML = '';
    msg.files.forEach(file => {
      const categoryIcon = getCategoryIcon(file.category);
      
      filesHTML += `
        <div class="file-card">
          <div class="file-icon-box ${file.category}">
            <i class="fa-solid ${categoryIcon}"></i>
          </div>
          <div class="file-info">
            <div class="file-name">${escapeHTML(file.originalName)}</div>
            <div class="file-meta">${formatBytes(file.size)} • ${file.category.toUpperCase()}</div>
          </div>
          <a href="${file.url}" download="${escapeHTML(file.originalName)}" class="file-action-btn" title="Download File">
            <i class="fa-solid fa-download"></i>
          </a>
        </div>
      `;

      // Inline Media Previews
      if (file.category === 'image') {
        filesHTML += `
          <div class="media-preview-container">
            <img src="${file.url}" alt="${escapeHTML(file.originalName)}" class="preview-img" data-url="${file.url}" data-name="${escapeHTML(file.originalName)}">
          </div>
        `;
      } else if (file.category === 'video') {
        filesHTML += `
          <div class="media-preview-container">
            <video src="${file.url}" controls preload="metadata"></video>
          </div>
        `;
      } else if (file.category === 'audio') {
        filesHTML += `
          <div class="media-preview-container">
            <audio src="${file.url}" controls preload="metadata"></audio>
          </div>
        `;
      }
    });

    const captionHTML = msg.caption ? `<div class="msg-bubble" style="margin-bottom: 6px;">${escapeHTML(msg.caption)}</div>` : '';

    msgWrapper.innerHTML = `
      <div class="msg-avatar" style="background-color: ${msg.sender.color}">
        ${escapeHTML(msg.sender.username.charAt(0).toUpperCase())}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-sender">${escapeHTML(msg.sender.username)}</span>
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
          <button class="msg-delete-btn" data-id="${msg.id}" title="Delete Shared File">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        ${captionHTML}
        <div class="files-grid">
          ${filesHTML}
        </div>
      </div>
    `;

    // Bind delete button
    msgWrapper.querySelector('.msg-delete-btn').addEventListener('click', () => {
      if (confirm('Delete this file and message for everyone?')) {
        socket.emit('message:delete', { id: msg.id });
      }
    });

    // Bind Image Lightbox click event
    msgWrapper.querySelectorAll('.preview-img').forEach(img => {
      img.addEventListener('click', () => {
        lightboxImg.src = img.getAttribute('data-url');
        lightboxFilename.textContent = img.getAttribute('data-name');
        lightboxDownload.href = img.getAttribute('data-url');
        lightboxDownload.download = img.getAttribute('data-name');
        lightboxModal.classList.remove('hidden');
      });
    });

    messagesStore.global.push(msgWrapper);
    if (activeChannel === 'global') {
      messageContainer.appendChild(msgWrapper);
      scrollToBottom();
    }
  });

  // Incoming AI Channel Message
  socket.on('ai:message:new', (msg) => {
    const isOutgoing = msg.sender.username === currentUser?.username;
    const isAiBot = msg.sender.isAi;

    const msgWrapper = document.createElement('div');
    msgWrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgWrapper.setAttribute('data-id', msg.id);

    const modelTagHTML = isAiBot ? `<span class="ai-model-tag">${msg.sender.model || 'Gemini AI'}</span>` : '';
    const bubbleHTML = isAiBot ? parseMarkdown(msg.text) : escapeHTML(msg.text);

    msgWrapper.innerHTML = `
      <div class="msg-avatar" style="background-color: ${msg.sender.color}">
        ${isAiBot ? '<i class="fa-solid fa-robot"></i>' : escapeHTML(msg.sender.username.charAt(0).toUpperCase())}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-sender">${escapeHTML(msg.sender.username)}</span>
          ${modelTagHTML}
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
          <button class="msg-delete-btn" data-id="${msg.id}" title="Delete Message">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="msg-bubble">
          ${bubbleHTML}
        </div>
      </div>
    `;

    msgWrapper.querySelector('.msg-delete-btn').addEventListener('click', () => {
      if (confirm('Delete this AI chat message?')) {
        socket.emit('message:delete', { id: msg.id });
      }
    });

    messagesStore.ai.push(msgWrapper);
    if (activeChannel === 'ai') {
      messageContainer.appendChild(msgWrapper);
      scrollToBottom();
    }
  });

  // AI Typing Status
  socket.on('ai:typing', ({ isTyping, username }) => {
    if (isTyping && activeChannel === 'ai') {
      typingText.textContent = `${username} is generating answer...`;
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
  });

  // AI Sessions List Update Listener
  socket.on('ai:session:list:update', (sessions) => {
    if (!aiSessionList) return;
    aiSessionList.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'ai-session-item';
      emptyLi.style.justifyContent = 'center';
      emptyLi.style.opacity = '0.6';
      emptyLi.innerHTML = `<span class="session-title">No threads yet</span>`;
      aiSessionList.appendChild(emptyLi);
      return;
    }

    sessions.forEach(session => {
      const li = document.createElement('li');
      const isActive = session.id === aiSessionId;
      li.className = `ai-session-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-session-id', session.id);

      li.innerHTML = `
        <span class="session-title">
          <i class="fa-solid fa-message"></i>
          ${escapeHTML(session.title || 'Conversation')}
        </span>
        <button class="delete-session-btn" data-session-id="${session.id}" title="Delete Thread">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;

      // Select session on click
      li.addEventListener('click', (e) => {
        if (e.target.closest('.delete-session-btn')) return;
        selectAiSession(session.id);
      });

      // Delete session on click
      li.querySelector('.delete-session-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete AI Thread "${session.title}"?`)) {
          socket.emit('ai:session:delete', { sessionId: session.id });
          if (session.id === aiSessionId) {
            createNewAiSession();
          }
        }
      });

      aiSessionList.appendChild(li);
    });
  });

  function selectAiSession(sessionId) {
    aiSessionId = sessionId;
    localStorage.setItem('yogesh_ai_session_id', aiSessionId);

    socket.emit('ai:session:select', { sessionId }, (res) => {
      if (res && res.success && res.session) {
        messagesStore.ai = [];
        if (res.session.messages) {
          res.session.messages.forEach(msg => {
            const isOutgoing = msg.sender.username === currentUser?.username;
            const isAiBot = msg.sender.isAi;

            const msgWrapper = document.createElement('div');
            msgWrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
            msgWrapper.setAttribute('data-id', msg.id);

            const modelTagHTML = isAiBot ? `<span class="ai-model-tag">${msg.sender.model || 'Gemini AI'}</span>` : '';
            const bubbleHTML = isAiBot ? parseMarkdown(msg.text) : escapeHTML(msg.text);

            msgWrapper.innerHTML = `
              <div class="msg-avatar" style="background-color: ${msg.sender.color}">
                ${isAiBot ? '<i class="fa-solid fa-robot"></i>' : escapeHTML(msg.sender.username.charAt(0).toUpperCase())}
              </div>
              <div class="msg-body">
                <div class="msg-header">
                  <span class="msg-sender">${escapeHTML(msg.sender.username)}</span>
                  ${modelTagHTML}
                  <span class="msg-time">${formatTime(msg.timestamp)}</span>
                  <button class="msg-delete-btn" data-id="${msg.id}" title="Delete Message">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
                <div class="msg-bubble">
                  ${bubbleHTML}
                </div>
              </div>
            `;

            msgWrapper.querySelector('.msg-delete-btn').addEventListener('click', () => {
              if (confirm('Delete this AI chat message?')) {
                socket.emit('message:delete', { id: msg.id });
              }
            });

            messagesStore.ai.push(msgWrapper);
          });
        }
        renderChannelMessages();
        socket.emit('ai:session:list');
      }
    });
  }

  // Realtime Message Deletion Listener
  socket.on('message:deleted', ({ id }) => {
    messagesStore.global = messagesStore.global.filter(node => node.getAttribute('data-id') !== id);
    messagesStore.ai = messagesStore.ai.filter(node => node.getAttribute('data-id') !== id);

    const elem = document.querySelector(`.msg-wrapper[data-id="${id}"]`);
    if (elem) {
      elem.style.transition = 'all 0.3s ease';
      elem.style.opacity = '0';
      elem.style.transform = 'scale(0.9)';
      setTimeout(() => elem.remove(), 300);
    }
  });

  // Typing Update
  socket.on('typing:update', (typingUsernames) => {
    const othersTyping = typingUsernames.filter(name => name !== currentUser?.username);
    if (othersTyping.length > 0) {
      if (othersTyping.length === 1) {
        typingText.textContent = `${othersTyping[0]} is typing...`;
      } else {
        typingText.textContent = `${othersTyping.join(', ')} are typing...`;
      }
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
  });

  // Lightbox Close
  closeLightboxBtn.addEventListener('click', () => lightboxModal.classList.add('hidden'));
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) lightboxModal.classList.add('hidden');
  });
});
