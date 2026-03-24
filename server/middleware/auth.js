const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'tmessage_secret_key_2024';

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        console.error('Token verification error:', err);
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
};

module.exports = { authenticateToken, generateToken, SECRET_KEY };
