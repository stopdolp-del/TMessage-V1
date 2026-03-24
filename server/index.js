const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const path = require('path');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use(express.static(require('path').join(__dirname, '../public')));

const connectedUsers = new Map();

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'auth') {
        userId = message.userId;
        connectedUsers.set(userId, ws);
        
        broadcastUserStatus();
        return;
      }

      if (message.type === 'message' && userId) {
        db.get("SELECT username FROM users WHERE id = ?", [userId], (err, user) => {
          if (err || !user) return;

          const chatMessage = {
            id: Date.now(),
            senderId: userId,
            senderName: user.username,
            content: message.content,
            timestamp: new Date().toISOString()
          };

          db.run(
            "INSERT INTO messages (sender_id, content) VALUES (?, ?)",
            [userId, message.content],
            (err) => {
              if (!err) {
                broadcast({
                  type: 'message',
                  data: chatMessage
                });
              }
            }
          );
        });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      connectedUsers.delete(userId);
      broadcastUserStatus();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const broadcastUserStatus = () => {
  broadcast({
    type: 'userStatus',
    activeUsers: Array.from(connectedUsers.keys())
  });
};

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  try {
    res.json({ ok: true });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

app.get('/api/messages', authenticateToken, (req, res) => {
  try {
    db.all(
      `SELECT m.id, m.sender_id, u.username, m.content, m.created_at 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       ORDER BY m.created_at ASC LIMIT 100`,
      [],
      (err, messages) => {
        if (err) {
          console.error('Message fetch error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(messages);
      }
    );
  } catch (error) {
    console.error('Messages route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
