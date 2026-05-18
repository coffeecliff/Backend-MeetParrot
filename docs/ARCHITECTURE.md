# System Architecture Documentation

## Overview
MeetStranger is a real-time P2P anonymous chat system built with Node.js, SQLite, and WebSocket technology.

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Real-time**: Socket.IO
- **Authentication**: JWT + bcrypt
- **Validation**: Joi
- **Security**: Helmet + CORS
- **Rate Limiting**: express-rate-limit

### Development Tools
- **Testing**: Jest + Supertest + Custom test scripts
- **Process Manager**: Nodemon
- **Documentation**: Swagger UI

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Client App    │    │   Client App    │
│   (React/RN)    │    │   (React/RN)    │    │   (React/RN)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ HTTP/WebSocket       │ HTTP/WebSocket       │ HTTP/WebSocket
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Express Server        │
                    │   (Port 3000)            │
                    │                          │
                    │  ┌─────────────────────┐ │
                    │  │   HTTP Routes       │ │
                    │  │   - /api/auth       │ │
                    │  │   - /api/matching   │ │
                    │  │   - /api/health     │ │
                    │  └─────────────────────┘ │
                    │                          │
                    │  ┌─────────────────────┐ │
                    │  │   WebSocket         │ │
                    │  │   - Authentication  │ │
                    │  │   - P2P Matching    │ │
                    │  │   - Real-time Chat  │ │
                    │  └─────────────────────┘ │
                    └─────────────┬─────────────┘
                                  │
                     ┌─────────────┴─────────────┐
                     │      SQLite Database      │
                     │                           │
                     │  ┌─────────────────────┐  │
                     │  │   users table       │  │
                     │  │   - id (PK)         │  │
                     │  │   - username        │  │
                     │  │   - email           │  │
                     │  │   - password        │  │
                     │  │   - is_online       │  │
                     │  │   - created_at      │  │
                     │  │   - last_login      │  │
                     │  └─────────────────────┘  │
                     └───────────────────────────┘
```

## Data Flow

### 1. User Registration/Login
```
Client → POST /api/auth/register → Validate → Hash Password → Store in DB → Return JWT
Client → POST /api/auth/login → Validate → Check Password → Update Online Status → Return JWT
```

### 2. P2P Matching Flow
```
Client A → WebSocket authenticate → join_queue(category) → Add to queue
Client B → WebSocket authenticate → join_queue(category) → Match found!
Server → Create room → Notify both clients → match_found event
```

### 3. Chat Flow
```
Client A → join_room(roomId) → Validate room access → Join room
Client B → join_room(roomId) → Validate room access → Join room
Client A → send_message(content) → Broadcast to room → Client B receives
```

### 4. Disconnection Flow
```
Client A → Disconnect/Leave → Remove from room → Notify Client B
Client B → Receives partner_left → Auto-reconnect to queue → Find new match
```

## Directory Structure

```
backend/
├── docs/                    # Documentation
│   ├── API.md
│   ├── WEBSOCKET.md
│   ├── ARCHITECTURE.md
│   ├── index.html
│   └── swagger.yaml
├── src/
│   ├── controllers/         # Route handlers
│   │   ├── auth.controller.js
│   │   ├── chat.controller.js
│   │   └── matching.controller.js
│   ├── database/           # Database layer
│   │   └── database.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validation.middleware.js
│   ├── routes/             # API routes
│   │   ├── auth.routes.js
│   │   ├── chat.routes.js
│   │   └── matching.routes.js
│   ├── services/           # Business logic
│   │   ├── auth.service.js
│   │   ├── matching.service.js
│   │   └── websocket.service.js
│   ├── app.js              # Express app setup
│   └── app.test.js         # Jest tests
├── tests/                  # Test files
│   ├── api-test.js         # Complete API tests
│   ├── quick-test-safe.js  # Quick tests
│   └── setup.js            # Test setup
├── .env                    # Environment variables
├── .env.example            # Environment template
├── jest.config.json        # Jest configuration
├── package.json            # Dependencies
└── setup.js                # Initial setup script
```

## Database Schema

### users table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_online BOOLEAN DEFAULT 0
);
```

## In-Memory Data Structures

### Matching Queues
```javascript
const waitingQueues = {
  jogos: [
    { userId: 1, socketId: 'socket123', timestamp: 1640995200000 }
  ],
  series: [],
  filmes: []
};
```

### Active Rooms
```javascript
const activeRooms = new Map([
  ['room-uuid', {
    id: 'room-uuid',
    category: 'jogos',
    user1Id: 1,
    user2Id: 2,
    user1SocketId: 'socket123',
    user2SocketId: 'socket456',
    status: 'active',
    createdAt: Date
  }]
]);
```

## Security Features

### Authentication
- JWT tokens with expiration
- bcrypt password hashing
- Protected routes with middleware

### Rate Limiting
- Authentication: 20 requests/minute
- General API: 100 requests/minute
- Messages: 10 messages/minute

### Validation
- Joi schema validation
- Input sanitization
- Category validation

### Headers
- Helmet security headers
- CORS configuration
- Content-Type validation

## Performance Considerations

### Memory Management
- In-memory queues for fast matching
- Automatic room cleanup (5 minutes)
- Connection pooling for database

### Scalability
- Stateless HTTP API
- WebSocket connection management
- Database connection optimization

## Monitoring & Health

### Health Check
- Database connectivity
- WebSocket status
- System timestamp

### Logging
- Structured console logging
- Connection events
- Error tracking

### Cleanup
- Inactive room removal
- Queue management
- Memory optimization

## Deployment

### Development
```bash
npm run setup    # Install dependencies + setup DB
npm run dev      # Start with nodemon
npm test         # Run all tests
```

### Production Considerations
- Replace SQLite with PostgreSQL
- Add Redis for session management
- Implement horizontal scaling
- Add monitoring (PM2, New Relic)
- Configure HTTPS/SSL
- Set up load balancer
- Environment-specific configs