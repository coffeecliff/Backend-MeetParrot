const request = require('supertest');
const app = require('../src/app');
const database = require('../src/database/database');

describe('MeetStranger API', () => {
  afterAll(async () => {
    await database.close();
  });

  test('GET /api/health should return healthy status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
  });

  test('POST /api/auth/register should create user', async () => {
    const userData = {
      username: `testuser${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'testpass123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });

  test('GET /api/matching/stats should return queue stats', async () => {
    const userData = {
      username: `testuser${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'testpass123'
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    const token = registerRes.body.data.token;

    const response = await request(app)
      .get('/api/matching/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.jogos).toBeDefined();
    expect(response.body.data.series).toBeDefined();
    expect(response.body.data.filmes).toBeDefined();
  });
});