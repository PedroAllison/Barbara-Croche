/**
 * Servidor LOCAL (para testar no seu PC apontando para o Supabase).
 * Na Vercel quem roda é o api/index.js. Aqui é só para desenvolvimento.
 *
 * Antes de rodar localmente, crie um arquivo .env (veja .env.example).
 */
const fs = require('fs');
const path = require('path');

// Carregador simples de .env (sem dependencia extra)
(function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
})();

const app = require('./src/app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log('  Barbara Crochê (LOCAL) - ARKTECH SYSTEMS');
  console.log(`  Loja:    http://localhost:${PORT}/`);
  console.log(`  Painel:  http://localhost:${PORT}/admin`);
  console.log('  (Usando o banco do Supabase definido no .env)');
  console.log('============================================================');
});
