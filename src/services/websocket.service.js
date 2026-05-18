// Importa a biblioteca jsonwebtoken para verificar e decodificar tokens JWT
const jwt = require('jsonwebtoken');

// Importa o serviço de matching responsável por gerenciar filas e salas de conversa
const matchingService = require('./matching.service');

// Importa o serviço de autenticação para operações relacionadas ao usuário
const authService = require('./auth.service');

// Importa a função uuidv4 para geração de identificadores únicos universais
const { v4: uuidv4 } = require('uuid');

// Define a classe principal que encapsula toda a lógica do serviço WebSocket
class WebSocketService {
  // Construtor da classe: inicializa as propriedades básicas do serviço
  constructor() {
    // Referência à instância do servidor Socket.IO; começa como nula até ser inicializada
    this.io = null;

    // Mapa que armazena a relação entre userId e socketId dos usuários conectados
    this.connectedUsers = new Map();
  }

  // Método que inicializa o serviço com a instância do servidor Socket.IO
  initialize(io) {
    // Armazena a referência do servidor Socket.IO para uso interno na classe
    this.io = io;

    // Registra o evento de nova conexão: executado sempre que um cliente se conecta
    io.on('connection', (socket) => {
      // Exibe no console o identificador do socket do usuário que acabou de se conectar
      console.log(`User connected: ${socket.id}`);

      // Evento de autenticação: o cliente envia seu token JWT para se identificar
      socket.on('authenticate', async (data) => {
        // Registra a tentativa de autenticação do socket atual
        console.log(`🔑 Authentication attempt for socket: ${socket.id}`);
        try {
          // Verifica e decodifica o token JWT usando a chave secreta do ambiente
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);

          // Associa o userId decodificado ao objeto socket para uso em outros eventos
          socket.userId = decoded.userId;

          // Registra no mapa o par userId -> socketId do usuário autenticado
          this.connectedUsers.set(decoded.userId, socket.id);

          // Marca o usuário como online no banco de dados via serviço de autenticação
          await authService.setUserOnline(decoded.userId, true);

          // Envia confirmação de autenticação ao cliente com o userId
          socket.emit('authenticated', { userId: decoded.userId });

          // Registra no console que o usuário foi autenticado com sucesso
          console.log(`✅ User authenticated: ${decoded.userId}`);
        } catch (error) {
          // Registra a falha de autenticação no console com a mensagem de erro
          console.log(`❌ Auth failed for socket ${socket.id}:`, error.message);

          // Notifica o cliente que o token é inválido
          socket.emit('auth_error', { message: 'Invalid token' });
        }
      });

      // Evento para entrar na fila de matching: o usuário busca um parceiro em uma categoria
      socket.on('find-match', async (data) => {
        // Registra no console que o usuário está buscando um match na categoria informada
        console.log(`🔍 User ${socket.userId} looking for match in category: ${data.category}`);

        // Verifica se o socket está autenticado antes de prosseguir
        if (!socket.userId) {
          // Registra que o usuário não está autenticado
          console.log('❌ User not authenticated');

          // Envia erro ao cliente informando que ele não está autenticado
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Extrai a categoria enviada pelo cliente nos dados do evento
        const { category } = data;

        // Valida se a categoria é uma das opções aceitas pelo sistema
        if (!category || !['jogos', 'series', 'filmes', 'games', 'movies', 'shows'].includes(category)) {
          // Registra a categoria inválida no console
          console.log(`❌ Invalid category: ${category}`);

          // Envia erro ao cliente com as categorias válidas
          socket.emit('error', { message: 'Invalid category. Use: jogos, series, filmes' });
          return;
        }

        // Mapa de tradução das categorias em inglês para português
        const categoryMap = {
          'games': 'jogos',   // "games" em inglês vira "jogos" em português
          'movies': 'filmes', // "movies" em inglês vira "filmes" em português
          'shows': 'series'   // "shows" em inglês vira "series" em português
        };

        // Converte a categoria para português caso esteja em inglês; mantém se já estiver em português
        const mappedCategory = categoryMap[category] || category;

        // Adiciona o usuário à fila de matching na categoria mapeada e obtém o resultado
        const result = matchingService.joinQueue(socket.userId, socket.id, mappedCategory);

        // Registra o resultado da operação de fila no console
        console.log(`📊 Queue result:`, result);

        // Verifica se um parceiro foi encontrado imediatamente ao entrar na fila
        if (result.matched) {
          // Registra que um match foi encontrado e exibe o ID da sala criada
          console.log(`✅ Match found! Room: ${result.roomId}`);

          // Busca os dados do usuário atual (usuário 1) no banco de dados
          const user1 = await authService.getUserById(socket.userId);

          // Busca os dados do parceiro encontrado (usuário 2) no banco de dados
          const user2 = await authService.getUserById(result.partnerId);

          // Obtém a instância do socket do parceiro a partir do ID do socket
          const partnerSocket = io.sockets.sockets.get(result.partnerSocketId);

          // Notifica o usuário atual que um match foi encontrado, enviando dados da sala e do parceiro
          socket.emit('match-found', {
            roomId: result.roomId,          // ID único da sala de conversa criada
            category: result.category,      // Categoria do match
            partner: { username: user2 ? user2.username : 'Usuário' } // Nome do parceiro ou padrão
          });

          // Se o socket do parceiro ainda estiver conectado, notifica-o também sobre o match
          if (partnerSocket) {
            partnerSocket.emit('match-found', {
              roomId: result.roomId,          // ID único da sala de conversa criada
              category: result.category,      // Categoria do match
              partner: { username: user1 ? user1.username : 'Usuário' } // Nome do usuário atual ou padrão
            });
          }
        } else {
          // Registra que o usuário foi adicionado à fila e exibe sua posição
          console.log(`⏳ Added to queue. Position: ${result.queuePosition}`);

          // Notifica o cliente sobre seu status na fila com posição e tempo estimado de espera
          socket.emit('queue-status', {
            category: mappedCategory,           // Categoria em que está aguardando
            position: result.queuePosition,     // Posição atual na fila
            estimatedWait: result.estimatedWait // Tempo estimado de espera
          });
        }
      });

      // Evento para cancelar a busca por match e sair da fila
      socket.on('cancel-matching', (data) => {
        // Verifica se o socket está autenticado antes de processar o cancelamento
        if (socket.userId) {
          // Remove o usuário de todas as filas de categorias em que estiver inscrito
          matchingService.leaveAllQueues(socket.userId);

          // Confirma ao cliente que o matching foi cancelado com sucesso
          socket.emit('matching-cancelled', { success: true });
        }
      });

      // Evento para entrar em uma sala de chat após o match ser confirmado
      socket.on('join-room', (data) => {
        // Busca os dados da sala pelo ID informado pelo cliente
        const room = matchingService.getRoom(data.roomId);

        // Verifica se a sala existe e se o usuário atual é um dos participantes autorizados
        if (room && (room.user1Id === socket.userId || room.user2Id === socket.userId)) {
          // Inscreve o socket na sala do Socket.IO para receber eventos direcionados a ela
          socket.join(data.roomId);

          // Armazena o ID da sala atual no socket para uso em eventos posteriores
          socket.currentRoom = data.roomId;

          // Confirma ao cliente que ele entrou na sala com sucesso
          socket.emit('room-joined', { roomId: data.roomId });
        }
      });

      // Evento para enviar mensagem na sala atual (P2P - não salva no banco de dados)
      socket.on('send-message', async (data) => {
        // Ignora o envio se o usuário não estiver em uma sala ou não estiver autenticado
        if (!socket.currentRoom || !socket.userId) return;

        // Busca os dados do remetente no banco de dados para obter o nome de usuário
        const sender = await authService.getUserById(socket.userId);

        // Define o nome de usuário do remetente; usa padrão "Usuário" se não encontrado
        const senderUsername = sender ? sender.username : 'Usuário';

        // Cria o objeto da mensagem com ID único, conteúdo, remetente e timestamp
        const message = {
          id: uuidv4(),             // Identificador único gerado para esta mensagem
          message: data.message,    // Conteúdo da mensagem enviada pelo cliente
          senderId: socket.userId,  // ID do usuário que enviou a mensagem
          timestamp: new Date()     // Data e hora do envio da mensagem
        };

        // Envia a mensagem apenas para os demais participantes da sala (exclui o remetente)
        socket.to(socket.currentRoom).emit('new-message', {
          id: message.id,               // ID único da mensagem
          message: message.message,     // Conteúdo da mensagem
          username: senderUsername,     // Nome de usuário do remetente
          timestamp: message.timestamp  // Timestamp do envio
        });
      });

      // Evento disparado quando o usuário começa a digitar uma mensagem
      socket.on('typing_start', (data) => {
        // Verifica se o usuário está em uma sala ativa antes de emitir o indicador
        if (socket.currentRoom) {
          // Notifica o parceiro na sala que o usuário está digitando
          socket.to(socket.currentRoom).emit('partner_typing', { isTyping: true });
        }
      });

      // Evento disparado quando o usuário para de digitar uma mensagem
      socket.on('typing_stop', (data) => {
        // Verifica se o usuário está em uma sala ativa antes de emitir o indicador
        if (socket.currentRoom) {
          // Notifica o parceiro na sala que o usuário parou de digitar
          socket.to(socket.currentRoom).emit('partner_typing', { isTyping: false });
        }
      });

      // Evento para o usuário sair voluntariamente de uma sala de conversa
      socket.on('leave-room', (data) => {
        // Registra no console que o usuário está saindo da sala informada
        console.log(`👋 User ${socket.userId} leaving room ${data.roomId}`);

        // Delega o processamento de saída ao método handleLeaveRoom
        this.handleLeaveRoom(socket, data.roomId);
      });

      // Evento de desconexão: disparado automaticamente quando o cliente perde a conexão
      socket.on('disconnect', async () => {
        // Registra no console o ID do socket que se desconectou
        console.log(`User disconnected: ${socket.id}`);

        // Processa a desconexão apenas se o socket estiver autenticado
        if (socket.userId) {
          // Marca o usuário como offline no banco de dados
          await authService.setUserOnline(socket.userId, false);

          // Remove o usuário da fila de matching
          matchingService.leaveQueue(socket.userId);

          // Remove o usuário do mapa de usuários conectados
          this.connectedUsers.delete(socket.userId);

          // Processa a saída da sala atual, sinalizando que é uma desconexão (isDisconnect=true)
          this.handleLeaveRoom(socket, socket.currentRoom, true);
        }
      });
    });

    // Agenda a limpeza de salas inativas a cada 5 minutos para liberar recursos
    setInterval(() => {
      // Chama o método do serviço de matching que remove salas sem atividade recente
      matchingService.cleanupInactiveRooms();
    }, 5 * 60 * 1000); // Intervalo de 5 minutos em milissegundos
  }

