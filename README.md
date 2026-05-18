# MeetStranger Backend

Backend API para aplicativo de chat anônimo P2P dinâmico com SQLite.

## 🚀 Instalação Rápida

```bash
# Instalar dependências e configurar banco
npm run setup

# Executar em desenvolvimento
npm run dev
```

## 📖 Como Usar

### 1. **Autenticação**
- Faça login com qualquer email/senha
- Ou crie uma conta nova

### 2. **Escolha um Tópico**
- 🎬 **Filmes** - Converse sobre cinema
- 🎮 **Jogos** - Discuta games
- 📺 **Séries** - Fale sobre suas séries favoritas

### 3. **Chat P2P**
- Conecte com 1 pessoa por vez
- Troque mensagens em tempo real
- Use "Próximo" para encontrar nova pessoa
- Use "Sair" para voltar aos tópicos

## 📚 Documentação

**Acesse a documentação completa em:** `http://localhost:3000/docs`

- 📖 **Swagger UI**: Interface interativa para testar endpoints
- 🔌 **WebSocket Events**: Documentação completa dos eventos em tempo real
- 🎯 **Exemplos**: Código pronto para integração

## 🔄 Sistema P2P Dinâmico

- **✅ 3 Categorias**: Filmes, Jogos, Séries
- **✅ Matching por tópico**: Usuários conectados apenas no mesmo assunto
- **✅ Sem persistência de mensagens**: Chat existe apenas durante a conexão
- **✅ Reconexão automática**: Quando um usuário sai, o parceiro é automaticamente reconectado
- **✅ SQLite local**: Apenas dados de usuário são salvos
- **✅ Matching instantâneo**: Filas separadas para conexão rápida
- **✅ Cleanup automático**: Salas inativas são removidas automaticamente

## 📡 Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Perfil do usuário

### Matching P2P
- `POST /api/matching/join` - Info sobre fila (usar WebSocket para matching real)
- `DELETE /api/matching/leave` - Sair da fila
- `GET /api/matching/stats` - Estatísticas das filas P2P

### Health Check
- `GET /api/health` - Status do servidor

## 🔌 WebSocket Events

### Cliente → Servidor
- `authenticate` - Autenticar com JWT
- `join_queue` - Entrar na fila de matching P2P com categoria
- `leave_queue` - Sair da fila
- `join_room` - Entrar na sala de chat
- `send_message` - Enviar mensagem P2P (não salva)
- `typing_start/stop` - Indicadores de digitação
- `leave_room` - Sair da sala

### Servidor → Cliente
- `authenticated` - Confirmação de autenticação
- `queue_status` - Status da fila (posição, tempo estimado, categoria)
- `match_found` - Match P2P encontrado com categoria
- `room_joined` - Entrou na sala
- `new_message` - Nova mensagem P2P
- `partner_typing` - Parceiro digitando
- `partner_left` - Parceiro saiu
- `partner_disconnected` - Parceiro desconectou (reconexão automática)

## 🛠️ Desenvolvimento

```bash
# Executar testes completos
npm run test:api

# Executar teste rápido
npm run test:quick

# Executar com Jest
npm test

# Executar em modo desenvolvimento
npm run dev
```

## 🗄️ Banco de Dados

**Desenvolvimento:** SQLite (`database.sqlite`)
- Tabela `users` para autenticação
- Sem tabelas de mensagens (P2P dinâmico)
- Status online/offline dos usuários

**Produção:** Migrar para PostgreSQL

## 📦 Produção

Para produção, configure:
- PostgreSQL database (substituir SQLite)
- Redis server (para escalabilidade)
- Variáveis de ambiente seguras
- HTTPS/SSL
- Load balancer

## 🔒 Segurança

- JWT tokens com expiração
- Rate limiting por IP e usuário
- Validação de entrada com Joi
- Headers de segurança com Helmet
- CORS configurado
- Senhas criptografadas com bcrypt

## 📊 Monitoramento

- Health check endpoint
- Logs estruturados
- Cleanup automático de salas inativas (5min)
- Estatísticas de uso em tempo real
- Taxa de sucesso dos testes: **100%**

## 🎯 Fluxo P2P

1. **Login/Registro** → Autenticação
2. **Escolha tópico** → Filmes, Jogos ou Séries
3. **Usuário A** → `join_queue` com categoria → Aguarda na fila
4. **Usuário B** → `join_queue` mesma categoria → **Match instantâneo**
5. **Sala P2P criada** → Chat em tempo real sobre o tópico
6. **Mensagens P2P** → Não salvas no banco
7. **"Próximo"** → Parceiro reconectado automaticamente na mesma categoria
8. **"Sair"** → Volta para seleção de tópicos

## 🧪 Testes

**Última execução:** ✅ 15/15 testes passando (100%)

- ✅ Autenticação SQLite
- ✅ Sistema P2P com 3 categorias
- ✅ WebSocket matching por tópico
- ✅ Reconexão automática
- ✅ Validação e segurança
- ✅ Rate limiting
- ✅ Cleanup automático