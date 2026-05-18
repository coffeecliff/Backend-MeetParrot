// Importa o serviço de matching para acessar funções relacionadas às salas de chat
const matchingService = require('../services/matching.service');

// Define a classe ChatController que contém os métodos para gerenciar as operações de chat
class ChatController {
  // Método assíncrono que obtém todas as salas de chat do usuário autenticado
  async getRooms(req, res) {
    // Tenta executar o código abaixo
    try {
      // Extrai o ID do usuário do objeto de autenticação da requisição
      const userId = req.user.userId;
      // Chama o serviço para obter todas as salas do usuário
      const rooms = matchingService.getUserRooms(userId);
      
      // Map transforma cada sala em um objeto formatado com os dados necessários
      const formattedRooms = rooms.map(room => ({
        // ID da sala de chat
        id: room.id,
        // Categoria da sala (ex: tecnologia, esportes, etc)
        category: room.category,
        // Status atual da sala (ativa, inativa, etc)
        status: room.status,
        // Objeto contendo informações do parceiro de conversa
        partner: {
          // Nome do usuário parceiro (anônimo por padrão)
          username: 'Anônimo'
        },
        // Data de criação da sala
        createdAt: room.createdAt
      }));

      // Retorna uma resposta JSON com as salas formatadas
      res.json({
        // Indica que a operação foi bem-sucedida
        success: true,
        // Objeto contendo os dados da resposta
        data: {
          // Array de salas formatadas
          rooms: formattedRooms
        }
      });
    } catch (error) {
      // Se ocorrer um erro, retorna status 500 e a mensagem de erro
      res.status(500).json({
        // Indica que houve falha na operação
        success: false,
        // Mensagem de erro capturada
        message: error.message
      });
    }
  }

  // Método assíncrono que obtém as mensagens de uma sala específica
  async getRoomMessages(req, res) {
    // Tenta executar o código abaixo
    try {
      // Desestrutura o ID da sala dos parâmetros da URL
      const { roomId } = req.params;
      // Desestrutura o número da página e limite de mensagens da query (padrão: página 1, limite 50)
      const { page = 1, limit = 50 } = req.query;
      
      // Obtém a sala do serviço usando seu ID
      const room = matchingService.getRoom(roomId);
      // Verifica se a sala existe e se o usuário tem acesso (deve ser user1Id ou user2Id)
      if (!room || (room.user1Id !== req.user.userId && room.user2Id !== req.user.userId)) {
        // Retorna erro 403 (acesso negado) se o usuário não tiver permissão
        return res.status(403).json({
          // Indica que houve falha na operação
          success: false,
          // Mensagem informando que o acesso foi negado
          message: 'Access denied to this room'
        });
      }

      // Retorna as mensagens com paginação (implementação real buscaria do banco de dados)
      res.json({
        // Indica que a operação foi bem-sucedida
        success: true,
        // Objeto contendo os dados da resposta
        data: {
          messages: [],
          // Objeto contendo informações de paginação
          pagination: {
            // Número da página atual convertido para inteiro
            page: parseInt(page),
            // Limite de mensagens por página convertido para inteiro
            limit: parseInt(limit),
            // Total de mensagens disponíveis
            total: 0,
            // Indica se há mais mensagens para carregar
            hasMore: false
          }
        }
      });
    } catch (error) {
      // Se ocorrer um erro, retorna status 500 e a mensagem de erro
      res.status(500).json({
        // Indica que houve falha na operação
        success: false,
        // Mensagem de erro capturada
        message: error.message
      });
    }
  }

  // Método assíncrono que permite ao usuário enviar uma mensagem em uma sala
  async sendMessage(req, res) {
    // Tenta executar o código abaixo
    try {
      // Desestrutura o ID da sala dos parâmetros da URL
      const { roomId } = req.params;
      // Desestrutura o conteúdo da mensagem do corpo da requisição
      const { content } = req.body;
      
      // Obtém a sala do serviço usando seu ID
      const room = matchingService.getRoom(roomId);
      // Verifica se a sala existe e se o usuário tem acesso (deve ser user1Id ou user2Id)
      if (!room || (room.user1Id !== req.user.userId && room.user2Id !== req.user.userId)) {
        // Retorna erro 403 (acesso negado) se o usuário não tiver permissão
        return res.status(403).json({
          // Indica que houve falha na operação
          success: false,
          // Mensagem informando que o acesso foi negado
          message: 'Access denied to this room'
        });
      }

      // Retorna uma resposta informando que as mensagens são enviadas via WebSocket
      res.status(201).json({
        // Indica que a operação foi bem-sucedida
        success: true,
        // Mensagem informando ao cliente para usar WebSocket para mensagens em tempo real
        message: 'Use WebSocket for real-time messaging'
      });
    } catch (error) {
      // Se ocorrer um erro, retorna status 500 e a mensagem de erro
      res.status(500).json({
        // Indica que houve falha na operação
        success: false,
        // Mensagem de erro capturada
        message: error.message
      });
    }
  }

  // Método assíncrono que permite ao usuário sair de uma sala de chat
  async leaveRoom(req, res) {
    // Tenta executar o código abaixo
    try {
      // Desestrutura o ID da sala dos parâmetros da URL
      const { roomId } = req.params;
      // Extrai o ID do usuário do objeto de autenticação da requisição
      const userId = req.user.userId;
      
      // Chama o serviço para remover o usuário da sala
      const room = matchingService.leaveRoom(roomId, userId);
      // Verifica se a sala foi encontrada
      if (!room) {
        // Retorna erro 404 se a sala não existir
        return res.status(404).json({
          // Indica que houve falha na operação
          success: false,
          // Mensagem informando que a sala não foi encontrada
          message: 'Room not found'
        });
      }

      // Retorna uma resposta de sucesso informando que o usuário deixou a sala
      res.json({
        // Indica que a operação foi bem-sucedida
        success: true,
        // Mensagem confirmando que o usuário saiu da sala com sucesso
        message: 'Left chat room successfully'
      });
    } catch (error) {
      // Se ocorrer um erro, retorna status 500 e a mensagem de erro
      res.status(500).json({
        // Indica que houve falha na operação
        success: false,
        // Mensagem de erro capturada
        message: error.message
      });
    }
  }
}

// Exporta uma nova instância da classe ChatController para ser usada em outros arquivos
module.exports = new ChatController();