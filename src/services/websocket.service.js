const jwt = require('jsonwebtoken');
const matchingService = require('./matching.service');
const authService = require('./auth.service');
const { v4: uuidv4 } = require('uuid');

const HEARTBEAT_INTERVAL_MS =
  30 * 1000;

class WebSocketService {
  constructor() {
    this.io = null;

    /**
     * userId -> socketId
     */
    this.connectedUsers =
      new Map();
  }

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  initialize(io) {
    this.io = io;

    io.on(
      'connection',
      (socket) => {

        console.log(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );

        console.log(
          '🔌 SOCKET CONNECTED'
        );

        console.log(
          'socket.id:',
          socket.id
        );

        console.log(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━'
        );

        // =====================================================
        // AUTH
        // =====================================================

        socket.on(
          'authenticate',
          async (
            data,
            callback = () => { }
          ) => {

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              '🔐 AUTHENTICATE EVENT'
            );

            console.log(
              'socket.id:',
              socket.id
            );

            console.log(
              'data:',
              data
            );

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            try {

              if (!data?.token) {

                console.log(
                  '❌ TOKEN MISSING'
                );

                callback({
                  success: false,
                  error:
                    'Token is required',
                });

                return;
              }

              const decoded =
                jwt.verify(
                  data.token,
                  process.env.JWT_SECRET
                );

              console.log(
                '✅ TOKEN VALID'
              );

              console.log(
                'decoded:',
                decoded
              );

              socket.userId =
                decoded.userId;

              this.connectedUsers.set(
                decoded.userId,
                socket.id
              );

              console.log(
                '👤 USER ATTACHED TO SOCKET'
              );

              console.log(
                'socket.userId:',
                socket.userId
              );

              await authService.setUserOnline(
                decoded.userId,
                true
              );

              socket.emit(
                'authenticated',
                {
                  userId:
                    decoded.userId,
                }
              );

              console.log(
                '📤 AUTHENTICATED EVENT SENT'
              );

              callback({
                success: true,
              });

              console.log(
                '✅ AUTH ACK SENT'
              );

            } catch (error) {

              console.error(
                '❌ AUTH FAILED:',
                error
              );

              socket.emit(
                'auth_error',
                {
                  message:
                    'Invalid token',
                }
              );

              callback({
                success: false,
                error:
                  'Invalid token',
              });
            }
          }
        );

        // =====================================================
        // SESSION STATE
        // =====================================================

        socket.on(
          'get-session-state',
          (
            callback = () => { }
          ) => {

            console.log(
              '📦 GET SESSION STATE'
            );

            try {

              if (!socket.userId) {

                console.log(
                  '❌ NOT AUTHENTICATED'
                );

                callback({
                  success: false,
                  error:
                    'Not authenticated',
                });

                return;
              }

              const state =
                matchingService.getSessionState(
                  socket.userId
                );

              console.log(
                '📦 SESSION STATE:',
                state
              );

              socket.emit(
                'session-state',
                state
              );

              callback({
                success: true,
                data: state,
              });

            } catch (error) {

              console.error(
                '❌ SESSION STATE ERROR:',
                error
              );

              callback({
                success: false,
                error:
                  error.message,
              });
            }
          }
        );

        // =====================================================
        // FIND MATCH
        // =====================================================

        socket.on(
          'find-match',
          async (data, callback) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📥 FIND MATCH RECEIVED');
            console.log('socket id:', socket.id);
            console.log('userId:', socket.userId);
            console.log('payload:', data);
            console.log('callback exists:', !!callback);
            console.log('━━━━━━━━━━━━━━━━━━━━━━');

            try {
              if (!socket.userId) {
                console.log('❌ NOT AUTHENTICATED');

                if (callback) {
                  callback({
                    success: false,
                    error: 'Not authenticated',
                  });
                }

                return;
              }

              const category =
                this.normalizeCategory(
                  data?.category
                );

              console.log(
                'normalized category:',
                category
              );

              if (!category) {
                console.log('❌ INVALID CATEGORY');

                if (callback) {
                  callback({
                    success: false,
                    error: 'Invalid category',
                  });
                }

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

              console.log('📦 MATCH RESULT:', result);

              socket.emit('queue-joined', {
                category,
                position:
                  result.queuePosition ?? 1,
              });

              console.log('📤 SENDING ACK');

              if (callback) {
                callback({
                  success: true,
                  data: result,
                });
              }

              console.log('✅ ACK SENT');

              if (result.matched) {
                console.log('🎯 MATCH FOUND');

                await this.notifyMatch(
                  socket,
                  result
                );
              } else {
                console.log('⌛ USER ADDED TO QUEUE');

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
                error
              );

              if (callback) {
                callback({
                  success: false,
                  error: error.message,
                });
              }
            }
          }
        );

        // =====================================================
        // JOIN ROOM
        // =====================================================

        socket.on(
          'join-room',
          (
            data,
            callback = () => { }
          ) => {

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              '🚪 JOIN ROOM'
            );

            console.log(
              'socket.userId:',
              socket.userId
            );

            console.log(
              'data:',
              data
            );

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            try {

              if (!socket.userId) {

                callback({
                  success: false,
                  error:
                    'Not authenticated',
                });

                return;
              }

              const roomId =
                data?.roomId;

              console.log(
                '🏠 ROOM ID:',
                roomId
              );

              if (!roomId) {

                callback({
                  success: false,
                  error:
                    'Room id missing',
                });

                return;
              }

              const room =
                matchingService.getRoom(
                  roomId
                );

              console.log(
                '🏠 ROOM:',
                room
              );

              if (!room) {

                console.log(
                  '❌ ROOM NOT FOUND'
                );

                callback({
                  success: false,
                  error:
                    'Room not found',
                });

                return;
              }

              const allowed =
                room.user1Id ===
                socket.userId ||
                room.user2Id ===
                socket.userId;

              console.log(
                '🔐 ROOM ACCESS:',
                allowed
              );

              if (!allowed) {

                callback({
                  success: false,
                  error:
                    'Access denied',
                });

                return;
              }

              socket.join(
                roomId
              );

              socket.currentRoom =
                roomId;

              matchingService.updateRoomActivity(
                roomId
              );

              socket.emit(
                'room-joined',
                {
                  roomId,
                }
              );

              callback({
                success: true,
                data: {
                  roomId,
                },
              });

              console.log(
                `✅ USER ${socket.userId} JOINED ROOM ${roomId}`
              );

            } catch (error) {

              console.error(
                '❌ JOIN ROOM ERROR:',
                error
              );

              callback({
                success: false,
                error:
                  error.message,
              });
            }
          }
        );

        // =====================================================
        // SEND MESSAGE
        // =====================================================

        socket.on(
          'send-message',
          async (
            data,
            callback = () => { }
          ) => {

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              '💬 SEND MESSAGE'
            );

            console.log(
              'socket.userId:',
              socket.userId
            );

            console.log(
              'socket.currentRoom:',
              socket.currentRoom
            );

            console.log(
              'data:',
              data
            );

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            try {

              if (!socket.userId) {

                callback({
                  success: false,
                  error:
                    'Not authenticated',
                });

                return;
              }

              if (
                !socket.currentRoom
              ) {

                callback({
                  success: false,
                  error:
                    'No active room',
                });

                return;
              }

              const messageText =
                data?.message?.trim();

              console.log(
                '📝 MESSAGE:',
                messageText
              );

              if (!messageText) {

                callback({
                  success: false,
                  error:
                    'Message is empty',
                });

                return;
              }

              const sender =
                await authService.getUserById(
                  socket.userId
                );

              const message = {
                id: uuidv4(),
                roomId:
                  socket.currentRoom,
                senderId:
                  socket.userId,
                username:
                  sender?.username ||
                  'Usuário',
                message:
                  messageText,
                timestamp:
                  new Date().toISOString(),
              };

              console.log(
                '📤 EMITTING MESSAGE:',
                message
              );

              matchingService.updateRoomActivity(
                socket.currentRoom
              );

              socket
                .to(
                  socket.currentRoom
                )
                .emit(
                  'new-message',
                  message
                );

              callback({
                success: true,
                data: message,
              });

              console.log(
                '✅ MESSAGE SENT'
              );

            } catch (error) {

              console.error(
                '❌ SEND MESSAGE ERROR:',
                error
              );

              callback({
                success: false,
                error:
                  error.message,
              });
            }
          }
        );