  // Método auxiliar que gerencia a saída de um usuário de uma sala de conversa
  handleLeaveRoom(socket, roomId = null, isDisconnect = false) {
    // Determina a sala alvo: usa o roomId informado ou a sala atual do socket
    const targetRoom = roomId || socket.currentRoom;

    // Prossegue apenas se houver uma sala alvo válida
    if (targetRoom) {
      // Registra no console os detalhes da operação de saída da sala
      console.log(`🚪 Handling leave room: ${targetRoom}, disconnect: ${isDisconnect}`);

      // Processa a saída no serviço de matching e obtém os dados da sala (incluindo info do parceiro)
      const roomData = matchingService.leaveRoom(targetRoom, socket.userId);

      // Verifica se havia dados de sala (ou seja, se o usuário estava em uma sala ativa)
      if (roomData) {
        // Registra que o parceiro será notificado sobre a saída do usuário
        console.log(`📢 Notifying partner about user leaving room ${targetRoom}`);

        // Envia evento ao parceiro na sala informando que o usuário saiu ou se desconectou
        socket.to(targetRoom).emit('partner_left', {
          roomId: targetRoom,
          // Mensagem diferente dependendo se foi uma desconexão ou saída voluntária
          message: isDisconnect ? 'Seu parceiro se desconectou' : 'Seu parceiro saiu da conversa'
        });

        // Verifica se existe um socketId do parceiro para reconectá-lo automaticamente à fila
        if (roomData.partnerSocketId) {
          // Obtém a instância do socket do parceiro a partir do servidor Socket.IO
          const partnerSocket = this.io.sockets.sockets.get(roomData.partnerSocketId);

          // Prossegue apenas se o socket do parceiro ainda estiver conectado
          if (partnerSocket) {
            // Registra que o parceiro será reconectado automaticamente à fila
            console.log(`🔄 Auto-reconnecting partner ${roomData.partnerId}`);

            // Limpa a sala atual do socket do parceiro pois ele saiu da sala anterior
            partnerSocket.currentRoom = null;

            // Notifica o parceiro que está sendo redirecionado para buscar uma nova conversa
            partnerSocket.emit('partner_disconnected', {
              message: 'Procurando nova pessoa...' // Mensagem exibida ao parceiro durante a busca
            });

            // Aguarda 1 segundo antes de colocar o parceiro de volta na fila automaticamente
            setTimeout(() => {
              // Verifica novamente se o socket do parceiro ainda está autenticado após o delay
              if (partnerSocket.userId) {
                // Registra que a nova busca para o parceiro está sendo iniciada na categoria da sala anterior
                console.log(`🔍 Starting new search for partner in category: ${roomData.category}`);

                // Adiciona o parceiro à fila de matching na mesma categoria da conversa encerrada
                const result = matchingService.joinQueue(partnerSocket.userId, partnerSocket.id, roomData.category);

                // Verifica se um novo match foi encontrado imediatamente ao entrar na fila
                if (result.matched) {
                  // Obtém o socket do novo parceiro encontrado para o usuário reconectado
                  const newPartnerSocket = this.io.sockets.sockets.get(result.partnerSocketId);

                  // Notifica o parceiro reconectado que um novo match foi encontrado
                  partnerSocket.emit('match-found', {
                    roomId: result.roomId,          // ID da nova sala de conversa
                    category: result.category,      // Categoria do novo match
                    partner: { username: 'Usuário' } // Nome padrão enquanto os dados não são buscados
                  });

                  // Se o novo parceiro ainda estiver conectado, notifica-o também sobre o match
                  if (newPartnerSocket) {
                    newPartnerSocket.emit('match-found', {
                      roomId: result.roomId,          // ID da nova sala de conversa
                      category: result.category,      // Categoria do novo match
                      partner: { username: 'Usuário' } // Nome padrão enquanto os dados não são buscados
                    });
                  }
                } else {
                  // Se não encontrou match imediato, informa o parceiro sobre sua posição na fila
                  partnerSocket.emit('queue-status', {
                    category: result.category,          // Categoria em que está aguardando
                    position: result.queuePosition,     // Posição atual na fila
                    estimatedWait: result.estimatedWait // Tempo estimado de espera
                  });
                }
              }
            }, 1000); // Delay de 1 segundo (1000ms) antes de reentrar na fila
          }
        }
      }

      // Remove o socket da sala do Socket.IO encerrando o recebimento de eventos dela
      socket.leave(targetRoom);

      // Limpa a referência da sala atual do socket após sair
      socket.currentRoom = null;
    }
  }

  // Método utilitário que retorna a quantidade de usuários atualmente conectados
  getConnectedUsersCount() {
    // Retorna o tamanho do mapa de usuários conectados (número de entradas)
    return this.connectedUsers.size;
  }
}

// Exporta uma instância única (singleton) do WebSocketService para ser usada em toda a aplicação
module.exports = new WebSocketService();