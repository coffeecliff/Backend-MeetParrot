// ===============================
// IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ===============================
// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();
// Importação dos módulos principais da aplicação
const express = require('express');          // Framework HTTP
const http = require('http');                // Servidor HTTP nativo
const socketIo = require('socket.io');       // Comunicação em tempo real (WebSocket)
const cors = require('cors');                // Controle de CORS
const helmet = require('helmet');            // Segurança de headers HTTP
const swaggerUi = require('swagger-ui-express'); // Interface de documentação Swagger
const YAML = require('yamljs');              // Leitura de arquivos YAML
const path = require('path');                // Manipulação de caminhos de arquivos
// Importação de módulos internos da aplicação
const database = require('./database/database');            // Conexão com banco de dados
const authRoutes = require('./routes/auth.routes');         // Rotas de autenticação
const chatRoutes = require('./routes/chat.routes');         // Rotas de chat
const matchingRoutes = require('./routes/matching.routes'); // Rotas de matching
const websocketService = require('./services/websocket.service'); // Serviço de WebSocket
// ===============================
// INICIALIZAÇÃO DO SERVIDOR
// ===============================
// Cria a aplicação Express
const app = express();
// Cria o servidor HTTP baseado no Express
const server = http.createServer(app);
// Inicializa o Socket.IO com configuração de CORS aberta
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
// ===============================
// CONEXÃO COM BANCO DE DADOS
// ===============================
// Inicializa conexão com o banco (tratando possíveis erros)
database.connect().catch(console.error);
// ===============================
// CONFIGURAÇÕES GERAIS DO EXPRESS
// ===============================
// Define confiança em proxy (necessário em ambientes como Render)
app.set('trust proxy', 1);
// ===============================
// MIDDLEWARES GLOBAIS
// ===============================
// Protege a aplicação com headers de segurança
app.use(helmet());
// Habilita CORS para qualquer origem
app.use(cors({
  origin: "*"
}));
// Permite receber JSON com limite de tamanho
app.use(express.json({ limit: '10mb' }));
// ===============================
// DOCUMENTAÇÃO (SWAGGER)
// ===============================
// Carrega o arquivo swagger.yaml
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
// Serve uma página HTML personalizada de documentação
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});
// Disponibiliza o arquivo swagger.yaml diretamente
app.get('/docs/swagger.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/swagger.yaml'));
});
// Configura uma rota alternativa com Swagger UI padrão
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MeetStranger API Documentation'
}));
// ===============================
// ROTAS PRINCIPAIS DA API
// ===============================
app.get('/api/', (_req, res) => {
  res.json({
    message: 'MeetStranger API',
    version: '2.0.0',
    status: 'running'
  });
});
// Rotas de autenticação
app.use('/api/auth', authRoutes);
// Rotas de chat
app.use('/api/chat', chatRoutes);
// Rotas de matching (pareamento)
app.use('/api/matching', matchingRoutes);
// ===============================
// HEALTH CHECK
// ===============================
// Endpoint para verificar se a API está saudável
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy', // Status da aplicação
    timestamp: new Date().toISOString(), // Timestamp atual
    services: {
      database: 'connected', // Status do banco
      websocket: 'active'    // Status do WebSocket
    }
  });
});
// ===============================
// INICIALIZAÇÃO DO WEBSOCKET
// ===============================
// Inicializa lógica de WebSocket passando a instância do io
websocketService.initialize(io);
// ===============================
// TRATAMENTO DE ERROS GLOBAL
// ===============================
// Middleware para captura de erros não tratados
app.use((err, req, res, next) => {
  console.error(err.stack); // Log do erro no console
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});
// ===============================
// FINALIZAÇÃO SEGURA (GRACEFUL SHUTDOWN)
// ===============================
// Captura interrupção do processo (Ctrl + C)
process.on('SIGINT', async () => {
  console.log('\n Shutting down gracefully...');
  // Fecha conexão com o banco antes de encerrar
  await database.close();
  process.exit(0);
});
// ===============================
// INICIALIZAÇÃO DO SERVIDOR
// ===============================
// Define porta (env ou padrão 3000)
const PORT = process.env.PORT || 3000;
// Evita iniciar o servidor durante testes automatizados
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` WebSocket server ready`);
    console.log(` API Documentation: http://localhost:${PORT}/docs`);
    console.log(` Database: SQLite`);
  });
}
// ===============================
// EXPORTAÇÃO
// ===============================
// Exporta a aplicação (útil para testes)
module.exports = app;