        // =====================================================
        // DISCONNECT
        // =====================================================

        socket.on(
          'disconnect',
          async (
            reason
          ) => {

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              '🔌 DISCONNECT'
            );

            console.log(
              'socket.id:',
              socket.id
            );

            console.log(
              'socket.userId:',
              socket.userId
            );

            console.log(
              'reason:',
              reason
            );

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            try {

              if (
                !socket.userId
              ) {
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
                '❌ DISCONNECT ERROR:',
                error
              );
            }
          }
        );
      }
    );

    // =========================================================
    // CLEANUP
    // =========================================================

    setInterval(() => {

      const removedRooms =
        matchingService.cleanupInactiveRooms();

      if (
        removedRooms.length > 0
      ) {

        console.log(
          `🧹 REMOVED INACTIVE ROOMS: ${removedRooms.length}`
        );
      }

    }, 5 * 60 * 1000);

    setInterval(() => {

      const expiredItems =
        matchingService.cleanupExpiredQueues();

      expiredItems.forEach(
        (
          item
        ) => {

          const userSocket =
            io.sockets.sockets.get(
              item.socketId
            );

          if (!userSocket) {
            return;
          }

          userSocket.emit(
            'queue-timeout',
            {
              message:
                'Tempo de fila expirado',
              category:
                item.category,
            }
          );

          console.log(
            `⏰ QUEUE TIMEOUT: ${item.userId}`
          );
        }
      );

    }, 60 * 1000);

    setInterval(() => {

      io.emit(
        'ping'
      );

    }, HEARTBEAT_INTERVAL_MS);
  }

  // ─────────────────────────────────────────────────────────────
  // MATCH NOTIFICATION
  // ─────────────────────────────────────────────────────────────

  async notifyMatch(
    socket,
    result
  ) {

    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    console.log(
      '🎉 NOTIFY MATCH'
    );

    console.log(
      'result:',
      result
    );

    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    const partnerSocket =
      this.io.sockets.sockets.get(
        result.partnerSocketId
      );

    console.log(
      '👥 PARTNER SOCKET:',
      !!partnerSocket
    );

    const currentUser =
      await authService.getUserById(
        socket.userId
      );

    const partnerUser =
      await authService.getUserById(
        result.partnerId
      );

    console.log(
      '📤 EMITTING MATCH TO CURRENT USER'
    );

    socket.emit(
      'match-found',
      {
        roomId:
          result.roomId,
        category:
          result.category,
        partner: {
          id:
            partnerUser?.id,
          username:
            partnerUser?.username ||
            'Usuário',
          email:
            partnerUser?.email ||
            '',
        },
      }
    );

    if (
      partnerSocket
    ) {

      console.log(
        '📤 EMITTING MATCH TO PARTNER'
      );

      partnerSocket.emit(
        'match-found',
        {
          roomId:
            result.roomId,
          category:
            result.category,
          partner: {
            id:
              currentUser?.id,
            username:
              currentUser?.username ||
              'Usuário',
            email:
              currentUser?.email ||
              '',
          },
        }
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  normalizeCategory(category) {
  if (!category) {
    return null;
  }

  const normalized =
    String(category)
      .trim()
      .toLowerCase();

  const map = {
      jogos:
        'jogos',

      games:
        'jogos',

      filmes:
        'filmes',

      movies:
        'filmes',

      series:
        'series',

      shows:
        'series',
    };

    return map[normalized] || null;
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports =
  new WebSocketService();