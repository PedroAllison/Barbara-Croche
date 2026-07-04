/**
 * Rotas do PAINEL GERENCIAL (protegidas por JWT de admin).
 * Versao nuvem: Postgres (Supabase) + Supabase Storage.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, one, all, getSetting, setSetting } = require('../database');
const { requireAdmin, signAdmin, checkAdminCredentials } = require('../auth');
const { memory, uploadFile, removeFile } = require('../storage');

const router = express.Router();

// helper para tratar erros async
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(400).json({ error: e.message || 'Erro inesperado.' });
});

// ----------------------------- LOGIN -----------------------------
router.post('/login', wrap(async (req, res) => {
  const { user, pass } = req.body || {};
  if (await checkAdminCredentials(user, pass)) {
    return res.json({ token: signAdmin() });
  }
  res.status(401).json({ error: 'Usuário ou senha incorretos.' });
}));

router.post('/logout', requireAdmin, (req, res) => res.json({ ok: true }));

// Tudo abaixo exige admin
router.use(requireAdmin);

// ----------------------------- DASHBOARD -----------------------------
router.get('/dashboard', wrap(async (req, res) => {
  const initialCash = parseFloat((await getSetting('initial_cash')) || '0') || 0;
  const rev = Number((await one(`SELECT COALESCE(SUM(amount),0) v FROM finance_transactions WHERE type='revenue'`)).v);
  const exp = Number((await one(`SELECT COALESCE(SUM(amount),0) v FROM finance_transactions WHERE type='expense'`)).v);

  const month = new Date().toISOString().slice(0, 7);
  const revM = Number((await one(`SELECT COALESCE(SUM(amount),0) v FROM finance_transactions WHERE type='revenue' AND to_char(created_at,'YYYY-MM')=$1`, [month])).v);
  const expM = Number((await one(`SELECT COALESCE(SUM(amount),0) v FROM finance_transactions WHERE type='expense' AND to_char(created_at,'YYYY-MM')=$1`, [month])).v);

  const stock = await one(`
    SELECT
      COUNT(*) AS total_products,
      COALESCE(SUM(quantity),0) AS total_items,
      COALESCE(SUM(quantity*cost_price),0) AS stock_cost_value,
      COALESCE(SUM(quantity*sale_price),0) AS stock_sale_value,
      COALESCE(SUM(CASE WHEN published THEN 1 ELSE 0 END),0) AS published,
      COALESCE(SUM(CASE WHEN quantity<=min_stock THEN 1 ELSE 0 END),0) AS low_stock
    FROM products`);
  const unread = Number((await one(`SELECT COUNT(*) c FROM messages WHERE status='novo'`)).c);

  res.json({
    cash: initialCash + rev - exp,
    initialCash,
    revenue: rev,
    expense: exp,
    revenueMonth: revM,
    expenseMonth: expM,
    total_products: Number(stock.total_products),
    total_items: Number(stock.total_items),
    stock_cost_value: Number(stock.stock_cost_value),
    stock_sale_value: Number(stock.stock_sale_value),
    published: Number(stock.published),
    low_stock: Number(stock.low_stock),
    unreadMessages: unread,
  });
}));

// ----------------------------- CATEGORIAS -----------------------------
router.get('/categories', wrap(async (req, res) => {
  res.json(await all('SELECT * FROM categories ORDER BY name'));
}));
router.post('/categories', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Informe o nome da categoria.' });
  try {
    const row = await one('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
    res.json(row);
  } catch (_) {
    res.status(400).json({ error: 'Categoria já existe.' });
  }
}));
router.delete('/categories/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ----------------------------- PRODUTOS -----------------------------
function productView(p) {
  return { ...p, photo_url: p.photo || null };
}

router.get('/products', wrap(async (req, res) => {
  const rows = await all(`
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC, p.id DESC`);
  res.json(rows.map(productView));
}));

router.get('/products/:id', wrap(async (req, res) => {
  const p = await one('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json(productView(p));
}));

router.post('/products', memory.single('photo'), wrap(async (req, res) => {
  const b = req.body;
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Informe o nome do produto.' });

  let photo = null, photoPath = null;
  if (req.file) { const up = await uploadFile(req.file, 'produtos'); photo = up.url; photoPath = up.key; }

  const row = await one(`
    INSERT INTO products (name, category_id, color, description, cost_price, sale_price, quantity, min_stock, sku, photo, photo_path, published)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      name,
      b.category_id ? Number(b.category_id) : null,
      b.color || null,
      b.description || null,
      parseFloat(b.cost_price || '0') || 0,
      parseFloat(b.sale_price || '0') || 0,
      parseInt(b.quantity || '0', 10) || 0,
      parseInt(b.min_stock || '0', 10) || 0,
      b.sku || null,
      photo,
      photoPath,
      b.published === '1' || b.published === 'true',
    ]);
  res.json(productView(row));
}));

router.put('/products/:id', memory.single('photo'), wrap(async (req, res) => {
  const p = await one('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const b = req.body;

  let photo = p.photo, photoPath = p.photo_path;
  if (req.file) {
    if (p.photo_path) await removeFile(p.photo_path);
    const up = await uploadFile(req.file, 'produtos'); photo = up.url; photoPath = up.key;
  } else if (b.remove_photo === '1' && p.photo_path) {
    await removeFile(p.photo_path); photo = null; photoPath = null;
  }

  const row = await one(`
    UPDATE products SET
      name=$1, category_id=$2, color=$3, description=$4, cost_price=$5, sale_price=$6,
      quantity=$7, min_stock=$8, sku=$9, photo=$10, photo_path=$11, published=$12
    WHERE id=$13 RETURNING *`,
    [
      (b.name || p.name).trim(),
      b.category_id ? Number(b.category_id) : null,
      b.color !== undefined ? b.color : p.color,
      b.description !== undefined ? b.description : p.description,
      b.cost_price !== undefined ? (parseFloat(b.cost_price) || 0) : p.cost_price,
      b.sale_price !== undefined ? (parseFloat(b.sale_price) || 0) : p.sale_price,
      b.quantity !== undefined ? (parseInt(b.quantity, 10) || 0) : p.quantity,
      b.min_stock !== undefined ? (parseInt(b.min_stock, 10) || 0) : p.min_stock,
      b.sku !== undefined ? b.sku : p.sku,
      photo, photoPath,
      b.published !== undefined ? (b.published === '1' || b.published === 'true') : p.published,
      p.id,
    ]);
  res.json(productView(row));
}));

router.post('/products/:id/publish', wrap(async (req, res) => {
  const p = await one('SELECT id FROM products WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const publish = req.body.published === undefined ? true : !!req.body.published;
  await pool.query('UPDATE products SET published = $1 WHERE id = $2', [publish, p.id]);
  res.json({ ok: true, published: publish });
}));

router.delete('/products/:id', wrap(async (req, res) => {
  const p = await one('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  if (p.photo_path) await removeFile(p.photo_path);
  await pool.query('DELETE FROM products WHERE id = $1', [p.id]);
  res.json({ ok: true });
}));

// ----------------------------- ESTOQUE -----------------------------
router.post('/stock/movements', wrap(async (req, res) => {
  const b = req.body || {};
  const productId = Number(b.product_id);
  const type = b.type === 'in' ? 'in' : 'out';
  const quantity = parseInt(b.quantity, 10);
  const unitPrice = parseFloat(b.unit_price || '0') || 0;

  const p = await one('SELECT * FROM products WHERE id = $1', [productId]);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Quantidade inválida.' });
  if (type === 'out' && quantity > p.quantity) {
    return res.status(400).json({ error: `Estoque insuficiente. Disponível: ${p.quantity}.` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO stock_movements (product_id, type, reason, quantity, unit_price, note) VALUES ($1,$2,$3,$4,$5,$6)',
      [productId, type, b.reason || null, quantity, unitPrice, b.note || null]);

    const newQty = type === 'in' ? p.quantity + quantity : p.quantity - quantity;
    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQty, productId]);

    if (b.affect_finance === true || b.affect_finance === '1' || b.affect_finance === 'true') {
      const amount = quantity * unitPrice;
      if (amount > 0) {
        if (type === 'in') {
          await client.query('INSERT INTO finance_transactions (type, description, amount) VALUES ($1,$2,$3)',
            ['expense', `Compra de estoque: ${quantity}x ${p.name}`, amount]);
        } else {
          await client.query('INSERT INTO finance_transactions (type, description, amount) VALUES ($1,$2,$3)',
            ['revenue', `Venda: ${quantity}x ${p.name}`, amount]);
        }
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  res.json({ ok: true });
}));

router.get('/stock/movements', wrap(async (req, res) => {
  res.json(await all(`
    SELECT m.*, p.name AS product_name
    FROM stock_movements m LEFT JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 200`));
}));

// ----------------------------- FINANCEIRO -----------------------------
router.get('/finance', wrap(async (req, res) => {
  res.json(await all('SELECT * FROM finance_transactions ORDER BY created_at DESC, id DESC LIMIT 300'));
}));
router.post('/finance', wrap(async (req, res) => {
  const b = req.body || {};
  const type = b.type === 'revenue' ? 'revenue' : 'expense';
  const amount = parseFloat(b.amount || '0') || 0;
  if (amount <= 0) return res.status(400).json({ error: 'Valor inválido.' });
  const row = await one('INSERT INTO finance_transactions (type, description, amount) VALUES ($1,$2,$3) RETURNING id',
    [type, b.description || (type === 'revenue' ? 'Receita' : 'Despesa'), amount]);
  res.json({ id: row.id });
}));
router.delete('/finance/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM finance_transactions WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
router.post('/finance/initial-cash', wrap(async (req, res) => {
  const v = parseFloat(req.body.value || '0') || 0;
  await setSetting('initial_cash', v);
  res.json({ ok: true, initialCash: v });
}));

// ----------------------------- NOTAS FISCAIS -----------------------------
router.get('/invoices', wrap(async (req, res) => {
  const rows = await all('SELECT * FROM invoices ORDER BY created_at DESC, id DESC');
  res.json(rows.map((i) => ({ ...i, file_url: i.file_path || null })));
}));
router.post('/invoices', memory.single('file'), wrap(async (req, res) => {
  const b = req.body || {};
  const type = b.type === 'sale' ? 'sale' : 'purchase';
  let fileUrl = null, fileKey = null;
  if (req.file) { const up = await uploadFile(req.file, 'notas'); fileUrl = up.url; fileKey = up.key; }
  const row = await one('INSERT INTO invoices (type, description, amount, file_path, file_key) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [type, b.description || null, parseFloat(b.amount || '0') || 0, fileUrl, fileKey]);
  res.json({ id: row.id, file_url: fileUrl });
}));
router.delete('/invoices/:id', wrap(async (req, res) => {
  const inv = await one('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
  if (inv && inv.file_key) await removeFile(inv.file_key);
  await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ----------------------------- MENSAGENS -----------------------------
router.get('/messages', wrap(async (req, res) => {
  res.json(await all(`
    SELECT m.*, p.name AS product_name
    FROM messages m LEFT JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC`));
}));
router.post('/messages/:id/read', wrap(async (req, res) => {
  await pool.query("UPDATE messages SET status='respondido' WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));
router.delete('/messages/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ----------------------------- FRETE -----------------------------
router.get('/shipping', wrap(async (req, res) => {
  res.json(await all('SELECT * FROM shipping_rates ORDER BY price'));
}));
router.put('/shipping/:id', wrap(async (req, res) => {
  const b = req.body || {};
  await pool.query('UPDATE shipping_rates SET price = $1, days = $2 WHERE id = $3',
    [parseFloat(b.price || '0') || 0, b.days || null, req.params.id]);
  res.json({ ok: true });
}));

// ----------------------------- CONFIGURACOES -----------------------------
const PUBLIC_SETTINGS = ['store_name', 'store_tagline', 'seller_name', 'seller_phone', 'seller_whatsapp', 'seller_email'];

router.get('/settings', wrap(async (req, res) => {
  const out = {};
  for (const k of PUBLIC_SETTINGS) out[k] = await getSetting(k);
  out.initial_cash = await getSetting('initial_cash');
  out.admin_user = (await getSetting('admin_user')) || (process.env.ADMIN_USER || 'admin');
  res.json(out);
}));
router.put('/settings', wrap(async (req, res) => {
  const b = req.body || {};
  for (const k of PUBLIC_SETTINGS) if (b[k] !== undefined) await setSetting(k, b[k]);
  res.json({ ok: true });
}));
router.put('/credentials', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.user) await setSetting('admin_user', String(b.user).trim());
  if (b.password) {
    if (String(b.password).length < 4) return res.status(400).json({ error: 'Senha muito curta (mínimo 4).' });
    await setSetting('admin_pass_hash', bcrypt.hashSync(String(b.password), 10));
  }
  res.json({ ok: true });
}));

module.exports = router;
