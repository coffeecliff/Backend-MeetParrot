# 🗺️ MeetStranger Backend - Mapa Completo

## 📁 Estrutura do Projeto

```
backend/
├── src/                          # Código fonte principal
│   ├── controllers/              # Controladores das rotas
│   │   ├── auth.controller.js    # Autenticação (register, login, logout)
│   │   ├── chat.controller.js    # Chat (rooms, messages)
│   │   └── matching.controller.js # Matching (join, leave, stats)
│   ├── middleware/               # Middlewares
│   │   ├── auth.middleware.js    # Verificação JWT
│   │   ├── rateLimit.middleware.js # Rate limiting
│   │   └── validation.middleware.js # Validação Joi
│   ├── routes/                   # Definição das rotas
│   │   ├── auth.routes.js        # /api/auth/*
│   │   ├── chat.routes.js        # /api/chat/*
│   │   └── matching.routes.js    # /api/matching/*
│   ├── services/                 # Lógica de negócio
│   │   ├── auth.service.js       # Gerenciamento de usuários
│   │   ├── matching.service.js   # Sistema de filas e matching
│   │   └── websocket.service.js  # WebSocket em tempo real
│   └── app.js                    # Aplicação principal
├── docs/                         # Documentação
│   ├── index.html               # Interface FastAPI-style
│   ├── swagger.yaml             # Especificação OpenAPI
│   └── websocket-events.md      # Documentação WebSocket
├── tests/                        # Testes
│   └── api-test.js              # Script de teste completo
├── package.json                  # Dependências e scripts
├── .env                         # Configurações de ambiente
└── README.md                    # Documentação principal
```

## 🔗 Endpoints Mapeados

### 🔐 Autenticação (`/api/auth`)
- `POST /register` - Registrar usuário
- `POST /login` - Login e obter JWT
- `POST /logout` - Logout (invalidar token)
- `GET /profile` - Obter perfil do usuário

### 🎯 Matching (`/api/matching`)
- `POST /join` - Entrar na fila por categoria
- `DELETE /leave` - Sair da fila
- `GET /stats` - Estatísticas das filas

### 💬 Chat (`/api/chat`)
- `GET /rooms` - Listar salas do usuário
- `GET /rooms/:id/messages` - Mensagens da sala
- `POST /rooms/:id/messages` - Enviar mensagem
- `POST /rooms/:id/leave` - Sair da sala

### 📊 Monitoramento
- `GET /api/health` - Status do servidor
- `GET /docs` - Documentação interativa

## 🔌 Eventos WebSocket

### Cliente → Servidor
- `authenticate` - Autenticar com JWT
- `join_queue` - Entrar na fila
- `leave_queue` - Sair da fila
- `join_room` - Entrar na sala
- `send_message` - Enviar mensagem
- `typing_start/stop` - Indicadores de digitação
- `leave_room` - Sair da sala

### Servidor → Cliente
- `authenticated` - Confirmação de auth
- `queue_status` - Status da fila
- `match_found` - Match encontrado
- `new_message` - Nova mensagem
- `partner_typing` - Parceiro digitando
- `partner_left` - Parceiro saiu

## 🛡️ Middlewares Implementados

### Autenticação
- **JWT Verification** - Valida tokens Bearer
- **Rate Limiting** - Proteção contra spam
- **Input Validation** - Joi schemas

### Segurança
- **CORS** - Configurado para mobile
- **Helmet** - Headers de segurança
- **Rate Limits**:
  - Auth: 5 req/min
  - Chat: 100 req/min
  - Messages: 10 msg/min

## 💾 Armazenamento (Mock)

### Em Memória (Desenvolvimento)
- **Users Map** - Usuários registrados
- **Queues Object** - Filas por categoria
- **Active Rooms Map** - Salas ativas
- **Messages Map** - Mensagens por sala

### Produção (Recomendado)
- **PostgreSQL** - Usuários, salas, mensagens
- **Redis** - Filas, cache, sessões

## 🧪 Testes Implementados

### Funcionalidades Testadas
1. **Health Check** - Status do servidor
2. **User Registration** - Criar conta
3. **User Login** - Autenticação
4. **Get Profile** - Dados do usuário
5. **Invalid Token** - Segurança
6. **Queue Stats** - Estatísticas
7. **Join/Leave Queue** - Sistema de filas
8. **Chat Rooms** - Listar salas
9. **WebSocket Connection** - Conexão WS
10. **WebSocket Auth** - Autenticação WS
11. **WebSocket Queue** - Fila via WS
12. **Rate Limiting** - Proteção
13. **Input Validation** - Validação
14. **User Logout** - Encerrar sessão

### Como Executar Testes
```bash
# Instalar dependências
npm install

# Executar servidor
npm run dev

# Em outro terminal, executar testes
npm run test:api
```

## 🚀 Fluxo de Uso Completo

### 1. Autenticação
```javascript
// Registrar
POST /api/auth/register
{
  "username": "user123",
  "email": "user@test.com", 
  "password": "pass123"
}

// Login
POST /api/auth/login
{
  "email": "user@test.com",
  "password": "pass123"
}
// Retorna: { token: "jwt-token" }
```

### 2. WebSocket Connection
```javascript
const socket = io('ws://localhost:3000');
socket.emit('authenticate', { token: 'jwt-token' });
```

### 3. Matching
```javascript
// Entrar na fila
socket.emit('join_queue', { category: 'movies' });

// Aguardar match
socket.on('match_found', (data) => {
  console.log('Room ID:', data.roomId);
});
```

### 4. Chat
```javascript
// Entrar na sala
socket.emit('join_room', { roomId: 'room-id' });

// Enviar mensagem
socket.emit('send_message', {
  roomId: 'room-id',
  content: 'Olá!'
});

// Receber mensagens
socket.on('new_message', (message) => {
  console.log(message.content);
});
```

## 📈 Métricas e Monitoramento

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "websocket": "active"
  }
}
```

### Queue Stats
```json
{
  "success": true,
  "data": {
    "queueSize": {
      "movies": 5,
      "games": 3,
      "series": 2
    }
  }
}
```

## 🔧 Configuração

### Variáveis de Ambiente
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/meetstranger
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:8081
```

### Scripts Disponíveis
```bash
npm run dev        # Desenvolvimento com nodemon
npm run start      # Produção
npm run setup      # Configuração inicial
npm run test:api   # Testes da API
npm run test       # Testes unitários (Jest)
```

## 🎯 Status do Backend

✅ **Implementado e Testado:**
- Autenticação JWT completa
- Sistema de matching por filas
- WebSocket em tempo real
- Rate limiting e segurança
- Documentação interativa
- Testes automatizados

🔄 **Para Produção:**
- Configurar PostgreSQL
- Configurar Redis
- Deploy com Docker
- CI/CD pipeline
- Monitoramento avançado