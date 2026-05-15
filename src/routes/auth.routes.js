const express = require('express');
const AuthController = require('../controller/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const {validate, schemas} = require('../middleware/validation.middleware');
const {authLimiter} = require('../middleware/rateLimit.middleware');
const authController = require('../controller/auth.controller');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), authController.register);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/logout', authMiddleware, authController.logout);


module.exports = router;