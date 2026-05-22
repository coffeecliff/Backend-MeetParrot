const { v4: uuidv4 } = require('uuid');

const CATEGORIES = ['movies', 'games', 'series', 'books'];

const waitingQueues = CATEGORIES.reduce((queues, category) => {
  queues[category] = [];
  return queues;
}, {});

const activeRooms = new Map();

class MatchingService {
  sameUser(userA, userB) {
    return String(userA) === String(userB);
  }

  joinQueue(userId, socketId, category) {

    // remove usuário de todas filas anteriores
    this.leaveAllQueues(userId);

    // impede usuário em múltiplas salas
    const existingRoom = this.getUserRoom(userId);

    if (existingRoom) {
      return {
        matched: true,
        roomId: existingRoom.id,
        category: existingRoom.category,
        partnerId:
          this.sameUser(existingRoom.user1Id, userId)
            ? existingRoom.user2Id
            : existingRoom.user1Id,

        partnerSocketId:
          this.sameUser(existingRoom.user1Id, userId)
            ? existingRoom.user2SocketId
            : existingRoom.user1SocketId,
      };
    }

    const queue = waitingQueues[category];

    if (!queue) {
      throw new Error('Invalid category');
    }

    // impede duplicação na fila
    const alreadyQueued = queue.find(
      item => this.sameUser(item.userId, userId)
    );

    if (alreadyQueued) {
      return {
        matched: false,
        category,
        queuePosition:
          queue.findIndex(
            q => this.sameUser(q.userId, userId)
          ) + 1,

        estimatedWait:
          this.calculateEstimatedWait(
            queue.length
          ),
      };
    }

    // tenta achar parceiro válido
    while (queue.length > 0) {

      const partner = queue.shift();

      // ignora inválidos
      if (
        !partner ||
        this.sameUser(partner.userId, userId) ||
        partner.socketId === socketId
      ) {
        continue;
      }

      const roomId = uuidv4();

      const room = {
        id: roomId,

        category,

        user1Id: partner.userId,
        user2Id: userId,

        user1SocketId: partner.socketId,
        user2SocketId: socketId,

        status: 'active',

        createdAt: new Date(),

        // importante para cleanup
        lastActivity: new Date(),
      };

      activeRooms.set(roomId, room);

      console.log(
        '[MATCHING] Room created:',
        roomId
      );

      return {
        matched: true,
        roomId,
        category,
        partnerId: partner.userId,
        partnerSocketId: partner.socketId,
      };
    }

    // adiciona na fila
    queue.push({
      userId,
      socketId,
      timestamp: Date.now(),
    });

    console.log(
      '[MATCHING] Added to queue:',
      userId,
      category
    );

    return {
      matched: false,
      category,
      queuePosition: queue.length,
      estimatedWait:
        this.calculateEstimatedWait(
          queue.length
        ),
    };
  }

  leaveQueue(userId, category = null) {

    if (category) {

      const queue = waitingQueues[category];

      if (!queue) {
        return false;
      }

      const index = queue.findIndex(
        item => this.sameUser(item.userId, userId)
      );

      if (index === -1) {
        return false;
      }

      queue.splice(index, 1);

      return true;
    }

    this.leaveAllQueues(userId);

    return true;
  }

  leaveAllQueues(userId) {

    Object.keys(waitingQueues).forEach(
      category => {

        const queue =
          waitingQueues[category];

        const index = queue.findIndex(
          item => this.sameUser(item.userId, userId)
        );

        if (index > -1) {
          queue.splice(index, 1);
        }
      }
    );
  }

  getRoom(roomId) {
    return activeRooms.get(roomId);
  }

  getUserRoom(userId) {

    return Array.from(
      activeRooms.values()
    ).find(
      room =>
        this.sameUser(room.user1Id, userId) ||
        this.sameUser(room.user2Id, userId)
    );
  }

  getUserRooms(userId) {

    return Array.from(
      activeRooms.values()
    ).filter(
      room =>
        this.sameUser(room.user1Id, userId) ||
        this.sameUser(room.user2Id, userId)
    );
  }

  leaveRoom(roomId, userId) {

    const room =
      activeRooms.get(roomId);

    if (!room) {
      return null;
    }

    activeRooms.delete(roomId);

    const partnerId =
      this.sameUser(room.user1Id, userId)
        ? room.user2Id
        : room.user1Id;

    const partnerSocketId =
      this.sameUser(room.user1Id, userId)
        ? room.user2SocketId
        : room.user1SocketId;

    return {
      ...room,

      partnerId,

      partnerSocketId,

      status: 'ended',

      endedAt: new Date(),
    };
  }

  calculateEstimatedWait(queuePosition) {

    const estimatedSeconds =
      queuePosition * 15;

    return estimatedSeconds < 60
      ? `${estimatedSeconds}s`
      : `${Math.ceil(
          estimatedSeconds / 60
        )}m`;
  }

  getQueueStats() {

    return {
      movies:
        waitingQueues.movies.length,

      games:
        waitingQueues.games.length,

      series:
        waitingQueues.series.length,

      books:
        waitingQueues.books.length,

      activeRooms:
        activeRooms.size,
    };
  }

  cleanupInactiveRooms() {

    const now = Date.now();

    const maxInactiveTime =
      5 * 60 * 1000;

    for (const [roomId, room] of activeRooms.entries()) {

      const lastActivity =
        room.lastActivity || room.createdAt;

      const inactiveTime =
        now - lastActivity.getTime();

      if (inactiveTime > maxInactiveTime) {

        console.log(
          '[MATCHING] Removing inactive room:',
          roomId
        );

        activeRooms.delete(roomId);
      }
    }
  }
}

module.exports = new MatchingService();

module.exports.CATEGORIES = CATEGORIES;
