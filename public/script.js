class TMessageApp {
  constructor() {
    this.user = null;
    this.token = null;
    this.ws = null;
    this.apiBase = '/api';
    this.currentCaptchaAnswer = null;

    this.init();
  }

  init() {
    this.checkAuth();
    this.attachEventListeners();
  }

  // Auth Management
  checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      this.token = token;
      this.user = JSON.parse(user);
      this.showChatView();
      this.connect();
    } else {
      this.showAuthView();
      this.generateNewCaptcha();
    }
  }

  async generateNewCaptcha() {
    try {
      const response = await fetch(`${this.apiBase}/auth/captcha`, { method: 'POST' });
      const data = await response.json();
      this.currentCaptchaAnswer = data.answer;
      document.getElementById('captchaQuestion').textContent = data.question;
      document.getElementById('captchaAnswer').value = '';
    } catch (error) {
      this.showError('captchaError', 'Failed to load captcha');
    }
  }

  async handleLogin(email, password) {
    try {
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        this.showChatView();
        this.connect();
      } else {
        this.showError('loginError', data.error || 'Login failed');
      }
    } catch (error) {
      this.showError('loginError', 'Server error');
    }
  }

  async handleRegister(username, email, password, captchaAnswer) {
    try {
      if (captchaAnswer !== this.currentCaptchaAnswer) {
        return this.showError('registerError', 'Captcha answer incorrect');
      }

      const response = await fetch(`${this.apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, captcha_answer: captchaAnswer })
      });
      const data = await response.json();

      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        this.showChatView();
        this.connect();
      } else {
        this.showError('registerError', data.error || 'Registration failed');
      }
    } catch (error) {
      this.showError('registerError', 'Server error');
    }
  }

  handleLogout() {
    if (this.ws) this.ws.close();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.user = null;
    this.token = null;
    this.showAuthView();
    this.generateNewCaptcha();
  }

  // Chat Management
  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host;
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        this.ws.send(JSON.stringify({
          type: 'auth',
          userId: this.user.id
        }));
        this.loadMessages();
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'message') {
            this.displayMessage(msg.data);
          } else if (msg.type === 'userStatus') {
            this.updateOnlineCount(msg.activeUsers.length);
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      this.ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.addEventListener('close', () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(() => this.connect(), 3000);
      });
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setTimeout(() => this.connect(), 3000);
    }
  }

  async loadMessages() {
    try {
      const response = await fetch(`${this.apiBase}/messages`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const messages = await response.json();

      const container = document.getElementById('messagesContainer');
      container.innerHTML = '';

      messages.forEach(msg => {
        this.displayMessage({
          senderId: msg.sender_id,
          senderName: msg.username,
          content: msg.content,
          timestamp: msg.created_at
        });
      });

      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  displayMessage(msg) {
    const container = document.getElementById('messagesContainer');
    const isOwn = msg.senderId === this.user.id;

    const messageEl = document.createElement('div');
    messageEl.classList.add('message');
    if (isOwn) messageEl.classList.add('own');

    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (!isOwn) {
      messageEl.innerHTML = `
        <div class="message-avatar">${msg.senderName.charAt(0).toUpperCase()}</div>
        <div class="message-bubble">
          <div class="message-username">${this.escapeHtml(msg.senderName)}</div>
          <div class="message-content">${this.escapeHtml(msg.content)}</div>
          <div class="message-time">${time}</div>
        </div>
      `;
    } else {
      messageEl.innerHTML = `
        <div class="message-bubble">
          <div class="message-content">${this.escapeHtml(msg.content)}</div>
          <div class="message-time">${time}</div>
        </div>
        <div class="message-avatar">${msg.senderName.charAt(0).toUpperCase()}</div>
      `;
    }

    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
  }

  sendMessage(content) {
    if (!content.trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'message',
      userId: this.user.id,
      content: content.trim()
    }));

    document.getElementById('messageInput').value = '';
  }

  updateOnlineCount(count) {
    document.getElementById('onlineCount').textContent = `${count} online`;
  }

  // Profile Management
  async loadProfile() {
    try {
      const response = await fetch(`${this.apiBase}/users/profile/${this.user.id}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const profile = await response.json();

      document.getElementById('profileUsername').value = profile.username || this.user.username;
      document.getElementById('profileBio').value = profile.bio || '';
      document.getElementById('profileAvatar').textContent = (profile.username || this.user.username).charAt(0).toUpperCase();
      document.getElementById('sidebarUsername').textContent = profile.username || this.user.username;
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  async updateProfile(username, bio) {
    try {
      const response = await fetch(`${this.apiBase}/users/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ username, bio })
      });
      const data = await response.json();

      if (response.ok) {
        this.showMsg('profileMsg', 'Profile updated successfully', 'success');
        this.user.username = username;
        localStorage.setItem('user', JSON.stringify(this.user));
      } else {
        this.showMsg('profileMsg', data.error, 'error');
      }
    } catch (error) {
      this.showMsg('profileMsg', 'Server error', 'error');
    }
  }

  async uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${this.apiBase}/users/upload-avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        document.getElementById('profileAvatar').style.backgroundImage = `url('${data.avatar}')`;
        this.showMsg('profileMsg', 'Avatar updated', 'success');
      } else {
        this.showMsg('profileMsg', data.error, 'error');
      }
    } catch (error) {
      this.showMsg('profileMsg', 'Upload failed', 'error');
    }
  }

  // Admin Panel
  async loadAdminPanel() {
    try {
      const response = await fetch(`${this.apiBase}/admin/users`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const users = await response.json();

      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = '';

      users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${this.escapeHtml(user.username)}</td>
          <td>${this.escapeHtml(user.email)}</td>
          <td>
            <span class="status-badge ${user.is_banned ? 'banned' : 'active'}">
              ${user.is_banned ? 'BANNED' : 'ACTIVE'}
            </span>
          </td>
          <td>
            <div class="action-buttons">
              ${!user.is_banned ? `<button class="btn-ban" onclick="app.showBanModal('${user.username}', '${user.id}')">Ban</button>` : `<button class="btn-unban" onclick="app.unbanUser('${user.username}')">Unban</button>`}
            </div>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  showBanModal(username, userId) {
    const modal = document.getElementById('banModal');
    document.getElementById('banUsername').textContent = `Ban ${username}?`;
    document.getElementById('banUserId').value = username;
    document.getElementById('banReason').value = '';
    modal.classList.remove('hidden');
  }

  async banUser(username, reason) {
    try {
      const response = await fetch(`${this.apiBase}/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ username, reason })
      });
      const data = await response.json();

      if (response.ok) {
        document.getElementById('banModal').classList.add('hidden');
        this.loadAdminPanel();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Ban failed');
    }
  }

  async unbanUser(username) {
    if (!confirm(`Unban ${username}?`)) return;

    try {
      const response = await fetch(`${this.apiBase}/admin/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ username })
      });
      const data = await response.json();

      if (response.ok) {
        this.loadAdminPanel();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Unban failed');
    }
  }

  // UI Management
  showAuthView() {
    document.getElementById('authView').classList.add('active');
    document.getElementById('chatView').classList.remove('active');
  }

  showChatView() {
    document.getElementById('authView').classList.remove('active');
    document.getElementById('chatView').classList.add('active');

    this.loadProfile();

    if (this.user.is_admin) {
      document.getElementById('adminPanelBtn').classList.remove('hidden');
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    if (tabName === 'admin') {
      this.loadAdminPanel();
    }
  }

  switchAuthTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
  }

  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
    }
  }

  showMsg(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.classList.remove('success', 'error');
      el.classList.add(type);
    }
  }

  showEmojiPicker() {
    const modal = document.getElementById('emojiModal');
    modal.classList.toggle('hidden');
  }

  insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiModal').classList.add('hidden');
  }

  // Utilities
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Event Listeners
  attachEventListeners() {
    // Auth Events
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      this.handleLogin(email, password);
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;
      const captcha = document.getElementById('captchaAnswer').value;
      this.handleRegister(username, email, password, captcha);
    });

    document.getElementById('newCaptchaBtn').addEventListener('click', () => this.generateNewCaptcha());

    // Chat Events
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('sendBtn').addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      this.sendMessage(input.value);
    });

    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage(e.target.value);
      }
    });

    document.getElementById('emojiBtn').addEventListener('click', () => this.showEmojiPicker());

    // Profile Events
    document.getElementById('profileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('profileUsername').value;
      const bio = document.getElementById('profileBio').value;
      this.updateProfile(username, bio);
    });

    document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });

    document.getElementById('avatarInput').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.uploadAvatar(e.target.files[0]);
      }
    });

    // Admin Events
    document.getElementById('confirmBanBtn').addEventListener('click', () => {
      const username = document.getElementById('banUserId').value;
      const reason = document.getElementById('banReason').value;
      if (!reason) {
        alert('Please provide a ban reason');
        return;
      }
      this.banUser(username, reason);
    });

    document.getElementById('cancelBanBtn').addEventListener('click', () => {
      document.getElementById('banModal').classList.add('hidden');
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // Emoji Grid
    const emojiList = '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😌😔😑😐😏😒🙁😞😖😤😠🤬😤😡😠🤯😳😨😰😢😭😱😖😣😞😓😩😫🥱☺️😉😊🙂🙃😌😔😑😐😏😒🙁😞😖😢😩😫🥺😠😠😡😤🤬😠😠🤯😳😥😰😨😰😅😓😭😱😷🤒🤕🤑😦😧😕🙁😧😔😞😲😣😥😔';

    const emojiGrid = document.getElementById('emojiGrid');
    emojiGrid.innerHTML = '';
    emojiList.split('').forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.insertEmoji(emoji);
      });
      emojiGrid.appendChild(btn);
    });
  }
}

const app = new TMessageApp();
