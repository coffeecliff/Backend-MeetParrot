const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute for testing
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down.'
  }
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per room
  message: {
    success: false,
    message: 'Too many messages, please slow down.'
  }
});

module.exports = {
  authLimiter,
  chatLimiter,
  messageLimiter
};