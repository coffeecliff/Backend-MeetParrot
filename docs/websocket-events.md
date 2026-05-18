# 🔌 WebSocket Events Documentation

## Conexão e Autenticação

### Conectar ao WebSocket
```javascript
const socket = io('ws://localhost:3000');
```

### Autenticar
```javascript
// Enviar token JWT
socket.emit('authenticate', { 
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' 
});

// Resposta do servidor
socket.on('authenticated', (data) => {
  console.log('Autenticado:', data.userId);
});

// Erro de autenticação
socket.on('auth_error', (error) => {
  console.error('Erro de auth:', error.message);
});
```

## Sistema de Matching

### Entrar na Fila
```javascript
// Entrar na fila de uma categoria
socket.emit('join_queue', { 
  category: 'movies' // 'movies', 'games', 'series'
});

// Status da fila (se não houver match imediato)
socket.on('queue_status', (data) => {
  console.log('Posição na fila:', data.position);
  console.log('Tempo estimado:', data.estimatedWait);
});

// Match encontrado!
socket.on('match_found', (data) => {
  console.log('Match encontrado!');
  console.log('Room ID:', data.roomId);
  console.log('Parceiro:', data.partner.username);
  
  // Entrar automaticamente na sala
  socket.emit('join_room', { roomId: data.roomId });
});
```

### Sair da Fila
```javascript
socket.emit('leave_queue');

socket.on('left_queue', (data) => {
  console.log('Saiu da fila:', data.success);
});
```

## Sistema de Chat

### Entrar na Sala
```javascript
socket.emit('join_room', { 
  roomId: '550e8400-e29b-41d4-a716-446655440000' 
});

// Receber mensagens existentes da sala
socket.on('room_messages', (data) => {
  console.log('Mensagens da sala:', data.messages);
});
```

### Enviar Mensagem
```javascript
socket.emit('send_message', {
  roomId: '550e8400-e29b-41d4-a716-446655440000',
  content: 'Olá! Como você está?'
});
```

### Receber Mensagens
```javascript
socket.on('new_message', (message) => {
  console.log('Nova mensagem:');
  console.log('ID:', message.id);
  console.log('Conteúdo:', message.content);
  console.log('Remetente:', message.sender.username);
  console.log('Timestamp:', message.timestamp);
});
```

### Indicadores de Digitação
```javascript
// Começar a digitar
socket.emit('typing_start', { 
  roomId: '550e8400-e29b-41d4-a716-446655440000' 
});

// Parar de digitar
socket.emit('typing_stop', { 
  roomId: '550e8400-e29b-41d4-a716-446655440000' 
});

// Receber indicador do parceiro
socket.on('partner_typing', (data) => {
  if (data.isTyping) {
    console.log('Parceiro está digitando...');
  } else {
    console.log('Parceiro parou de digitar');
  }
});
```

### Sair da Sala
```javascript
socket.emit('leave_room', { 
  roomId: '550e8400-e29b-41d4-a716-446655440000' 
});

// Notificação quando parceiro sai
socket.on('partner_left', (data) => {
  console.log('Parceiro saiu da sala:', data.roomId);
});
```

## Eventos de Erro

### Erro Geral
```javascript
socket.on('error', (error) => {
  console.error('Erro:', error.message);
});
```

### Desconexão
```javascript
socket.on('disconnect', (reason) => {
  console.log('Desconectado:', reason);
  
  if (reason === 'io server disconnect') {
    // Reconectar manualmente
    socket.connect();
  }
});
```

## Exemplo Completo - Cliente React Native

```javascript
import io from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    this.socket = io('ws://localhost:3000');
    
    this.socket.on('connect', () => {
      console.log('Conectado ao WebSocket');
      this.authenticate(token);
    });

    this.socket.on('authenticated', (data) => {
      console.log('Autenticado:', data.userId);
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Desconectado');
      this.isConnected = false;
    });
  }

  authenticate(token) {
    this.socket.emit('authenticate', { token });
  }

  joinQueue(category) {
    if (!this.isConnected) return;
    this.socket.emit('join_queue', { category });
  }

  sendMessage(roomId, content) {
    if (!this.isConnected) return;
    this.socket.emit('send_message', { roomId, content });
  }

  onMatchFound(callback) {
    this.socket.on('match_found', callback);
  }

  onNewMessage(callback) {
    this.socket.on('new_message', callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export default new WebSocketService();
```

## Fluxo Típico de Uso

1. **Conectar e Autenticar**
   ```javascript
   socket.connect();
   socket.emit('authenticate', { token });
   ```

2. **Entrar na Fila de Matching**
   ```javascript
   socket.emit('join_queue', { category: 'movies' });
   ```

3. **Aguardar Match**
   ```javascript
   socket.on('match_found', (data) => {
     // Entrar na sala automaticamente
     socket.emit('join_room', { roomId: data.roomId });
   });
   ```

4. **Conversar**
   ```javascript
   // Enviar mensagens
   socket.emit('send_message', { roomId, content: 'Oi!' });
   
   // Receber mensagens
   socket.on('new_message', (message) => {
     // Atualizar UI
   });
   ```

5. **Encerrar Conversa**
   ```javascript
   socket.emit('leave_room', { roomId });
   // ou
   socket.emit('join_queue', { category: 'games' }); // Novo match
   ```