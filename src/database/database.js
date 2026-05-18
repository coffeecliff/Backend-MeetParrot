const { Pool } = require('pg');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
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
    const result = await this.pool.query(text + ' RETURNING id', params);
    return { id: result.rows[0]?.id };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('💾 Database connection closed');
    }
  }
}

module.exports = new Database();