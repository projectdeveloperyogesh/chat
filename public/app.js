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
    
    msgWrapper.innerHTML = `
      <div class="msg-avatar" style="background-color: ${msg.sender.color}">
        ${escapeHTML(msg.sender.username.charAt(0).toUpperCase())}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-sender">${escapeHTML(msg.sender.username)}</span>
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="msg-bubble">
          ${escapeHTML(msg.text)}
        </div>
      </div>
    `;

    messageContainer.appendChild(msgWrapper);
    scrollToBottom();
  });

  // Incoming Shared Files
  socket.on('file:new', (msg) => {
    const isOutgoing = msg.sender.username === currentUser?.username;

    const msgWrapper = document.createElement('div');
    msgWrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;

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
        </div>
        ${captionHTML}
        <div class="files-grid">
          ${filesHTML}
        </div>
      </div>
    `;

    messageContainer.appendChild(msgWrapper);

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

    scrollToBottom();
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
