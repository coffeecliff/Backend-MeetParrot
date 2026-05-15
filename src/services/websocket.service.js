const jwt = require('jsonwebtoken');
const MatchongService = require('./matching.service');
const authService = require('./auth.service');
const {v4:uuidv4} = require('uuid');
const matchingService = require('./matching.service');

class WebSocketService {

    constructor() {
        this.io = null;
        this.connectedUsers = new Map();
    }

    initialize(io) {
        this.io = io;
        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            console.on('authenticate', async (data) => {
                try {
                    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                    socket.userId = decoded.userId;
                    this.connectedUsers.set(socket.userId, socket.id);
                    console.log(`User ${socket.userId} authenticate with socket ${socket.id}`);
                    await authService.updateUserStatus(decoded.userId, true);
                    socket.emit('authenticated', { success: true});
                } catch (error) {
                    socket.emit('authenticated', { success: false, message: 'Invalid token'});
                }
            });

            socket.on('find-match', async (data) => {
                if (!socket.userId) {
                    socket.emit('match-error', {message: 'User not authenticated'});
                    return;
                }
                const {category} = data;
                if (!['Games', 'Series', 'Movies', 'Books'].includes(category)) {
                    socket.emit('match-error', { message: 'Invalid category'});
                    return;
                }
                /* Pode ser descomentada esta parte 
                const categoryMap = {
                    'Games': 'Jogos',
                    'Series': 'Séries',
                    'Movies': 'Filmes',
                    'Books': 'Livros'
                };
                */
                const result = matchingService.joinQueue(socket.userId, socket.Id, category);

                if (result.matched) {
                    const user1 = await authService.getUserById(socket.userId);
                    const user2 = await authService.getUserById(result.partnerId);
                    const partnerSocket = io.sockets.sockets.get(result.partnerSocketID);

                    socket.emit('match-found', {
                        roomId: result.roomId,
                        category: result.category,
                        partner: { username: user2 ? user2.username : 'Stranger'}
                    });
                    if (partnerSocket) {
                        partnerSocket.emit('match-found', {
                            roomId: result.roomId,
                            category: result.category,
                            partner: { username: user1 ? user1.username : 'Stranger'} 
                        });
                    } else {
                        socket.emit('queue-status', {
                            category: result.category,
                            position: result.position,
                            estimatedWaiting: result.estimatedWaiting
                        })}
                }
            });

            socket.on('cancel-match', () => {
                if (socket.userId) {
                    matchingService.leaveQueue(socket.userId);
                    socket.emit('match-cancelled', { message: 'Matching cancelled' });
                }});

            socket.on('join-room', (data) => {
                const room = matchingService.getRoom(data.roomId);
                if (room && (room.userId1 === socket.userId || room.userId2 === socket.userId)) {
                    socket.join(data.roomId);
                    socket.emit('room-joined', { roomId: data.roomId})
                }});

            socket.on('typing_start', (data) => {
                if(socket.currentRoom) {
                    socket.to(socket.currentRoom).emit('partner_typing_start', {isTyping: true});
                }});
            
            socket.on('typing_stop', (data) => {
                if(socket.currentRoom) {
                    socket.to(socket.currentRoom).emit('partner_typing_stop', {isTyping: false})
                }});
            
            socket.on('leave-room', (data) => {
                this.handleLeaveRoom(socket, data.roomId);
            });

            socket.on('send-message', async (data) => {
                if(!socket.currentRoom || !socket.userId) return;
                const sender = await authService.getUserById(socket.userId);
                senderUsername = sender ? sender.username : 'Stranger';
                const message = { id: uuidv4(),
                    senderId: socket.userId,
                    message: data.message,
                    timestamp: new Date(),
                };
                socket.t(socket.currentRoom).emit('new-message', {
                    id: message.id,
                    message: message.message,
                    username: senderUsername,
                    timestamp: message.timestamp
                });
            });

            socket.on('disconnect', async () => {
                console.log('Client disconnected:', socket.id);
                if (socket.userId) {
                    await authService.setUserOnlineStatus(socket.userId, false);
                    matchingService.leaveQueue(socket.userId);
                    this.connectedUsers.delete(socket.userId);
                    this.handleLeaveRooms(socket, socket.currentRoom, true);
                }});
        });
        setInterval(() => {matchingService.cleanupInactiveRooms();}, 5 * 60 * 1000);
    }
    handleLeaveRoom(socket, roomId = null, isDisconnect = false) {
        const targetRoom = roomId || socket.currentRoom;

        if (targetRoom) {
            console.log(` Handling leave room: ${targetRoom}, disconnect: ${isDisconnect}`);

            const roomData = matchingService.leaveRoom(targetRoom, socket.userId);

            if (roomData) {
                console.log(` Notifying partner about user leaving room ${targetRoom}`);

                socket.to(targetRoom).emit('partner_left', {
                    roomId: targetRoom,
                    message: isDisconnect ? 'Seu parceiro se desconectou' : 'Seu parceiro saiu da conversa'
                });
                if (roomData.partnerSocketID) {
                    const partnerSocket = this.io.sockets.sockets.get(roomData.partnerSocketId);
                    if (partnerSocket) {
                        console.log(` Auto-reconnecting partner ${roomData.partnerId}`);
                        
                        partner.currentRoom = null;

                        partnerSocket.emit('partner_disconnect', {
                            message: 'Procurando nova pessoa...'
                        });

                        setTimeout(() => {
                            if (partnerSocket.userId) {
                                console.log(` Starting new search for partner in category: ${roomData.category}`);

                                const result = matchingService.joinQueue(partnerSocket.userId, partnerSocket.id, roomData.category);
                                if (result.matched) {
                                    const newPartnerSocket = this.io.sockets.sockets.get(result.partnerSocketId);

                                    partnerSocket.emit('match-found', {
                                        roomId: result.roomId,
                                        category: result.category,
                                        partner: { username: 'Usuário' }
                                    });

                                    if (newPartnerSocket) {
                                        newPartnerSocket.emit('match-found', {
                                            roomId: result.roomId,
                                            category: result.category,
                                            partner: { username: 'Usuário '}
                                        });
                                    }
                                } else {
                                    partnerSocket.emit('queue-status', {
                                        category: result.category,
                                        position: result.queuePosition,
                                        estimateWait: result.estimateWaiting
                                    });
                                }
                            } 
                        }, 1000);
                    }
                }
            }
            socket.leave(targetRoom);
            socket.currentRoom = null;
        }
    }
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
}

module.exports = new WebSocketService();