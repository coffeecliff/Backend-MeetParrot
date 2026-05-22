const jwt = require('jsonwebtoken');

const { v4: uuidv4 } = require('uuid');

const matchingService = require('./matching.service');

const authService = require('./auth.service');

class WebSocketService {

    constructor() {

        this.io = null;

        this.connectedUsers = new Map();
    }

    initialize(io) {

        this.io = io;

        io.on('connection', (socket) => {

            console.log(
                '[WS] New connection:',
                socket.id
            );

            // =========================
            // AUTHENTICATION
            // =========================

            socket.on(
                'authenticate',
                async ({ token } = {}) => {

                    try {

                        if (!token) {

                            socket.emit(
                                'auth-error',
                                {
                                    error:
                                        'Token missing',
                                }
                            );

                            return;
                        }

                        const decoded =
                            jwt.verify(
                                token,
                                process.env.JWT_SECRET
                            );

                        socket.userId =
                            decoded.userId;

                        this.connectedUsers.set(
                            decoded.userId,
                            socket.id
                        );

                        await authService.setUserOnline(
                            decoded.userId,
                            true
                        );

                        console.log(
                            '[WS] Authenticated:',
                            decoded.userId
                        );

                        socket.emit(
                            'authenticated',
                            {
                                userId:
                                    decoded.userId,
                            }
                        );

                    } catch (error) {

                        console.error(
                            '[WS] Auth error:',
                            error
                        );

                        socket.emit(
                            'auth-error',
                            {
                                error:
                                    'Invalid token',
                            }
                        );
                    }
                }
            );

            // =========================
            // FIND MATCH
            // =========================

            socket.on(
                'find-match',
                async ({ category } = {}) => {

                    try {

                        console.log(
                            '[MATCH] Find match:',
                            socket.userId,
                            category
                        );

                        // auth check
                        if (!socket.userId) {

                            socket.emit(
                                'error',
                                {
                                    error:
                                        'Not authenticated',
                                }
                            );

                            return;
                        }

                        // category validation
                        if (
                            !matchingService.CATEGORIES.includes(
                                category
                            )
                        ) {

                            socket.emit(
                                'error',
                                {
                                    error:
                                        'Invalid category',
                                }
                            );

                            return;
                        }

                        // impede múltiplos matchs
                        if (
                            socket.currentRoom
                        ) {

                            socket.emit(
                                'error',
                                {
                                    error:
                                        'Already in room',
                                }
                            );

                            return;
                        }

                        // remove usuário de filas anteriores
                        matchingService.leaveAllQueues(
                            socket.userId
                        );

                        const result =
                            matchingService.joinQueue(
                                socket.userId,
                                socket.id,
                                category
                            );

                        // =========================
                        // MATCH FOUND
                        // =========================

                        if (
                            result.matched
                        ) {

                            console.log(
                                '[MATCH] Room created:',
                                result.roomId
                            );

                            const user1 =
                                await authService.getUserById(
                                    socket.userId
                                );

                            const user2 =
                                await authService.getUserById(
                                    result.partnerId
                                );

                            const partnerSocket =
                                io.sockets.sockets.get(
                                    result.partnerSocketId
                                );

                            if (
                                !partnerSocket ||
                                !partnerSocket.userId ||
                                String(partnerSocket.userId) ===
                                    String(socket.userId)
                            ) {

                                console.warn(
                                    '[MATCH] Ignoring stale/self partner:',
                                    result.partnerId
                                );

                                matchingService.leaveRoom(
                                    result.roomId,
                                    socket.userId
                                );

                                const retry =
                                    matchingService.joinQueue(
                                        socket.userId,
                                        socket.id,
                                        category
                                    );

                                socket.emit(
                                    'queue-status',
                                    {
                                        category:
                                            retry.category,
                                        position:
                                            retry.queuePosition,
                                        estimatedWait:
                                            retry.estimatedWait,
                                    }
                                );

                                return;
                            }

                            // entra AUTOMATICAMENTE na room
                            socket.join(
                                result.roomId
                            );

                            socket.currentRoom =
                                result.roomId;

                            partnerSocket.join(
                                result.roomId
                            );

                            partnerSocket.currentRoom =
                                result.roomId;

                            // emite match
                            socket.emit(
                                'match-found',
                                {
                                    roomId:
                                        result.roomId,

                                    category:
                                        result.category,

                                    partner: {
                                        username:
                                            user2
                                                ?.username ||
                                            'User',
                                    },
                                }
                            );

                            partnerSocket.emit(
                                'match-found',
                                {
                                    roomId:
                                        result.roomId,

                                    category:
                                        result.category,

                                    partner: {
                                        username:
                                            user1
                                                ?.username ||
                                            'User',
                                    },
                                }
                            );

                            return;
                        }

                        // =========================
                        // WAITING QUEUE
                        // =========================

                        socket.emit(
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

                    } catch (error) {

                        console.error(
                            '[MATCH] Error:',
                            error
                        );

                        socket.emit(
                            'error',
                            {
                                error:
                                    'Matchmaking failed',
                            }
                        );
                    }
                }
            );

            // =========================
            // CANCEL MATCHING
            // =========================

            socket.on(
                'cancel-matching',
                () => {

                    if (!socket.userId)
                        return;

                    console.log(
                        '[MATCH] Cancel matching:',
                        socket.userId
                    );

                    matchingService.leaveAllQueues(
                        socket.userId
                    );

                    socket.emit(
                        'matching-cancelled',
                        {
                            success: true,
                        }
                    );
                }
            );

            // =========================
            // SEND MESSAGE
            // =========================

           // =========================
// SEND MESSAGE
// =========================
        
            socket.on(
                'send-message',
                async (
                    {
                        roomId,
                        text,
                    } = {}
                ) => {
                
                    try {
                    
                        // valida payload
                        if (
                            !roomId ||
                            !text ||
                            !socket.userId
                        ) {
                            return;
                        }
                    
                        // busca sala
                        const room =
                            matchingService.getRoom(
                                roomId
                            );
                        
                        // sala inexistente
                        if (!room) {
                        
                            socket.emit(
                                'error',
                                {
                                    error:
                                        'Room not found',
                                }
                            );
                        
                            return;
                        }
                    
                        // =========================
                        // AUTHORIZATION VALIDATION
                        // =========================
                    
                        const isUserInRoom =
                    
                            room.user1Id ===
                                socket.userId ||
                    
                            room.user2Id ===
                                socket.userId;
                    
                        if (!isUserInRoom) {
                        
                            console.warn(
                                '[CHAT] Unauthorized room access:',
                                socket.userId,
                                roomId
                            );
                        
                            socket.emit(
                                'error',
                                {
                                    error:
                                        'Not authorized for this room',
                                }
                            );
                        
                            return;
                        }
                    
                        // atualiza atividade da sala
                        room.lastActivity =
                            new Date();
                    
                        // busca remetente
                        const sender =
                            await authService.getUserById(
                                socket.userId
                            );
                        
                        console.log(
                            '[CHAT] Message:',
                            text
                        );
                    
                        // envia mensagem
                        this.io
                            .to(roomId)
                            .emit(
                                'new-message',
                                {
                                    id:
                                        uuidv4(),
                                
                                    text:
                                        text.trim(),
                                
                                    senderId:
                                        socket.userId,
                                
                                    username:
                                        sender?.username ||
                                        'User',
                                
                                    timestamp:
                                        new Date(),
                                }
                            );
                        
                    } catch (error) {
                    
                        console.error(
                            '[CHAT] Error:',
                            error
                        );
                    
                        socket.emit(
                            'error',
                            {
                                error:
                                    'Failed to send message',
                            }
                        );
                    }
                }
            );
            // =========================
            // TYPING
            // =========================

            socket.on(
                'typing-start',
                () => {

                    if (
                        socket.currentRoom
                    ) {

                        socket
                            .to(
                                socket.currentRoom
                            )
                            .emit(
                                'partner-typing',
                                {
                                    isTyping:
                                        true,
                                }
                            );
                    }
                }
            );

            socket.on(
                'typing-stop',
                () => {

                    if (
                        socket.currentRoom
                    ) {

                        socket
                            .to(
                                socket.currentRoom
                            )
                            .emit(
                                'partner-typing',
                                {
                                    isTyping:
                                        false,
                                }
                            );
                    }
                }
            );

            // =========================
            // LEAVE ROOM
            // =========================

            socket.on(
                'leave-room',
                ({ roomId } = {}) => {

                    console.log(
                        '[ROOM] Leave:',
                        roomId
                    );

                    this.handleLeaveRoom(
                        socket,
                        roomId
                    );
                }
            );

            // =========================
            // DISCONNECT
            // =========================

            socket.on(
                'disconnect',
                async () => {

                    console.log(
                        '[WS] Disconnect:',
                        socket.userId
                    );
                    if (
                        !socket.userId
                    ) {
                        return;
                    }
                    await authService.setUserOnline(
                        socket.userId,
                        false
                    );
                    matchingService.leaveAllQueues(
                        socket.userId
                    );
                    this.connectedUsers.delete(
                        socket.userId
                    );
                    this.handleLeaveRoom(
                        socket,
                        socket.currentRoom,
                        true
                    );
                }
            );
        });
        // =========================
        // CLEANUP
        // =========================
        setInterval(() => {
            matchingService.cleanupInactiveRooms();
        }, 5 * 60 * 1000);
    }
    // =========================
    // LEAVE ROOM
    // =========================
    handleLeaveRoom(
        socket,
        roomId = null,
        isDisconnect = false
    ) {
        const targetRoom =
            roomId ||
            socket.currentRoom;
        if (!targetRoom) {
            return;
        }
        const roomData =
            matchingService.leaveRoom(
                targetRoom,
                socket.userId
            );
        if (roomData) {
            socket
                .to(targetRoom)
                .emit(
                    'partner-left',
                    {
                        roomId:
                            targetRoom,
                        message:
                            isDisconnect
                                ? 'Partner disconnected'
                                : 'Partner left',
                    }
                );
            this.requeuePartner(
                roomData
            );
        }
        socket.leave(targetRoom);
        socket.currentRoom = null;
    }
    // =========================
    // REQUEUE PARTNER
    // =========================
    async requeuePartner(
        roomData
    ) {
        if (
            !roomData.partnerSocketId
        ) {
            return;
        }
        const partnerSocket =
            this.io.sockets.sockets.get(
                roomData.partnerSocketId
            );
        if (!partnerSocket) {
            return;
        }
        partnerSocket.currentRoom =
            null;
        partnerSocket.emit(
            'partner-disconnected',
            {
                message:
                    'Finding another user...',
            }
        );
        setTimeout(async () => {
            if (
                !partnerSocket.userId
            ) {
                return;
            }
            const result =
                matchingService.joinQueue(
                    partnerSocket.userId,
                    partnerSocket.id,
                    roomData.category
                );
            if (result.matched) {
                const newPartnerSocket =
                    this.io.sockets.sockets.get(
                        result.partnerSocketId
                    );

                if (
                    !newPartnerSocket ||
                    !newPartnerSocket.userId ||
                    String(newPartnerSocket.userId) ===
                        String(partnerSocket.userId)
                ) {

                    console.warn(
                        '[MATCH] Requeue ignored stale/self partner:',
                        result.partnerId
                    );

                    matchingService.leaveRoom(
                        result.roomId,
                        partnerSocket.userId
                    );

                    const retry =
                        matchingService.joinQueue(
                            partnerSocket.userId,
                            partnerSocket.id,
                            roomData.category
                        );

                    partnerSocket.emit(
                        'queue-status',
                        {
                            category:
                                retry.category,
                            position:
                                retry.queuePosition,
                            estimatedWait:
                                retry.estimatedWait,
                        }
                    );

                    return;
                }

                partnerSocket.join(
                    result.roomId
                );
                partnerSocket.currentRoom =
                    result.roomId;
                newPartnerSocket.join(
                    result.roomId
                );
                newPartnerSocket.currentRoom =
                    result.roomId;
                partnerSocket.emit(
                    'match-found',
                    {
                        roomId:
                            result.roomId,
                        category:
                            result.category,
                        partner: {
                            username:
                                'User',
                        },
                    }
                );
                newPartnerSocket.emit(
                    'match-found',
                    {
                        roomId:
                            result.roomId,
                        category:
                            result.category,
                        partner: {
                            username:
                                'User',
                        },
                    }
                );
                return;
            }
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
        }, 1000);
    }
    // =========================
    // STATS
    // =========================
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    isInitialized() {
        return Boolean(this.io);
    }
}
module.exports =
    new WebSocketService();
