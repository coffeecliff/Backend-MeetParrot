const jwt = require('jsonwebtoken');
const matchingService = require('./matching.service');
const authService = require('./auth.service');
const { v4: uuidv4 } = require('uuid');

// Intervalo de heartbeat: 30 segundos
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  initialize(io) {
    this.io = io;

    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // ─── Autenticação ───────────────────────────────────────────────────────

      socket.on('authenticate', async (data) => {
        console.log(`🔑 Auth attempt: ${socket.id}`);
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          socket.userId = decoded.userId;
          this.connectedUsers.set(decoded.userId, socket.id);

          await authService.setUserOnline(decoded.userId, true);
          socket.emit('authenticated', { userId: decoded.userId });
          console.log(`✅ Authenticated: ${decoded.userId}`);
        } catch (error) {
          console.log(`❌ Auth failed: ${error.message}`);
          socket.emit('auth_error', { message: 'Invalid token' });
        }
      });

      // ─── Recuperação de sessão ──────────────────────────────────────────────

      socket.on('get-session-state', () => {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const state = matchingService.getSessionState(socket.userId);
        socket.emit('session-state', state);
        console.log(`📋 Session state for ${socket.userId}:`, state);
      });

      // ─── Matching ───────────────────────────────────────────────────────────

      socket.on('find-match', async (data) => {
        console.log(`🔍 User ${socket.userId} looking for match in: ${data.category}`);

        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { category } = data;
        const validCategories = ['jogos', 'series', 'filmes', 'games', 'movies', 'shows'];
        if (!category || !validCategories.includes(category)) {
          socket.emit('error', { message: 'Invalid category. Use: jogos, series, filmes' });
          return;
        }

        const categoryMap = { games: 'jogos', movies: 'filmes', shows: 'series' };
        const mappedCategory = categoryMap[category] || category;

        let result;
        try {
          result = matchingService.joinQueue(socket.userId, socket.id, mappedCategory);
        } catch (err) {
          socket.emit('error', { message: err.message });
          return;
        }

        // Confirma entrada na fila
        socket.emit('queue-joined', {
          category: mappedCategory,
          position: result.queuePosition ?? 1
        });

        if (result.matched) {
          console.log(`✅ Match found! Room: ${result.roomId}`);
          await this.notifyMatch(socket, result, io);
        } else {
          console.log(`⏳ In queue. Position: ${result.queuePosition}`);
          socket.emit('queue-status', {
            category: mappedCategory,
            position: result.queuePosition,
            estimatedWait: result.estimatedWait
          });
        }
      });

      socket.on('cancel-matching', () => {
        if (socket.userId) {
          matchingService.leaveAllQueues(socket.userId);
          socket.emit('queue-left', { success: true });
          console.log(`🚫 Matching cancelled: ${socket.userId}`);
        }
      });

      // ─── Sala ───────────────────────────────────────────────────────────────

      socket.on('join-room', (data) => {
        const room = matchingService.getRoom(data.roomId);

        if (room && (room.user1Id === socket.userId || room.user2Id === socket.userId)) {
          socket.join(data.roomId);
          socket.currentRoom = data.roomId;
          matchingService.updateRoomActivity(data.roomId);
          socket.emit('room-joined', { roomId: data.roomId });
          console.log(`🚪 ${socket.userId} joined room ${data.roomId}`);
        } else {
          socket.emit('error', { message: 'Room not found or access denied' });
        }
      });

      socket.on('leave-room', (data) => {
        console.log(`👋 User ${socket.userId} leaving room ${data.roomId}`);
        this.handleLeaveRoom(socket, data.roomId);
      });

      // ─── Mensagens ──────────────────────────────────────────────────────────

      socket.on('send-message', async (data) => {
        if (!socket.currentRoom || !socket.userId) return;

        const sender = await authService.getUserById(socket.userId);
        const senderUsername = sender ? sender.username : 'Usuário';

        const message = {
          id: uuidv4(),
          message: data.message,
          senderId: socket.userId,
          username: senderUsername,
          timestamp: new Date()
        };

        matchingService.updateRoomActivity(socket.currentRoom);

        socket.to(socket.currentRoom).emit('new-message', {
          id: message.id,
          message: message.message,
          username: message.username,
          senderId: message.senderId,
          timestamp: message.timestamp
        });
      });

      // ─── Typing ─────────────────────────────────────────────────────────────

      socket.on('typing_start', () => {
        if (socket.currentRoom) {
          socket.to(socket.currentRoom).emit('partner_typing', { isTyping: true });
        }
      });

      socket.on('typing_stop', () => {
        if (socket.currentRoom) {
          socket.to(socket.currentRoom).emit('partner_typing', { isTyping: false });
        }
      });

      // ─── Desconexão ─────────────────────────────────────────────────────────

      socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);

        if (socket.userId) {
          await authService.setUserOnline(socket.userId, false);
          matchingService.leaveQueue(socket.userId);
          this.connectedUsers.delete(socket.userId);
          this.handleLeaveRoom(socket, socket.currentRoom, true);
        }
      });
    });

    // ─── Cleanup periódico ───────────────────────────────────────────────────

    // Limpa salas inativas a cada 5 minutos
    setInterval(() => {
      const removedRooms = matchingService.cleanupInactiveRooms();
      if (removedRooms.length > 0) {
        console.log(`🧹 Cleaned up ${removedRooms.length} inactive room(s)`);
      }
    }, 5 * 60 * 1000);

    // Limpa filas expiradas e notifica usuários a cada 1 minuto
    setInterval(() => {
      const expiredItems = matchingService.cleanupExpiredQueues();
      expiredItems.forEach(item => {
        const userSocket = io.sockets.sockets.get(item.socketId);
        if (userSocket) {
          userSocket.emit('queue-timeout', {
            message: 'Tempo de espera esgotado. Tente novamente.',
            category: item.category
          });
          console.log(`⏰ Queue timeout for user ${item.userId}`);
        }
      });
    }, 60 * 1000);

    // Heartbeat a cada 30 segundos — detecta sockets zumbi
    setInterval(() => {
      io.emit('ping');
    }, HEARTBEAT_INTERVAL_MS);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async notifyMatch(socket, result, io) {
    const user1 = await authService.getUserById(socket.userId);
    const user2 = await authService.getUserById(result.partnerId);
    const partnerSocket = io.sockets.sockets.get(result.partnerSocketId);

    socket.emit('match-found', {
      roomId: result.roomId,
      category: result.category,
      partner: { username: user2 ? user2.username : 'Usuário' }
    });

    if (partnerSocket) {
      partnerSocket.emit('match-found', {
        roomId: result.roomId,
        category: result.category,
        partner: { username: user1 ? user1.username : 'Usuário' }
      });
    }
  }

  handleLeaveRoom(socket, roomId = null, isDisconnect = false) {
    const targetRoom = roomId || socket.currentRoom;
    if (!targetRoom) return;

    console.log(`🚪 handleLeaveRoom: ${targetRoom}, disconnect: ${isDisconnect}`);

    const roomData = matchingService.leaveRoom(targetRoom, socket.userId);

    if (roomData) {
      socket.to(targetRoom).emit('partner_left', {
        roomId: targetRoom,
        message: isDisconnect
          ? 'Seu parceiro se desconectou'
          : 'Seu parceiro saiu da conversa'
      });

      if (roomData.partnerSocketId) {
        const partnerSocket = this.io.sockets.sockets.get(roomData.partnerSocketId);
        if (partnerSocket) {
          console.log(`🔄 Auto-reconnecting partner ${roomData.partnerId}`);
          partnerSocket.currentRoom = null;

          partnerSocket.emit('partner_disconnected', {
            message: 'Procurando nova pessoa...'
          });

          setTimeout(async () => {
            if (!partnerSocket.userId) return;

            console.log(`🔍 New search for partner in: ${roomData.category}`);
            let result;
            try {
              result = matchingService.joinQueue(
                partnerSocket.userId,
                partnerSocket.id,
                roomData.category
              );
            } catch (err) {
              partnerSocket.emit('error', { message: err.message });
              return;
            }

            // Confirma entrada na fila para o parceiro
            partnerSocket.emit('queue-joined', {
              category: roomData.category,
              position: result.queuePosition ?? 1
            });

            if (result.matched) {
              await this.notifyMatch(partnerSocket, result, this.io);
            } else {
              partnerSocket.emit('queue-status', {
                category: result.category,
                position: result.queuePosition,
                estimatedWait: result.estimatedWait
              });
            }
          }, 1000);
        }
      }
    }

    socket.leave(targetRoom);
    socket.currentRoom = null;
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = new WebSocketService();