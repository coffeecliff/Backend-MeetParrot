const {V4:uuidv4} = require('uuid');

const waitingQueues = {
    Games:[],
    Series:[],
    Movies:[],
    Books:[]
};

const activeRooms = new Map();

class MatchingService {
    joinQueue(userId, socketID, category) {
        console.log(`User ${userId} joined ${category} queue with socket ${socketID}`);
        this.leaveQueue(userId);
        const queue = waitingQueues[category];
        if (!queue) {
            throw new Error('Invalid category');
        }
        console.log(`Current ${category} queue:`, queue);
        console.log(`users waiting:`,queue.length);

        if (queue.length > 0) {
            const partner = queue.shift();
            const roomId = uuidv4();

            const room = {
                id: roomId,
                userId1: partner.userId,
                userId2: userId,
                user1SocketID: partner.socketID,
                user2SocketID: socketID,
                status: 'active',
                category,
                createdAt: new Date()
            };
            activeRooms.set(roomId, room);
            console.log(`Matched ${userId} with ${partner.userId} in room ${roomId}`);
            return {
                matched : true,
                roomId,
                category,
                partnerId: partner.userId,
                partnerSocketID: partner.socketID
            };
        } else {
            const queueItem = { userId, socketID, timestamp: new Date() };
            queue.push(queueItem);
            return { 
                matched: false, 
                category, 
                position: queue.length, 
                estimatedWaiting: this.estimatedWaiting(queue.length)                
            };
        }
    }
    leaveQueue(userId, category = null) {
        if (category) {
            const queue = waitingQueues[category];
        if (queue) {
            const index = queue.findIndex(item => item.userId === userId);
            if (index > -1) {
                queue.splice(index, 1);
                return true;
            }
        } else {
            this.leaveQueueFromAllCategories(userId);
        }
        return false;
        }
    }
    leaveQueueFromAllCategories(userId) {
        Object.keys(waitingQueues).forEach(category => {
            this.leaveQueue(userId, category);
        });
    }
    getRoom(roomId) {
        return activeRooms.get(roomId);
    }
    getUserRoom(userId) {
        return Array.from(activeRooms.values()).find(room => room.userId || room.userId2 === userId);
    }
    leaveRoom(userId, roomId) {
        const room = activeRooms.get(roomId);
        if (room) {
            activeRooms.delete(roomId);
            const partnerId = room.userId1 === userId ? room.userId2 : room.userId1;
            const partnerSocketID = room.userId1 === userId ? room.user1SocketID : room.user2SocketID;
            return {...room, partnerId, partnerSocketID, status: 'ended', endedAt: new Date()};
        } return null;
    }
    calculateWaitingTime(queuePosition) {
        const averageMatchTime = 30;
        const estimatedSeconds = queuePosition * averageMatchTime;
        if (estimatedSeconds < 60) {
            return `${minutes} minute(s) ${seconds} second(s)`;
        }
    }
    getQueueStatus() {
        return{
            Games: waitingQueues.Games.length,
            Series: waitingQueues.Series.length,
            Movies: waitingQueues.Movies.length,
            Books: waitingQueues.Books.length,
            activeRooms: activeRooms.size
        }
    }
    cleanupInactiveRooms() {
        const now = new Date();
        const timeout = 5 * 60 *  1000; //5 min
        activeRooms.forEach((room, roomId) => {
            if (now - room.createdAt > timeout) {
                activeRooms.delete(roomId);
                console.log(`Cleaned up inactive room ${roomId}`)
            }
        });
    }
}
module.exports = new MatchingService();