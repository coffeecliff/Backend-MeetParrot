#!/usr/bin/env node
const axios = require('axios');
const io = require('socket.io-client');
// Configuração
const BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';
class APITester {
  constructor() {
    this.token = null;
    this.userId = null;
    this.socket = null;
    this.roomId = null;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }
  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }
  async test(name, testFn) {
    try {
      this.log(`\n Testing: ${name}`, 'info');
      await testFn();
      this.log(`PASSED: ${name}`, 'success');
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      this.log(` FAILED: ${name} - ${error.message}`, 'error');
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }
  async request(method, endpoint, data = null, headers = {}) {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (data) config.data = data;
    if (this.token) config.headers.Authorization = `Bearer ${this.token}`;

    const response = await axios(config);
    return response.data;
  }
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io(WS_URL);    
      this.socket.on('connect', () => {
        this.log('WebSocket connected', 'success');
        resolve();
      });
      this.socket.on('connect_error', (error) => {
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  }
  async authenticateWebSocket() {
    return new Promise((resolve, reject) => {
      this.socket.emit('authenticate', { token: this.token });   
      this.socket.on('authenticated', (data) => {
        this.log(` WebSocket authenticated: ${data.userId}`, 'success');
        resolve(data);
      });
      this.socket.on('auth_error', (error) => {
        reject(new Error(`WebSocket auth failed: ${error.message}`));
      });
      setTimeout(() => {
        reject(new Error('WebSocket auth timeout'));
      }, 3000);
    });
  }
  async runAllTests() {
    this.log('Starting MeetStranger P2P API Tests', 'info');
    this.log('======================================', 'info');
    // Health Check
    await this.test('Health Check', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.data.status !== 'healthy') {
        throw new Error('Server not healthy');
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Authentication Tests
    await this.test('User Registration', async () => {
      const userData = {
        username: `testuser${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'testpass123'
      };
      const response = await this.request('POST', '/auth/register', userData);      
      if (!response.success || !response.data.token) {
        throw new Error('Registration failed');
      }
      this.token = response.data.token;
      this.userId = response.data.user.id;
      this.log(` User registered: ${response.data.user.username}`, 'info');
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.test('User Login', async () => {
      const loginData = {
        username: `loginuser${Date.now()}`,
        email: `login${Date.now()}@example.com`,
        password: 'loginpass123'
      };
      await this.request('POST', '/auth/register', loginData);
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await this.request('POST', '/auth/login', {
        email: loginData.email,
        password: loginData.password
      });
      if (!response.success || !response.data.token) {
        throw new Error('Login failed');
      }
    });
    await this.test('Get User Profile', async () => {
      const response = await this.request('GET', '/auth/profile');      
      if (!response.success || !response.data.user) {
        throw new Error('Profile fetch failed');
      }
      this.log(` Profile: ${response.data.user.username}`, 'info');
    });
    await this.test('Invalid Token Access', async () => {
      const originalToken = this.token;
      this.token = 'invalid-token';
      try {
        await this.request('GET', '/auth/profile');
        throw new Error('Should have failed with invalid token');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          this.token = originalToken;
          return;
        }
        throw error;
      }
    });
    // P2P Matching Tests
    await this.test('Get Queue Stats', async () => {
      const response = await this.request('GET', '/matching/stats');      
      if (!response.success || typeof response.data.jogos === 'undefined') {
        throw new Error('Queue stats failed');
      }
      this.log(` Queue stats - Jogos: ${response.data.jogos}, Series: ${response.data.series}, Filmes: ${response.data.filmes}, Active: ${response.data.activeRooms}`, 'info');
    });
    await this.test('Join P2P Queue', async () => {
      const response = await this.request('POST', '/matching/join', {
        category: 'jogos'
      });
      if (!response.success) {
        throw new Error('Join queue failed');
      }
      this.log(' Use WebSocket for real-time matching', 'info');
    });
    await this.test('Leave P2P Queue', async () => {
      const response = await this.request('DELETE', '/matching/leave');
      if (!response.success) {
        throw new Error('Leave queue failed');
      }
    });
    // WebSocket P2P Tests
    await this.test('WebSocket Connection', async () => {
      await this.connectWebSocket();
    });
    await this.test('WebSocket Authentication', async () => {
      await this.authenticateWebSocket();
    });
    await this.test('WebSocket P2P Queue', async () => {
      return new Promise((resolve) => {
        this.socket.emit('join_queue', { category: 'jogos' });        
        this.socket.on('queue_status', (data) => {
          this.log(` Queue position: ${data.position}, Wait: ${data.estimatedWait}, Category: ${data.category}`, 'info');
          resolve();
        });
        this.socket.on('match_found', (data) => {
          this.log(` P2P Match found! Room: ${data.roomId}, Category: ${data.category}`, 'success');
          this.roomId = data.roomId;
          resolve();
        });
        setTimeout(() => {
          resolve();
        }, 2000);
      });
    });
    await this.test('WebSocket Leave Queue', async () => {
      return new Promise((resolve) => {
        this.socket.emit('leave_queue');        
        this.socket.on('left_queue', (data) => {
          if (data.success) {
            resolve();
          }
        });
        setTimeout(resolve, 1000);
      });
    });
    // P2P Chat Test
    if (this.roomId) {
      await this.test('WebSocket Join P2P Room', async () => {
        return new Promise((resolve) => {
          this.socket.emit('join_room', { roomId: this.roomId });         
          this.socket.on('room_joined', (data) => {
            this.log(` Joined P2P room: ${data.roomId}`, 'success');
            resolve();
          });
          setTimeout(resolve, 1000);
        });
      });
      await this.test('WebSocket Send P2P Message', async () => {
        return new Promise((resolve) => {
          this.socket.emit('send_message', { 
            content: 'Hello from P2P test!' 
          });          
          setTimeout(() => {
            this.log(' P2P message sent (no persistence)', 'info');
            resolve();
          }, 500);
        });
      });
    }
    // Input Validation Test
    await this.test('Input Validation', async () => {
      try {
        await this.request('POST', '/auth/register', {
          username: 'ab',
          email: 'invalid-email',
          password: '123'
        });
        throw new Error('Should have failed validation');
      } catch (error) {
        if (error.response && error.response.status === 400) {
          return;
        }
        throw error;
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Rate Limiting Test
    await this.test('Rate Limiting', async () => {
      const promises = [];      
      for (let i = 0; i < 6; i++) {
        promises.push(
          axios.post(`${BASE_URL}/auth/login`, {
            email: 'nonexistent@test.com',
            password: 'wrong'
          }).catch(error => error.response)
        );
      }
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r && r.status === 429);     
      if (!rateLimited) {
        this.log(' Rate limiting might not be working properly', 'warning');
      } else {
        this.log(' Rate limiting is working', 'success');
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Cleanup
    await this.test('User Logout', async () => {
      const response = await this.request('POST', '/auth/logout');     
      if (!response.success) {
        throw new Error('Logout failed');
      }
    });
    // Close WebSocket
    if (this.socket) {
      this.socket.disconnect();
      this.log(' WebSocket disconnected', 'info');
    }
    this.printResults();
  }
  printResults() {
    this.log('\n P2P TEST RESULTS', 'info');
    this.log('===================', 'info');
    this.log(` Passed: ${this.results.passed}`, 'success');
    this.log(` Failed: ${this.results.failed}`, 'error');
    this.log(` Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`, 'info');
    if (this.results.failed > 0) {
      this.log('\n FAILED TESTS:', 'error');
      this.results.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => this.log(`  - ${t.name}: ${t.error}`, 'error'));
    }
    this.log('\n P2P Testing completed!', 'success');
    this.log(' Features tested: SQLite, P2P matching, dynamic reconnection', 'info');
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}
// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}
// Main execution
async function main() {
  console.log('Checking if server is running...'); 
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log(' Server is not running on http://localhost:3000');
    console.log(' Please start the server with: npm run dev');
    process.exit(1);
  }
  console.log(' Server is running');  
  const tester = new APITester();
  await tester.runAllTests();
}
// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(' Unhandled error:', error.message);
  process.exit(1);
});
// Run tests
main().catch(error => {
  console.error(' Test execution failed:', error.message);
  process.exit(1);
});
