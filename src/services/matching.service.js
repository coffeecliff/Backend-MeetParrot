const { v4: uuidv4 } = require('uuid');

// Filas por categoria (em memória para P2P dinâmico)
const waitingQueues = {
  jogos: [],
  series: [],
  filmes: []
};

// Salas ativas: roomId -> room
const activeRooms = new Map();

// Controle de sala ativa por usuário: userId -> roomId
// Garante que 1 usuário = 1 sala ativa no máximo
const activeUserRooms = new Map();

// Timeout de fila: 5 minutos
const QUEUE_TIMEOUT_MS = 5 * 60 * 1000;

// Timeout de sala inativa: 10 minutos
const ROOM_TIMEOUT_MS = 10 * 60 * 1000;

class MatchingService {

  // ─── Fila ─────────────────────────────────────────────────────────────────

  joinQueue(userId, socketId, category) {
    console.log(`📥 joinQueue called: userId=${userId}, category=${category}`);

    // Remove de todas as filas se já estava em alguma
    this.leaveAllQueues(userId);

    const queue = waitingQueues[category];
    if (!queue) {
      console.log(`❌ Invalid category: ${category}`);
      throw new Error('Invalid category');
    }

    // Valida se o usuário já possui sala ativa antes de entrar na fila
    const existingRoomId = activeUserRooms.get(userId);
    if (existingRoomId && activeRooms.has(existingRoomId)) {
      console.log(`⚠️ User ${userId} already has active room ${existingRoomId}`);
      const room = activeRooms.get(existingRoomId);
      return {
        matched: true,
        roomId: existingRoomId,
        category: room.category,
        partnerId: room.user1Id === userId ? room.user2Id : room.user1Id,
        partnerSocketId: room.user1Id === userId ? room.user2SocketId : room.user1SocketId,
        alreadyMatched: true
      };
    }

    console.log(`📊 Queue for ${category}:`, queue.length, 'users waiting');

    if (queue.length > 0) {
      // Match encontrado
      const partner = queue.shift();
      const roomId = uuidv4();

      console.log(`🎯 Match found! Partner: ${partner.userId}, Room: ${roomId}`);

      const room = {
        id: roomId,
        category,
        user1Id: partner.userId,
        user2Id: userId,
        user1SocketId: partner.socketId,
        user2SocketId: socketId,
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      activeRooms.set(roomId, room);
      activeUserRooms.set(partner.userId, roomId);
      activeUserRooms.set(userId, roomId);

      console.log(`🏠 Room created: ${roomId}`);

      return {
        matched: true,
        roomId,
        category,
        partnerId: partner.userId,
        partnerSocketId: partner.socketId
      };
    } else {
      // Adiciona à fila com timestamp para controle de timeout
      const queueItem = {
        userId,
        socketId,
        category,
        joinedAt: Date.now()
      };

      queue.push(queueItem);
      console.log(`⏳ Added to queue. Position: ${queue.length}`);

      return {
        matched: false,
        category,
        queuePosition: queue.length,
        estimatedWait: this.calculateEstimatedWait(queue.length)
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
      }
    } else {
      this.leaveAllQueues(userId);
    }
    return false;
  }

  leaveAllQueues(userId) {
    Object.keys(waitingQueues).forEach(category => {
      this.leaveQueue(userId, category);
    });
  }

  // Retorna usuários na fila que estão além do timeout
  getExpiredQueueItems() {
    const now = Date.now();
    const expired = [];

    Object.keys(waitingQueues).forEach(category => {
      waitingQueues[category].forEach(item => {
        if (now - item.joinedAt > QUEUE_TIMEOUT_MS) {
          expired.push({ ...item, category });
        }
      });
    });

    return expired;
  }

  // ─── Salas ────────────────────────────────────────────────────────────────

  getRoom(roomId) {
    return activeRooms.get(roomId);
  }

  getUserRoom(userId) {
    const roomId = activeUserRooms.get(userId);
    if (roomId) return activeRooms.get(roomId) ?? null;
    return null;
  }

  updateRoomActivity(roomId) {
    const room = activeRooms.get(roomId);
    if (room) {
      room.lastActivity = new Date();
    }
  }

  leaveRoom(roomId, userId) {
    const room = activeRooms.get(roomId);
    if (room) {
      activeRooms.delete(roomId);
      activeUserRooms.delete(room.user1Id);
      activeUserRooms.delete(room.user2Id);

      const partnerId = room.user1Id === userId ? room.user2Id : room.user1Id;
      const partnerSocketId = room.user1Id === userId ? room.user2SocketId : room.user1SocketId;

      return {
        ...room,
        partnerId,
        partnerSocketId,
        status: 'ended',
        endedAt: new Date()
      };
    }
    return null;
  }

  // ─── Sessão do usuário ────────────────────────────────────────────────────

  getSessionState(userId) {
    const roomId = activeUserRooms.get(userId) ?? null;
    const room = roomId ? activeRooms.get(roomId) : null;

    // Verifica se está na fila
    let inQueue = false;
    let queueCategory = null;
    Object.keys(waitingQueues).forEach(category => {
      if (waitingQueues[category].some(item => item.userId === userId)) {
        inQueue = true;
        queueCategory = category;
      }
    });

    return {
      inQueue,
      category: room?.category ?? queueCategory ?? null,
      currentRoom: roomId && room ? roomId : null
    };
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  cleanupInactiveRooms() {
    const now = Date.now();
    const removed = [];

    for (const [roomId, room] of activeRooms.entries()) {
      const lastActivity = room.lastActivity ?? room.createdAt;
      if (now - lastActivity.getTime() > ROOM_TIMEOUT_MS) {
        activeRooms.delete(roomId);
        activeUserRooms.delete(room.user1Id);
        activeUserRooms.delete(room.user2Id);
        removed.push(roomId);
        console.log(`🧹 Cleaned up inactive room: ${roomId}`);
      }
    }

    return removed;
  }

  cleanupExpiredQueues() {
    const now = Date.now();
    const expired = [];

    Object.keys(waitingQueues).forEach(category => {
      const before = waitingQueues[category].length;
      waitingQueues[category] = waitingQueues[category].filter(item => {
        if (now - item.joinedAt > QUEUE_TIMEOUT_MS) {
          expired.push({ ...item, category });
          return false;
        }
        return true;
      });
      const removed = before - waitingQueues[category].length;
      if (removed > 0) {
        console.log(`🧹 Removed ${removed} expired queue item(s) from ${category}`);
      }
    });

    return expired;
  }

  // ─── Utilitários ──────────────────────────────────────────────────────────

  calculateEstimatedWait(queuePosition) {
    const avgWaitTime = 15;
    const estimatedSeconds = queuePosition * avgWaitTime;
    return estimatedSeconds < 60
      ? `${estimatedSeconds}s`
      : `${Math.ceil(estimatedSeconds / 60)}m`;
  }

  getQueueStats() {
    return {
      jogos: waitingQueues.jogos.length,
      series: waitingQueues.series.length,
      filmes: waitingQueues.filmes.length,
      activeRooms: activeRooms.size
    };
  }
}

module.exports = new MatchingService();