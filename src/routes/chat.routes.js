// Importa o framework Express, utilizado para criar rotas e servidores HTTP
const express = require('express');

// Importa o controller responsável pela lógica de negócio do chat
const chatController = require('../controllers/chat.controller');

// Importa o middleware de autenticação (garante que o usuário esteja logado)
const authMiddleware = require('../middleware/auth.middleware');

// Importa a função de validação e os schemas utilizados para validar dados das requisições
const { validate, schemas } = require('../middleware/validation.middleware');

// Importa os middlewares de rate limit (controle de quantidade de requisições)
const { chatLimiter, messageLimiter } = require('../middleware/rateLimit.middleware');

// Cria uma instância de roteador do Express
const router = express.Router();

// Aplica o middleware de autenticação em todas as rotas deste router
router.use(authMiddleware);

// Aplica um limitador geral para evitar excesso de requisições nas rotas de chat
router.use(chatLimiter);

// Define uma rota GET para listar todas as salas de chat do usuário
router.get('/rooms',
  chatController.getRooms // Executa o método que retorna as salas
);

// Define uma rota GET para buscar mensagens de uma sala específica (roomId)
router.get('/rooms/:roomId/messages',
  chatController.getRoomMessages // Executa o método que retorna as mensagens da sala
);

// Define uma rota POST para enviar uma mensagem para uma sala específica
router.post('/rooms/:roomId/messages',
  messageLimiter, // Limita a frequência de envio de mensagens (anti-spam)
  validate(schemas.message), // Valida o corpo da requisição com base no schema definido
  chatController.sendMessage // Executa o envio da mensagem
);

// Define uma rota POST para sair de uma sala específica
router.post('/rooms/:roomId/leave',
  chatController.leaveRoom // Executa a lógica de saída da sala
);

// Exporta o router para ser utilizado em outras partes da aplicação
module.exports = router;
