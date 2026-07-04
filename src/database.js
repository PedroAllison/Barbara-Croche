/**
 * Conexao com o banco Postgres (Supabase) usando o pooler em modo transacao.
 * Funciona bem em ambiente serverless (Vercel).
 */
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL || '';
if (!connectionString) {
  console.warn('[ATENCAO] DATABASE_URL nao definido. Configure a variavel de ambiente (Supabase).');
}

// Remove "sslmode=..." do texto para evitar conflito de verificacao de certificado.
// O SSL e definido abaixo (rejectUnauthorized:false) - o Supabase usa cert proprio.
connectionString = connectionString.replace(/([?&])sslmode=[^&]*/i, '$1').replace(/[?&]+$/, '');

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

// Pool pequeno e reutilizado entre invocacoes "quentes" do serverless.
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 10000,
  // Supabase exige SSL, mas com certificado proprio (nao verificar a cadeia)
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

/**
 * Executa uma query. Use $1, $2... como placeholders.
 * Retorna o objeto result do pg (use .rows).
 */
function query(text, params) {
  return pool.query(text, params);
}

/** Retorna a primeira linha (ou null). */
async function one(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}

/** Retorna todas as linhas. */
async function all(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}

// ---- Settings (chave/valor) ----
async function getSetting(key) {
  const row = await one('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : null;
}
async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}

module.exports = { pool, query, one, all, getSetting, setSetting };
