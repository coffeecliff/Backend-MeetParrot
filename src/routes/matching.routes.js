// Importa o framework Express para criação de rotas HTTP
const express = require('express');

// Importa o controller responsável pela lógica de matching (fila/pareamento)
const matchingController = require('../controllers/matching.controller');

// Importa o middleware de autenticação (garante que o usuário esteja logado)
const authMiddleware = require('../middleware/auth.middleware');

// Importa a função de validação e os schemas para validação das requisições
const { validate, schemas } = require('../middleware/validation.middleware');

// Importa o limitador de requisições para controle de uso da API
const { chatLimiter } = require('../middleware/rateLimit.middleware');

// Cria uma instância de roteador do Express
const router = express.Router();

// Aplica o middleware de autenticação em todas as rotas deste router
router.use(authMiddleware);

// Aplica um limitador geral para evitar excesso de requisições
router.use(chatLimiter);

// Rota POST para entrar na fila de matching
router.post('/join',
  validate(schemas.joinQueue), // Valida os dados enviados com base no schema de entrada na fila
  matchingController.joinQueue // Executa a lógica de entrada na fila
);

// Rota DELETE para sair da fila de matching
router.delete('/leave',
  matchingController.leaveQueue // Executa a lógica de saída da fila
);

// Rota GET para obter estatísticas da fila de matching
router.get('/stats',
  matchingController.getQueueStats // Retorna informações como quantidade de usuários na fila, etc.
);

// Exporta o router para ser utilizado na aplicação principal
module.exports = router;
