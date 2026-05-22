const matchingService = require('../services/matching.service');

class MatchingController {
  async joinQueue(req, res) {
    res.json({
      success: true,
      data: {
        category: req.body.category
      },
      message: 'Use WebSocket event find-match for real-time matching'
    });
  }

  async leaveQueue(req, res) {
    try {
      matchingService.leaveAllQueues(req.user.userId);

      res.json({
        success: true,
        message: 'Left all queues'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getQueueStats(req, res) {
    try {
      res.json({
        success: true,
        data: matchingService.getQueueStats()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new MatchingController();
