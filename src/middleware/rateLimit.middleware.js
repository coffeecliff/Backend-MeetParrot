const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: 'Too many requests from this IP, please try again after 5 minutes.',
    standardHeaders: true,
});

const messageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many messages sent from this IP, please try again after a minute.',
    standardHeaders: true
});

const chatLimiter = rateLimit({
    windowMs: 3 * 60 * 1000,
    max: 50,
    message: 'To many chat connections from this IP, please try again after a minute.',
    standardHeaders: true,
});
module.exports = { authLimiter, messageLimiter, chatLimiter };