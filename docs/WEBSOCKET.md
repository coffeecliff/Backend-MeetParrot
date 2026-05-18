# WebSocket Events Documentation

## Connection
Connect to WebSocket server:
```javascript
const socket = io('ws://localhost:3000');
```

## Authentication Flow

### 1. Authenticate
**Client → Server:**
```javascript
socket.emit('authenticate', {
  token: 'jwt_token_here'
});
```

**Server → Client:**
```javascript
socket.on('authenticated', (data) => {
  console.log(data.userId); // User ID
});

socket.on('auth_error', (error) => {
  console.log(error.message); // Authentication failed
});
```

## Matching System

### 2. Join Queue
**Client → Server:**
```javascript
socket.emit('join_queue', {
  category: 'jogos' // or 'series' or 'filmes'
});
```

**Server → Client (Waiting):**
```javascript
socket.on('queue_status', (data) => {
  console.log(data.category);      // 'jogos'
  console.log(data.position);      // 1
  console.log(data.estimatedWait); // '15s'
});
```

**Server → Client (Match Found):**
```javascript
socket.on('match_found', (data) => {
  console.log(data.roomId);   // 'room-uuid'
  console.log(data.category); // 'jogos'
  console.log(data.partner);  // { username: 'Stranger' }
});
```

### 3. Leave Queue
**Client → Server:**
```javascript
socket.emit('leave_queue');
```

**Server → Client:**
```javascript
socket.on('left_queue', (data) => {
  console.log(data.success); // true
});
```

## Chat System

### 4. Join Room
**Client → Server:**
```javascript
socket.emit('join_room', {
  roomId: 'room-uuid'
});
```

**Server → Client:**
```javascript
socket.on('room_joined', (data) => {
  console.log(data.roomId); // 'room-uuid'
});
```

### 5. Send Message
**Client → Server:**
```javascript
socket.emit('send_message', {
  content: 'Hello there!'
});
```

**Server → Client:**
```javascript
socket.on('new_message', (data) => {
  console.log(data.id);        // 'message-uuid'
  console.log(data.content);   // 'Hello there!'
  console.log(data.sender);    // { id: 'user-id', username: 'Stranger' }
  console.log(data.timestamp); // Date object
});
```

### 6. Typing Indicators
**Client → Server:**
```javascript
socket.emit('typing_start');
socket.emit('typing_stop');
```

**Server → Client:**
```javascript
socket.on('partner_typing', (data) => {
  console.log(data.isTyping); // true/false
});
```

### 7. Leave Room
**Client → Server:**
```javascript
socket.emit('leave_room');
```

**Server → Client:**
```javascript
socket.on('partner_left', (data) => {
  console.log(data.roomId); // 'room-uuid'
});
```

## Disconnection Events

### Partner Disconnected
```javascript
socket.on('partner_disconnected', (data) => {
  console.log(data.message); // 'Your partner left. Finding new connection...'
  // Auto-reconnection will happen automatically
});
```

### Connection Lost
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect', () => {
  console.log('Reconnected to server');
  // Re-authenticate if needed
});
```

## Error Handling

### General Errors
```javascript
socket.on('error', (error) => {
  console.log(error.message); // Error description
});
```

## Complete Flow Example

```javascript
const io = require('socket.io-client');
const socket = io('ws://localhost:3000');

// 1. Connect and authenticate
socket.on('connect', () => {
  socket.emit('authenticate', { token: 'your-jwt-token' });
});

// 2. Handle authentication
socket.on('authenticated', (data) => {
  console.log('Authenticated as user:', data.userId);
  
  // 3. Join queue for games
  socket.emit('join_queue', { category: 'jogos' });
});

// 4. Handle queue status
socket.on('queue_status', (data) => {
  console.log(`Waiting in queue. Position: ${data.position}, Wait: ${data.estimatedWait}`);
});

// 5. Handle match found
socket.on('match_found', (data) => {
  console.log('Match found! Joining room:', data.roomId);
  socket.emit('join_room', { roomId: data.roomId });
});

// 6. Handle room joined
socket.on('room_joined', (data) => {
  console.log('Joined room:', data.roomId);
  
  // Send a message
  socket.emit('send_message', { content: 'Hello!' });
});

// 7. Handle incoming messages
socket.on('new_message', (data) => {
  console.log(`${data.sender.username}: ${data.content}`);
});

// 8. Handle partner leaving
socket.on('partner_left', (data) => {
  console.log('Partner left the chat');
});

// 9. Handle auto-reconnection
socket.on('partner_disconnected', (data) => {
  console.log(data.message);
  // System will automatically find new partner
});
```

## Categories
- **jogos**: For gaming discussions
- **series**: For TV series discussions  
- **filmes**: For movie discussions

## Notes
- Messages are not persisted (P2P temporary chat)
- Auto-reconnection maintains the same category
- Rooms are automatically cleaned up after 5 minutes of inactivity
- Maximum 2 users per room (P2P)