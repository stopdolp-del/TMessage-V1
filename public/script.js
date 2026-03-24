class TMessageApp {
  constructor() {
    this.user = null;
    this.token = null;
    this.ws = null;
    this.apiBase = '/api';
    this.captcha = { question: '', answer: '' };
    this.init();
  }

  init() {
    this.checkAuth();
    this.attachEventListeners();
  }

  // ============ CAPTCHA (Client-side) ============
  generateCaptcha() {
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * 3)];

    let answer;
    if (operator === '+') answer = num1 + num2;
    else if (operator === '-') answer = num1 - num2;
    else answer = num1 * num2;

    this.captcha = {
      question: `${num1} ${operator} ${num2}`,
      answer: answer.toString()
    };

    document.getElementById('captchaQuestion').textContent = this.captcha.question;
    document.getElementById('captchaAnswer').value = '';
  }

  // ============ AUTH MANAGEMENT ============
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
      this.generateCaptcha();
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
        this.displayError('loginError', data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.displayError('loginError', 'Connection error. Try again.');
    }
  }

  async handleRegister(username, email, password, captchaAnswer) {
    try {
      if (captchaAnswer !== this.captcha.answer) {
        this.displayError('registerError', 'Wrong answer! Try again.');
        this.generateCaptcha();
        return;
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
        this.displayError('registerError', data.error || 'Registration failed');
        this.generateCaptcha();
      }
    } catch (error) {
      console.error('Register error:', error);
      this.displayError('registerError', 'Connection error. Try again.');
      this.generateCaptcha();
    }
  }

  handleLogout() {
    if (this.ws) this.ws.close();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.user = null;
    this.token = null;
    this.showAuthView();
    this.generateCaptcha();
  }

  // ============ CHAT MANAGEMENT ============
  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host;
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener('open', () => {
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
        } catch (e) {
          console.error('Message parse error:', e);
        }
      });

      this.ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.addEventListener('close', () => {
        setTimeout(() => this.connect(), 3000);
      });
    } catch (error) {
      console.error('Connection error:', error);
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

      if (messages.length === 0) {
        container.innerHTML = '<div class="messages-loading">No messages yet. Start chatting!</div>';
      } else {
        messages.forEach(msg => {
          this.displayMessage({
            senderId: msg.sender_id,
            senderName: msg.username,
            content: msg.content,
            timestamp: msg.created_at
          });
        });
      }

      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Load messages error:', error);
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
        <div class="message-avatar">${this.escapeHtml(msg.senderName).charAt(0).toUpperCase()}</div>
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
      `;
    }

    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
  }

  sendMessage(content) {
    if (!content.trim()) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.displayError('chatError', 'Not connected. Reconnecting...');
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

  // ============ PROFILE MANAGEMENT ============
  async loadProfile() {
    try {
      const response = await fetch(`${this.apiBase}/users/profile/${this.user.id}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const profile = await response.json();

      const username = profile.username || this.user.username;
      document.getElementById('profileUsername').value = username;
      document.getElementById('profileBio').value = profile.bio || '';
      document.getElementById('profileAvatar').textContent = username.charAt(0).toUpperCase();
      document.getElementById('sidebarUsername').textContent = username;
    } catch (error) {
      console.error('Load profile error:', error);
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
        this.displayStatus('profileMsg', 'Profile updated ✓', 'success');
        this.user.username = username;
        localStorage.setItem('user', JSON.stringify(this.user));
      } else {
        this.displayStatus('profileMsg', data.error || 'Update failed', 'error');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      this.displayStatus('profileMsg', 'Connection error', 'error');
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
        document.getElementById('profileAvatar').textContent = '✓';
        this.displayStatus('profileMsg', 'Avatar uploaded ✓', 'success');
      } else {
        this.displayStatus('profileMsg', data.error || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload avatar error:', error);
      this.displayStatus('profileMsg', 'Connection error', 'error');
    }
  }

  // ============ ADMIN PANEL ============
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
          <td><span class="status-badge ${user.is_banned ? 'banned' : 'active'}">${user.is_banned ? 'BANNED' : 'ACTIVE'}</span></td>
          <td>
            <div class="action-buttons">
              ${!user.is_banned ? `<button class="btn-ban" onclick="app.showBanModal('${user.username}')">Ban</button>` : `<button class="btn-unban" onclick="app.unbanUser('${user.username}')">Unban</button>`}
            </div>
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error('Load admin panel error:', error);
    }
  }

  showBanModal(username) {
    document.getElementById('banUsername').textContent = `Ban ${username}?`;
    document.getElementById('banUserId').value = username;
    document.getElementById('banReason').value = '';
    document.getElementById('banModal').classList.remove('hidden');
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
        this.displayError('banError', data.error || 'Ban failed');
      }
    } catch (error) {
      console.error('Ban user error:', error);
      this.displayError('banError', 'Connection error');
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
        this.displayError('unbanError', data.error || 'Unban failed');
      }
    } catch (error) {
      console.error('Unban user error:', error);
      this.displayError('unbanError', 'Connection error');
    }
  }

  // ============ UI MANAGEMENT ============
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

  displayError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  displayStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.classList.remove('success', 'error');
      el.classList.add(type);
    }
  }

  showEmojiPicker() {
    document.getElementById('emojiModal').classList.toggle('hidden');
  }

  insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
    document.getElementById('emojiModal').classList.add('hidden');
  }

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

  // ============ EVENT LISTENERS ============
  attachEventListeners() {
    // Auth tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      if (email && password) this.handleLogin(email, password);
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value.trim();
      const answer = document.getElementById('captchaAnswer').value.trim();
      if (username && email && password && answer) {
        this.handleRegister(username, email, password, answer);
      }
    });

    document.getElementById('newCaptchaBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.generateCaptcha();
    });

    // Chat
    document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('sendBtn').addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      this.sendMessage(input.value);
    });

    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(e.target.value);
      }
    });

    document.getElementById('emojiBtn').addEventListener('click', () => this.showEmojiPicker());

    // Profile
    document.getElementById('profileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('profileUsername').value.trim();
      const bio = document.getElementById('profileBio').value.trim();
      if (username) this.updateProfile(username, bio);
    });

    document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });

    document.getElementById('avatarInput').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.uploadAvatar(e.target.files[0]);
      }
    });

    // Admin
    document.getElementById('confirmBanBtn').addEventListener('click', () => {
      const username = document.getElementById('banUserId').value;
      const reason = document.getElementById('banReason').value.trim();
      if (username && reason) {
        this.banUser(username, reason);
      } else {
        this.displayError('banError', 'Reason required');
      }
    });

    document.getElementById('cancelBanBtn').addEventListener('click', () => {
      document.getElementById('banModal').classList.add('hidden');
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // Emoji grid
    const emojiList = '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙🥲😋😛😜🤪😌😔😑😐😏😒🙁😞😖😤😠🤬😡🤯😳😨😰😢😭😱😷🤒🤕😵🤮🤢😲😮';
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
