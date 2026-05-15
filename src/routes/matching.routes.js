const express = require('express');
const MatchingController = require('../controller/matching.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation.middleware');
const { chatLimiter } = require('../middleware/rateLimit.middleware');
const { joinQueue } = require('../services/matching.service');
const matchingController = require('../controller/matching.controller');
const router = express.Router();

router.use(authMiddleware);
router.use(chatLimiter);

router.post('/join',
    validate(schemas.joinQueue),
    matchingController.joinQueue
);

router.delete('/leave',
    matchingController.leaveQueue
);

router.get('/stats',
    matchingController.getQueueStats
);

module.exports = router;