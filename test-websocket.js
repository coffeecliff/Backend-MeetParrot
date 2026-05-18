const io = require('socket.io-client');

// Teste com 2 usuários simulados
async function testMatching() {
  console.log('🧪 Testando sistema de matching...\n');

  // Simular 2 tokens (você precisa pegar tokens reais do seu app)
  const token1 = 'SEU_TOKEN_USUARIO_1';
  const token2 = 'SEU_TOKEN_USUARIO_2';

  const socket1 = io('http://10.112.190.214:3000');
  const socket2 = io('http://10.112.190.214:3000');

  socket1.on('connect', () => {
    console.log('👤 Usuário 1 conectado');
    socket1.emit('authenticate', { token: token1 });
  });

  socket2.on('connect', () => {
    console.log('👤 Usuário 2 conectado');
    socket2.emit('authenticate', { token: token2 });
  });

  socket1.on('authenticated', () => {
    console.log('✅ Usuário 1 autenticado');
    socket1.emit('find-match', { category: 'jogos' });
  });

  socket2.on('authenticated', () => {
    console.log('✅ Usuário 2 autenticado');
    setTimeout(() => {
      socket2.emit('find-match', { category: 'jogos' });
    }, 1000);
  });

  socket1.on('match-found', (data) => {
    console.log('🎉 Usuário 1 encontrou match:', data);
  });

  socket2.on('match-found', (data) => {
    console.log('🎉 Usuário 2 encontrou match:', data);
  });

  socket1.on('queue-status', (data) => {
    console.log('⏳ Usuário 1 na fila:', data);
  });

  socket2.on('queue-status', (data) => {
    console.log('⏳ Usuário 2 na fila:', data);
  });

  // Desconectar após 10 segundos
  setTimeout(() => {
    socket1.disconnect();
    socket2.disconnect();
    console.log('\n🔌 Teste finalizado');
    process.exit(0);
  }, 10000);
}

testMatching().catch(console.error);