const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  const operators = ['+', '-', '*'];
  const operator = operators[Math.floor(Math.random() * 3)];
  
  let answer;
  if (operator === '+') answer = num1 + num2;
  else if (operator === '-') answer = num1 - num2;
  else answer = num1 * num2;
  
  return {
    question: `${num1} ${operator} ${num2}`,
    answer: answer.toString()
  };
};

router.post('/captcha', (req, res) => {
  try {
    const captcha = generateCaptcha();
    res.json({
      question: captcha.question,
      id: Math.random().toString(36).substr(2, 9)
    });
  } catch (error) {
    console.error('Captcha generation error:', error);
    res.status(500).json({ error: 'Error generating captcha' });
  }
});

router.post('/register', (req, res) => {
  try {
    const { username, email, password, captcha_answer } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be 3+ characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be 6+ characters' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          console.error('Database insert error:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        const newUser = { id: this.lastID, username, email, is_admin: 0 };
        const token = generateToken(newUser);

        res.json({ 
          success: true, 
          message: 'Registered successfully',
          token,
          user: { id: newUser.id, username: newUser.username }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.is_banned) {
        return res.status(403).json({ error: `Banned: ${user.ban_reason || 'No reason provided'}` });
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);
      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { 
          id: user.id, 
          username: user.username,
          is_admin: user.is_admin 
        }
      });
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
