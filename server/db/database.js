const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tmessage.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('Users table error:', err);
});

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) console.error('Messages table error:', err);
});

// Insert admin user on startup if not exists
db.get("SELECT * FROM users WHERE username = 'stopdolp'", (err, row) => {
  if (err) {
    console.error('Admin check error:', err);
  } else if (!row) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(
      "INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
      ['stopdolp', 'admin@tmessage.com', hashedPassword, 1],
      (err) => {
        if (err) console.error('Admin user creation error:', err);
        else console.log('Admin user initialized');
      }
    );
  }
});

module.exports = db;
