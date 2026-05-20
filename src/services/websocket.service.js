const jwt = require('jsonwebtoken');
const matchingService = require('./matching.service');
const authService = require('./auth.service');
const { v4: uuidv4 } = require('uuid');

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

class WebSocketService {
  constructor() {
    this.io = null;

    /**
     * userId -> socketId
     */
    this.connectedUsers = new Map();
  }

  // ─────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────

  initialize(io) {
    this.io = io;

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      // =========================================================
      // AUTH
      // =========================================================

      socket.on('authenticate', async (data, callback = () => { }) => {
        try {
          if (!data?.token) {
            callback({
              success: false,
              error: 'Token is required',
            });

            return;
          }

          const decoded = jwt.verify(
            data.token,
            process.env.JWT_SECRET
          );

          socket.userId = decoded.userId;

          this.connectedUsers.set(
            decoded.userId,
            socket.id
          );

          await authService.setUserOnline(
            decoded.userId,
            true
          );

          socket.emit('authenticated', {
            userId: decoded.userId,
          });

          callback({
            success: true,
          });

          console.log(
            `✅ Authenticated user: ${decoded.userId}`
          );
        } catch (error) {
          console.error(
            '❌ Authentication failed:',
            error.message
          );

          socket.emit('auth_error', {
            message: 'Invalid token',
          });

          callback({
            success: false,
            error: 'Invalid token',
          });
        }
      });

      // =========================================================
      // SESSION STATE
      // =========================================================

      socket.on('get-session-state', (callback = () => { }) => {
        try {
          if (!socket.userId) {
            callback({
              success: false,
              error: 'Not authenticated',
            });

            return;
          }

          const state =
            matchingService.getSessionState(
              socket.userId
            );

          socket.emit('session-state', state);

          callback({
            success: true,
            data: state,
          });
        } catch (error) {
          console.error(
            '❌ Session state error:',
            error.message
          );

          callback({
            success: false,
            error: error.message,
          });
        }
      });

      // =========================================================
      // FIND MATCH
      // =========================================================

      socket.on(
        'find-match',
        async (data, callback = () => { }) => {
          try {
            if (!socket.userId) {
              callback({
                success: false,
                error: 'Not authenticated',
              });

              return;
            }

            const category =
              this.normalizeCategory(
                data?.category
              );

            if (!category) {
              callback({
                success: false,
                error: 'Invalid category',
              });

              return;
            }

            console.log(
              `🔍 User ${socket.userId} searching in ${category}`
            );

            const result =
              matchingService.joinQueue(
                socket.userId,
                socket.id,
                category
              );

            socket.emit('queue-joined', {
              category,
              position:
                result.queuePosition ?? 1,
            });

            callback({
              success: true,
              data: result,
            });

            // MATCH ENCONTRADO
            if (result.matched) {
              await this.notifyMatch(
                socket,
                result
              );
            } else {
              socket.emit('queue-status', {
                category,
                position:
                  result.queuePosition,
                estimatedWait:
                  result.estimatedWait,
              });
            }
          } catch (error) {
            console.error(
              '❌ find-match error:',
              error.message
            );

            callback({
              success: false,
              error: error.message,
            });
          }
        }
      );

      // =========================================================
      // CANCEL MATCHING
      // =========================================================

      socket.on(
        'cancel-matching',
        (callback = () => { }) => {
          try {
            if (!socket.userId) {
              callback({
                success: false,
                error: 'Not authenticated',
              });

              return;
            }

            matchingService.leaveAllQueues(
              socket.userId
            );

            socket.emit(
              'matching-cancelled',
              {
                success: true,
              }
            );

            socket.emit('queue-left', {
              success: true,
            });

            callback({
              success: true,
            });

            console.log(
              `🚫 Matching cancelled: ${socket.userId}`
            );
          } catch (error) {
            console.error(
              '❌ cancel-matching error:',
              error.message
            );

            callback({
              success: false,
              error: error.message,
            });
          }
        }
      );

      // =========================================================
      // JOIN ROOM
      // =========================================================

      socket.on('join-room', (data, callback) => {
        try {
          if (!socket.userId) {
            callback({
              success: false,
              error: 'Not authenticated',
            });

            return;
          }

          const roomId = data?.roomId;

          if (!roomId) {
            callback({
              success: true
            })

            return;
          }

          const room =
            matchingService.getRoom(
              roomId
            );

          if (!room) {
            callback({
              success: false,
              error: 'mensagem'
            })

            return;
          }

          const allowed =
            room.user1Id === socket.userId ||
            room.user2Id === socket.userId;

          if (!allowed) {
            callback({
              success: false,
              error: 'Access denied',
            });

            return;
          }

          socket.join(roomId);

          socket.currentRoom = roomId;

          matchingService.updateRoomActivity(
            roomId
          );

          socket.emit('room-joined', {
            roomId,
          });

          callback({
            success: true,
            data: {
              roomId,
            },
          });

          console.log(
            `🚪 ${socket.userId} joined room ${roomId}`
          );
        } catch (error) {
          console.error(
            '❌ join-room error:',
            error.message
          );

          callback({
            success: false,
            error: error.message,
          });
        }
      }
      );

      // =========================================================
      // LEAVE ROOM
      // =========================================================

      socket.on(
        'leave-room',
        async (data, callback = () => { }) => {
          try {
            if (!socket.userId) {
              callback({
                success: false,
                error: 'Not authenticated',
              });

              return;
            }

            const roomId = data?.roomId;

            await this.handleLeaveRoom(
              socket,
              roomId
            );

            callback({
              success: true,
            });

            console.log(
              `👋 ${socket.userId} left room ${roomId}`
            );
          } catch (error) {
            console.error(
              '❌ leave-room error:',
              error.message
            );

            callback({
              success: false,
              error: error.message,
            });
          }
        }
      );

      // =========================================================
      // SEND MESSAGE
      // =========================================================

      socket.on(
        'send-message',
        async (data, callback = () => { }) => {
          try {
            if (!socket.userId) {
              callback({
                success: false,
                error: 'Not authenticated',
              });

              return;
            }

            if (!socket.currentRoom) {
              callback({
                success: false,
                error: 'No active room',
              });

              return;
            }

            const messageText =
              data?.message?.trim();

            if (!messageText) {
              callback({
                success: false,
                error: 'Message is empty',
              });

              return;
            }

            const sender =
              await authService.getUserById(
                socket.userId
              );

            const message = {
              id: uuidv4(),
              roomId: socket.currentRoom,
              senderId: socket.userId,
              username:
                sender?.username ||
                'Usuário',
              message: messageText,
              timestamp:
                new Date().toISOString(),
            };

            matchingService.updateRoomActivity(
              socket.currentRoom
            );

            socket
              .to(socket.currentRoom)
              .emit(
                'new-message',
                message
              );

            callback({
              success: true,
              data: message,
            });
          } catch (error) {
            console.error(
              '❌ send-message error:',
              error.message
            );

            callback({
              success: false,
              error: error.message,
            });
          }
        }
      );

      // =========================================================
      // TYPING
      // =========================================================

      socket.on('typing_start', () => {
        if (!socket.currentRoom) {
          return;
        }

        socket
          .to(socket.currentRoom)
          .emit(
            'partner_typing',
            {
              isTyping: true,
            }
          );
      });

      socket.on('typing_stop', () => {
        if (!socket.currentRoom) {
          return;
        }

        socket
          .to(socket.currentRoom)
          .emit(
            'partner_typing',
            {
              isTyping: false,
            }
          );
      });

      // =========================================================
      // DISCONNECT
      // =========================================================

      socket.on('disconnect', async () => {
        console.log(
          `🔌 Socket disconnected: ${socket.id}`
        );

        try {
          if (!socket.userId) {
            return;
          }

          this.connectedUsers.delete(
            socket.userId
          );

          await authService.setUserOnline(
            socket.userId,
            false
          );

          matchingService.leaveAllQueues(
            socket.userId
          );

          await this.handleLeaveRoom(
            socket,
            socket.currentRoom,
            true
          );
        } catch (error) {
          console.error(
            '❌ disconnect error:',
            error.message
          );
        }
      });
    });

    // =========================================================
    // CLEANUP TASKS
    // =========================================================

    setInterval(() => {
      const removedRooms =
        matchingService.cleanupInactiveRooms();

      if (removedRooms.length > 0) {
        console.log(
          `🧹 Removed inactive rooms: ${removedRooms.length}`
        );
      }
    }, 5 * 60 * 1000);

    setInterval(() => {
      const expiredItems =
        matchingService.cleanupExpiredQueues();

      expiredItems.forEach((item) => {
        const userSocket =
          io.sockets.sockets.get(
            item.socketId
          );

        if (!userSocket) {
          return;
        }

        userSocket.emit('queue-timeout', {
          message:
            'Tempo de fila expirado',
          category: item.category,
        });

        console.log(
          `⏰ Queue timeout: ${item.userId}`
        );
      });
    }, 60 * 1000);

    setInterval(() => {
      io.emit('ping');
    }, HEARTBEAT_INTERVAL_MS);
  }

  // ─────────────────────────────────────────────────────────────
  // MATCH NOTIFICATION
  // ─────────────────────────────────────────────────────────────

  async notifyMatch(socket, result) {
    const partnerSocket =
      this.io.sockets.sockets.get(
        result.partnerSocketId
      );

    const currentUser =
      await authService.getUserById(
        socket.userId
      );

    const partnerUser =
      await authService.getUserById(
        result.partnerId
      );

    socket.emit('match-found', {
      roomId: result.roomId,
      category: result.category,
      partner: {
        id: partnerUser?.id,
        username:
          partnerUser?.username ||
          'Usuário',
        email:
          partnerUser?.email || '',
      },
    });

    if (partnerSocket) {
      partnerSocket.emit(
        'match-found',
        {
          roomId: result.roomId,
          category: result.category,
          partner: {
            id: currentUser?.id,
            username:
              currentUser?.username ||
              'Usuário',
            email:
              currentUser?.email || '',
          },
        }
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LEAVE ROOM
  // ─────────────────────────────────────────────────────────────

  async handleLeaveRoom(
    socket,
    roomId = null,
    isDisconnect = false
  ) {
    const targetRoom =
      roomId || socket.currentRoom;

    if (!targetRoom) {
      return;
    }

    const roomData =
      matchingService.leaveRoom(
        targetRoom,
        socket.userId
      );

    if (!roomData) {
      socket.leave(targetRoom);
      socket.currentRoom = null;
      return;
    }

    socket.to(targetRoom).emit(
      'partner_left',
      {
        roomId: targetRoom,
        message: isDisconnect
          ? 'Seu parceiro desconectou'
          : 'Seu parceiro saiu da conversa',
      }
    );

    const partnerSocket =
      this.io.sockets.sockets.get(
        roomData.partnerSocketId
      );

    if (partnerSocket) {
      partnerSocket.currentRoom =
        null;

      partnerSocket.emit(
        'partner_disconnected',
        {
          message:
            'Procurando novo parceiro...',
        }
      );

      setTimeout(async () => {
        try {
          if (!partnerSocket.userId) {
            return;
          }

          const result =
            matchingService.joinQueue(
              partnerSocket.userId,
              partnerSocket.id,
              roomData.category
            );

          partnerSocket.emit(
            'queue-joined',
            {
              category:
                roomData.category,
              position:
                result.queuePosition ??
                1,
            }
          );

          if (result.matched) {
            await this.notifyMatch(
              partnerSocket,
              result
            );
          } else {
            partnerSocket.emit(
              'queue-status',
              {
                category:
                  result.category,
                position:
                  result.queuePosition,
                estimatedWait:
                  result.estimatedWait,
              }
            );
          }
        } catch (error) {
          console.error(
            '❌ Auto rematch error:',
            error.message
          );
        }
      }, 1000);
    }

    socket.leave(targetRoom);

    socket.currentRoom = null;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  normalizeCategory(category) {
    if (!category) {
      return null;
    }

    const map = {
      jogos: 'jogos',
      games: 'jogos',

      filmes: 'filmes',
      movies: 'filmes',

      series: 'series',
      shows: 'series',
    };

    return map[category] || null;
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = new WebSocketService();