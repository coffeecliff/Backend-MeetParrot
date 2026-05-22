const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../database/database');

class AuthService {
  async register(username, email, password) {
    const existingEmail = await database.get(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail) {
      throw new Error('Email is already in use');
    }

    const existingUsername = await database.get(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUsername) {
      throw new Error('Username is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await database.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email, passwordHash]
    );
    const userId = result[0].id;

    const token = this.signToken({ userId, email });

    return {
      user: {
        id: userId,
        username,
        email
      },
      token
    };
  }

  async login(email, password) {
    const user = await database.get(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    await database.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, is_online = TRUE WHERE id = $1',
      [user.id]
    );

    const token = this.signToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    };
  }

  async getUserById(userId) {
    return await database.get(
      'SELECT id, username, email, is_online FROM users WHERE id = $1',
      [userId]
    );
  }

  async setUserOnline(userId, isOnline) {
    await database.query(
      'UPDATE users SET is_online = $1 WHERE id = $2',
      [isOnline, userId]
    );
  }

  signToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }
}

module.exports = new AuthService();
