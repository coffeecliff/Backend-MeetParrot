const { Pool } = require('pg');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
      }

      const isLocalDatabase = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
      const useSsl = process.env.DATABASE_SSL === 'true' || (!isLocalDatabase && process.env.DATABASE_SSL !== 'false');

      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false
      });

      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('💾 PostgreSQL connected successfully');
      
      // Create tables
      await this.initTables();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async initTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_online BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `;

    await this.pool.query(createUsersTable);
    console.log('✅ Tables created/verified');
  }

  async query(text, params) {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async get(text, params) {
    const result = await this.pool.query(text, params);
    return result.rows[0] || null;
  }

  async run(text, params) {
    const result = await this.pool.query(text, params);
    return { id: result.rows[0]?.id };
  }

  async healthCheck() {
    try {
      if (!this.pool) return false;
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('💾 Database connection closed');
    }
  }
}

module.exports = new Database();
