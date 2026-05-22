const users = [];

jest.mock('./database/database', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue(true),
  get: jest.fn(async (query, params) => {
    if (query.includes('WHERE email = $1')) {
      return users.find(user => user.email === params[0]) || null;
    }

    if (query.includes('WHERE username = $1')) {
      return users.find(user => user.username === params[0]) || null;
    }

    if (query.includes('WHERE id = $1')) {
      return users.find(user => user.id === params[0]) || null;
    }

    return null;
  }),
  query: jest.fn(async (query, params) => {
    if (query.startsWith('INSERT INTO users')) {
      const user = {
        id: users.length + 1,
        username: params[0],
        email: params[1],
        password: params[2],
        is_online: false
      };
      users.push(user);
      return [{ id: user.id }];
    }

    if (query.startsWith('UPDATE users')) {
      const user = users.find(item => item.id === params[params.length - 1]);
      if (user) {
        user.is_online = query.includes('is_online = TRUE') ? true : params[0];
      }
      return [];
    }

    return [];
  }),
  run: jest.fn().mockResolvedValue({})
}));

const request = require('supertest');
const app = require('./app');
const database = require('./database/database');

describe('MeetStranger API', () => {
  afterAll(async () => {
    await database.close();
  });

  test('GET /api/health should return healthy status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.services.database).toBe('connected');
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
    expect(response.body.data.user.email).toBe(userData.email);
  });

  test('GET /api/matching/stats should return queue stats', async () => {
    const userData = {
      username: `statsuser${Date.now()}`,
      email: `stats${Date.now()}@example.com`,
      password: 'testpass123'
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const token = registerRes.body.data.token;

    const response = await request(app)
      .get('/api/matching/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.movies).toBeDefined();
    expect(response.body.data.gaming).toBeDefined();
    expect(response.body.data.music).toBeDefined();
    expect(response.body.data.study).toBeDefined();
  });
});
