// Importa o serviço de matching que contém a lógica de negócio para encontrar correspondências
const matchingService = require('../services/matching.service');

// Classe MatchingController: Responsável por controlar as requisições relacionadas ao matching de usuários
class MatchingController {
  // Método assíncrono para adicionar um usuário à fila de matching
  async joinQueue(req, res) {
    try {
      // Extrai a categoria do corpo da requisição
      const { category } = req.body;
      // Obtém o ID do usuário autenticado do contexto da requisição
      const userId = req.user.userId;
      
      // Comentário: A implementação completa será feita via WebSocket para comunicação em tempo real
      // Retorna uma resposta JSON indicando sucesso e instruções para usar WebSocket
      res.json({
        success: true,
        message: 'Use WebSocket for real-time matching'
      });
    } catch (error) {
      // Captura erros e retorna uma resposta de erro com status 400 (Bad Request)
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Método assíncrono para remover um usuário de todas as filas de matching
  async leaveQueue(req, res) {
    try {
      // Obtém o ID do usuário autenticado
      const userId = req.user.userId;
      // Chama o serviço para remover o usuário de todas as filas
      matchingService.leaveAllQueues(userId);
      
      // Retorna uma resposta JSON de sucesso
      res.json({
        success: true,
        message: 'Left all queues'
      });
    } catch (error) {
      // Captura erros e retorna uma resposta de erro com status 400 (Bad Request)
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Método assíncrono para obter estatísticas das filas de matching
  async getQueueStats(req, res) {
    try {
      // Chama o serviço para obter as estatísticas das filas
      const stats = matchingService.getQueueStats();
      
      // Retorna uma resposta JSON com as estatísticas obtidas
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      // Captura erros e retorna uma resposta de erro com status 500 (Internal Server Error)
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

// Exporta uma instância única da classe MatchingController (padrão Singleton)
module.exports = new MatchingController();
