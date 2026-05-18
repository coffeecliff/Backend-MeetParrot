#!/usr/bin/env node

// Quick test script for P2P development (bypass rate limiting)
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function quickTest() {
  console.log('🚀 Quick P2P API Test (No Rate Limit)');
  console.log('=====================================');

  try {
    // Health check
    console.log('1. Health Check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is healthy');

    // Wait to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Register user with unique timestamp
    console.log('2. Register User...');
    const timestamp = Date.now();
    const userData = {
      username: `quicktest_${timestamp}`,
      email: `quick_${timestamp}@test.com`,
      password: 'test123'
    };
    
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, userData);
    const token = registerRes.data.data.token;
    console.log('✅ User registered');

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get profile
    console.log('3. Get Profile...');
    const profileRes = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile retrieved');

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // P2P Queue stats
    console.log('4. P2P Queue Stats...');
    const statsRes = await axios.get(`${BASE_URL}/matching/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Queue stats - Jogos: ${statsRes.data.data.jogos}, Series: ${statsRes.data.data.series}, Filmes: ${statsRes.data.data.filmes}, Active: ${statsRes.data.data.activeRooms}`);

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Join P2P queue
    console.log('5. Join P2P Queue...');
    const joinRes = await axios.post(`${BASE_URL}/matching/join`, {
      category: 'jogos'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ P2P queue join endpoint works');

    console.log('\n🎉 All P2P tests passed!');
    console.log('📚 Full documentation: http://localhost:3000/docs');
    console.log('🔌 Use WebSocket for real-time P2P matching');
    console.log('💾 Database: SQLite (no message persistence)');
    console.log('🎯 Categories: jogos, series, filmes');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

quickTest();