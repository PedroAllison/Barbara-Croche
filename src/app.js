/**
 * App Express (sem "listen"). Usado tanto pela Vercel (api/index.js)
 * quanto pelo servidor local (server.js).
 */
const path = require('path');
const express = require('express');

const adminRoutes = require('./routes/admin');
const storeRoutes = require('./routes/store');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check simples
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// APIs
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);

// Arquivos estaticos (no local). Na Vercel, os estaticos sao servidos pela CDN.
// Servimos a raiz do projeto e a pasta admin (so para rodar localmente).
const ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR, { index: 'index.html', extensions: ['html'] }));
// Atalho: /admin abre o painel
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin', 'index.html')));

// Tratamento de erros (ex.: upload invalido)
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || 'Erro inesperado.' });
});

module.exports = app;
