/**
 * Autenticacao por JWT (sem estado em memoria) - funciona em serverless.
 * - Admin: 1 conta. Credenciais vindas das variaveis de ambiente
 *   (ADMIN_USER / ADMIN_PASSWORD) OU de uma senha trocada dentro do app
 *   (guardada com hash na tabela settings).
 * - Clientes (loja): contas na tabela customers.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getSetting } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-no-ambiente';
const TOKEN_TTL = '30d';

function signAdmin() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function signCustomer(customerId) {
  return jwt.sign({ role: 'customer', id: customerId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verify(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
}
function getBearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Confere usuario/senha do admin (env ou senha trocada no app). */
async function checkAdminCredentials(user, pass) {
  const envUser = process.env.ADMIN_USER || 'admin';
  // 1) senha trocada dentro do app (hash em settings) tem prioridade
  const hash = await getSetting('admin_pass_hash');
  const settingUser = (await getSetting('admin_user')) || envUser;
  if (hash) {
    return user === settingUser && bcrypt.compareSync(String(pass || ''), hash);
  }
  // 2) senao, usa a variavel de ambiente
  const envPass = process.env.ADMIN_PASSWORD || 'admin123';
  return user === envUser && String(pass || '') === envPass;
}

// Middlewares
function requireAdmin(req, res, next) {
  const data = verify(getBearer(req));
  if (data && data.role === 'admin') return next();
  return res.status(401).json({ error: 'Não autorizado. Faça login no painel.' });
}
function requireCustomer(req, res, next) {
  const data = verify(getBearer(req));
  if (data && data.role === 'customer') {
    req.customerId = data.id;
    return next();
  }
  return res.status(401).json({ error: 'Você precisa criar uma conta / entrar para falar com o vendedor.' });
}

module.exports = { signAdmin, signCustomer, checkAdminCredentials, requireAdmin, requireCustomer };
