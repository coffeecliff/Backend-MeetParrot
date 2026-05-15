require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const YAML = require('yamljs');
const path = require('path');

const database = require('./database/database');
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const matchingRoutes = require('./routes/matching.routes');
const websocketService = require('./services/websocket.service');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

database.connect().catch(console.error);

app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
    origin: "*" 
}));

app.use(express.json({ limit: '10mb' }));

app.get('/api/', (_req, res) => {
    res.json({
        message: 'MeetParrot API',
        version: '2.0.0 - Developing',
        status: 'running',
        author: 'Cauã Cunha Neves',
        description: 'API for the MeetParrot application and management matching'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/matching', matchingRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            websocket: 'active'
        }});});

websocketService.initialize(io);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

process.on('SIGINT', async () => {
    await database.close();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` WebSocket server ready`);
      console.log(` API Documentation: http://localhost:${PORT}/docs`);      
    });
}
module.exports = app;