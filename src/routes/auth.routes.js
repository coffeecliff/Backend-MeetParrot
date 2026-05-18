const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// Public routes
router.post('/register', 
  // authLimiter,
  validate(schemas.register),
  authController.register
);

router.post('/login',
  // authLimiter,
  validate(schemas.login),
  authController.login
);

// Protected routes
router.post('/logout',
  authMiddleware,
  authController.logout
);

router.get('/profile',
  authMiddleware,
  authController.getProfile
);

module.exports = router;