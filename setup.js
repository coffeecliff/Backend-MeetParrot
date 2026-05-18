const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up MeetStranger Backend...\n');

// Install SQLite3 if not installed
try {
  console.log('📦 Installing SQLite3...');
  execSync('npm install sqlite3', { stdio: 'inherit' });
  console.log('✅ SQLite3 installed successfully\n');
} catch (error) {
  console.error('❌ Error installing SQLite3:', error.message);
  process.exit(1);
}

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file...');
  fs.copyFileSync('.env.example', '.env');
  console.log('✅ .env file created\n');
} else {
  console.log('✅ .env file already exists\n');
}

// Initialize database
console.log('🗄️ Initializing SQLite database...');
require('dotenv').config();
const database = require('./src/database/database');

database.connect()
  .then(() => {
    console.log('✅ Database initialized successfully\n');
    console.log('🎉 Setup completed! You can now run:');
    console.log('   npm run dev    - Start development server');
    console.log('   npm start      - Start production server');
    console.log('   npm test       - Run tests\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  });