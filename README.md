# TMessage - Real-time Chat Application

A modern, real-time messaging application with admin panel, user authentication, and emoji support.

## Quick Start

### Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser and navigate to: `http://localhost:3000`

## Features

- **Real-time Messaging** - WebSocket-powered instant messaging
- **User Authentication** - Register/Login with JWT tokens
- **Dynamic Captcha** - Math-based verification during registration
- **User Profiles** - Username, avatar upload, bio
- **Emoji Picker** - Insert emojis in messages
- **Admin Panel** - Manage users, ban/unban with reasons
- **Responsive Design** - Mobile-friendly dark UI
- **Online Status** - See active users count

## Admin Account

- Username: `stopdolp`
- Password: `admin123`

## Project Structure

```
TMessage/
├── server/
│   ├── index.js           # Main server file
│   ├── package.json       # Dependencies
│   ├── db/
│   │   └── database.js    # SQLite setup
│   ├── middleware/
│   │   └── auth.js        # JWT authentication
│   └── routes/
│       ├── auth.js        # Login/Register
│       ├── users.js       # Profile management
│       └── admin.js       # Admin operations
└── public/
    ├── index.html         # Main HTML
    ├── style.css          # Dark theme styles
    └── script.js          # Frontend logic
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/captcha` - Generate math captcha

### Users
- `GET /api/users/profile/:userId` - Get user profile
- `POST /api/users/profile/update` - Update profile
- `POST /api/users/upload-avatar` - Upload avatar
- `GET /api/users/all` - Get all active users

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/ban` - Ban user with reason
- `POST /api/admin/unban` - Unban user

### Chat
- `GET /api/messages` - Get message history
- WebSocket `/` - Real-time messaging

## Tech Stack

- **Backend**: Node.js, Express, WebSocket (ws)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: SQLite3
- **Security**: JWT, bcryptjs, CORS

## Error Handling

All endpoints include comprehensive error handling with proper HTTP status codes and error messages.

## Notes

- All user passwords are hashed with bcryptjs
- JWT tokens expire in 24 hours
- Maximum message length: 500 characters
- Maximum avatar size: 5MB
- Banned users cannot login

Start the server and visit `http://localhost:3000` to begin chatting!
