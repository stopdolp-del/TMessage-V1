const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const isAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.get('/users', authenticateToken, isAdmin, (req, res) => {
  try {
    db.all(
      "SELECT id, username, email, is_banned, ban_reason, created_at FROM users ORDER BY created_at DESC",
      [],
      (err, users) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
      }
    );
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/ban', authenticateToken, isAdmin, (req, res) => {
  try {
    const { username, reason } = req.body;

    if (!username || !reason) {
      return res.status(400).json({ error: 'Username and reason required' });
    }

    db.run(
      "UPDATE users SET is_banned = 1, ban_reason = ? WHERE username = ?",
      [reason, username],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Ban failed' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: `User ${username} banned` });
      }
    );
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unban', authenticateToken, isAdmin, (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    db.run(
      "UPDATE users SET is_banned = 0, ban_reason = NULL WHERE username = ?",
      [username],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Unban failed' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: `User ${username} unbanned` });
      }
    );
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
