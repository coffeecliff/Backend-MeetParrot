const express = require('express');
const chatController = require('../controller/chat.controller')
const authMiddleware = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation.middleware');
const { chatLimiter, messageLimiter} = require ('../middleware/rateLimit.middleware');
const router = express.Router();
router.use(authMiddleware);
router.use(chatLimiter);

router.get('/rooms',
    chatController.getRooms
);

router.get('/rooms/:roomId/messages',
    chatController.getRoomMessages
);

router.post('/rooms/:roomId/messages',
    messageLimiter,
    validate(schemas.message),
    chatController.sendMessage
);

router.post('/rooms/:roomId/leave',
    chatController.leaveRoom
);
module.exports = router;