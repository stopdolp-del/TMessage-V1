const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');

const router = express.Router();

router.get('/profile/:userId', authenticateToken, (req, res) => {
  try {
    const userId = req.params.userId;

    db.get(
      "SELECT id, username, avatar, bio, is_banned FROM users WHERE id = ?",
      [userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
      }
    );
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/profile/update', authenticateToken, (req, res) => {
  try {
    const { username, bio } = req.body;
    const userId = req.user.id;

    db.run(
      "UPDATE users SET username = ?, bio = ? WHERE id = ?",
      [username || req.user.username, bio || '', userId],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Username already taken' });
          }
          return res.status(500).json({ error: 'Update failed' });
        }

        res.json({ success: true, message: 'Profile updated' });
      }
    );
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/upload-avatar', authenticateToken, (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatar = req.files.avatar;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

    if (!allowedTypes.includes(avatar.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (avatar.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 5MB)' });
    }

    const fileName = `avatar_${req.user.id}_${Date.now()}.${avatar.mimetype.split('/')[1]}`;
    const uploadPath = path.join(__dirname, '../public/uploads', fileName);

    avatar.mv(uploadPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Upload failed' });
      }

      db.run(
        "UPDATE users SET avatar = ? WHERE id = ?",
        [`/uploads/${fileName}`, req.user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ success: true, avatar: `/uploads/${fileName}` });
        }
      );
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/all', authenticateToken, (req, res) => {
  try {
    db.all(
      "SELECT id, username, avatar, bio, is_banned FROM users WHERE is_banned = 0",
      [],
      (err, users) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
      }
    );
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
