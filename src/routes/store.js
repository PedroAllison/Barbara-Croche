/**
 * Rotas PUBLICAS da loja (site de vendas). Versao nuvem (Postgres).
 * Nao exige conta para navegar. So exige conta para falar com o vendedor.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, one, all, getSetting } = require('../database');
const { requireCustomer, signCustomer } = require('../auth');

const router = express.Router();

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(400).json({ error: e.message || 'Erro inesperado.' });
});

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    category_name: p.category_name,
    color: p.color,
    description: p.description,
    price: p.sale_price,
    quantity: p.quantity,
    in_stock: p.quantity > 0,
    photo_url: p.photo || null,
    sku: p.sku,
  };
}

router.get('/info', wrap(async (req, res) => {
  res.json({
    store_name: await getSetting('store_name'),
    store_tagline: await getSetting('store_tagline'),
    seller_name: await getSetting('seller_name'),
    seller_phone: await getSetting('seller_phone'),
    seller_whatsapp: await getSetting('seller_whatsapp'),
    seller_email: await getSetting('seller_email'),
  });
}));

router.get('/categories', wrap(async (req, res) => {
  res.json(await all(`
    SELECT DISTINCT c.id, c.name
    FROM categories c JOIN products p ON p.category_id = c.id
    WHERE p.published = true
    ORDER BY c.name`));
}));

router.get('/products', wrap(async (req, res) => {
  const { q, category } = req.query;
  let sql = `
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.published = true`;
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.color ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    sql += ` AND p.category_id = $${params.length}`;
  }
  sql += ' ORDER BY p.created_at DESC, p.id DESC';
  res.json((await all(sql, params)).map(publicProduct));
}));

router.get('/products/:id', wrap(async (req, res) => {
  const p = await one(`
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1 AND p.published = true`, [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json(publicProduct(p));
}));

// -------------------- FRETE por CEP / regiao --------------------
function regionFromCep(cep) {
  switch (cep[0]) {
    case '0': case '1': case '2': case '3': return 'Sudeste';
    case '4': case '5': return 'Nordeste';
    case '6': return 'Norte';
    case '7': return 'Centro-Oeste';
    case '8': case '9': return 'Sul';
    default: return null;
  }
}
router.post('/shipping/calc', wrap(async (req, res) => {
  const cep = String(req.body.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) return res.status(400).json({ error: 'CEP inválido. Use 8 dígitos.' });
  const region = regionFromCep(cep);
  if (!region) return res.status(400).json({ error: 'Não foi possível identificar a região do CEP.' });
  const rate = await one('SELECT * FROM shipping_rates WHERE region = $1', [region]);
  if (!rate) return res.status(404).json({ error: 'Sem tarifa cadastrada para essa região.' });
  res.json({ cep, region, price: rate.price, days: rate.days });
}));

// -------------------- CONTAS DE CLIENTE --------------------
router.post('/account/register', wrap(async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Senha muito curta (mínimo 4).' });
  try {
    const row = await one(
      'INSERT INTO customers (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name',
      [name.trim(), email.trim().toLowerCase(), phone || null, bcrypt.hashSync(String(password), 10)]);
    res.json({ token: signCustomer(row.id), name: row.name });
  } catch (e) {
    res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
  }
}));

router.post('/account/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const c = await one('SELECT * FROM customers WHERE email = $1', [String(email || '').trim().toLowerCase()]);
  if (!c || !bcrypt.compareSync(String(password || ''), c.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  res.json({ token: signCustomer(c.id), name: c.name });
}));

router.get('/account/me', requireCustomer, wrap(async (req, res) => {
  res.json(await one('SELECT id, name, email, phone FROM customers WHERE id = $1', [req.customerId]));
}));

// -------------------- CONTATO (exige conta) --------------------
router.post('/contact', requireCustomer, wrap(async (req, res) => {
  const c = await one('SELECT * FROM customers WHERE id = $1', [req.customerId]);
  const { product_id, message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Escreva sua mensagem.' });
  await pool.query('INSERT INTO messages (customer_id, name, email, phone, product_id, message) VALUES ($1,$2,$3,$4,$5,$6)',
    [c.id, c.name, c.email, c.phone, product_id || null, message.trim()]);
  res.json({ ok: true });
}));

module.exports = router;
