# MeetStranger Backend API Documentation

## Overview
MeetStranger is a dynamic P2P anonymous chat system with real-time matching by categories.

## Architecture
- **Database**: SQLite (development) / PostgreSQL (production)
- **Real-time**: WebSocket with Socket.IO
- **Authentication**: JWT with bcrypt
- **Categories**: jogos, series, filmes
- **Matching**: Dynamic P2P with auto-reconnection

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/register
Register new user.

**Request:**
```json
{
  "username": "string (3-50 chars, alphanumeric)",
  "email": "string (valid email)",
  "password": "string (min 6 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST /auth/login
Login existing user.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST /auth/logout
Logout user (requires authentication).

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET /auth/profile
Get user profile (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "is_online": true
    }
  }
}
```

### Matching System

#### POST /matching/join
Join matching queue (requires authentication).

**Request:**
```json
{
  "category": "jogos" | "series" | "filmes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join queue via WebSocket for real-time matching",
  "instructions": "Use WebSocket event: join_queue with category: jogos"
}
```

#### DELETE /matching/leave
Leave all queues (requires authentication).

**Response:**
```json
{
  "success": true,
  "message": "Left all queues successfully"
}
```

#### GET /matching/stats
Get queue statistics (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "jogos": 2,
    "series": 1,
    "filmes": 0,
    "activeRooms": 3
  }
}
```

### Health Check

#### GET /health
Check server status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "websocket": "active"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or missing token"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests, please slow down"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Rate Limiting
- **Authentication**: 20 requests per minute
- **General API**: 100 requests per minute
- **Messages**: 10 messages per minute per room