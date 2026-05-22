const matchingService = require('../services/matching.service');

class ChatController {
  async getRooms(req, res) {
    try {
      const rooms = matchingService.getUserRooms(req.user.userId);

      res.json({
        success: true,
        data: {
          rooms: rooms.map(room => ({
            id: room.id,
            category: room.category,
            status: room.status,
            partner: { username: 'Anonymous' },
            createdAt: room.createdAt
          }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRoomMessages(req, res) {
    try {
      const { roomId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const room = matchingService.getRoom(roomId);

      if (!room || (room.user1Id !== req.user.userId && room.user2Id !== req.user.userId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this room'
        });
      }

      res.json({
        success: true,
        data: {
          messages: [],
          pagination: {
            page: Number.parseInt(page, 10),
            limit: Number.parseInt(limit, 10),
            total: 0,
            hasMore: false
          }
        },
        message: 'Messages are transient and delivered through WebSocket'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async sendMessage(req, res) {
    try {
      const { roomId } = req.params;
      const { text } = req.body;
      const room = matchingService.getRoom(roomId);

      if (!room || (room.user1Id !== req.user.userId && room.user2Id !== req.user.userId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this room'
        });
      }

      res.status(201).json({
        success: true,
        data: { roomId, text },
        message: 'Use WebSocket event send-message for real-time delivery'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async leaveRoom(req, res) {
    try {
      const { roomId } = req.params;
      const room = matchingService.leaveRoom(roomId, req.user.userId);

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found'
        });
      }

      res.json({
        success: true,
        message: 'Left chat room successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ChatController();
