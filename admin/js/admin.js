/* Painel gerencial - Barbara Croche */
(function () {
  const API = '/api/admin';
  let token = null;
  let categories = [];
  let productsCache = [];

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '');

  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'ok');
    setTimeout(() => t.classList.add('hidden'), 2600);
  }

  async function api(pathname, opts = {}) {
    const headers = opts.headers || {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + pathname, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || 'Erro na requisição');
    return data;
  }

  // ---------- LOGIN ----------
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#login-error').textContent = '';
    try {
      const r = await fetch(API + '/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: $('#login-user').value, pass: $('#login-pass').value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha no login');
      token = d.token;
      sessionStorage.setItem('bc_admin_token', token);
      enterApp();
    } catch (err) {
      $('#login-error').textContent = err.message;
    }
  });

  $('#logout-btn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch (_) {}
    token = null;
    sessionStorage.removeItem('bc_admin_token');
    $('#app').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
  });

  async function enterApp() {
    $('#login-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await loadCategories();
    await loadDashboard();
    await loadProducts();
  }

  // ---------- MENU MOBILE (gaveta) ----------
  function openDrawer() {
    $('#sidebar').classList.add('open');
    $('#sidebar-overlay').classList.add('show');
  }
  function closeDrawer() {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('show');
  }
  const menuToggle = $('#menu-toggle');
  if (menuToggle) menuToggle.addEventListener('click', openDrawer);
  const overlay = $('#sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // ---------- NAV ----------
  $$('.nav-item').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $$('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    switchTab(b.dataset.jump);
    if (b.dataset.action === 'new-product') openProductModal();
  }));

  function switchTab(tab) {
    closeDrawer();
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab').forEach((s) => s.classList.remove('active'));
    $('#tab-' + tab).classList.add('active');
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'produtos') loadProducts();
    if (tab === 'estoque') { loadProductOptions(); loadMovements(); }
    if (tab === 'financeiro') { loadFinanceCards(); loadFinance(); }
    if (tab === 'notas') loadInvoices();
    if (tab === 'mensagens') loadMessages();
    if (tab === 'config') { loadSettings(); loadShipping(); }
  }

  // ---------- DASHBOARD ----------
  async function loadDashboard() {
    const d = await api('/dashboard');
    $('#dashboard-cards').innerHTML = `
      ${card('Caixa disponível', brl(d.cash), 'green')}
      ${card('Faturamento total', brl(d.revenue), 'pink')}
      ${card('Faturamento do mês', brl(d.revenueMonth), 'pink')}
      ${card('Valor em estoque (custo)', brl(d.stock_cost_value))}
      ${card('Produtos cadastrados', d.total_products)}
      ${card('Itens em estoque', d.total_items)}
      ${card('Publicados no site', d.published)}
      ${card('Estoque baixo', d.low_stock, d.low_stock > 0 ? 'red' : '')}
    `;
    updateMsgBadge(d.unreadMessages);
  }
  function card(label, value, cls) {
    return `<div class="card ${cls || ''}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  }
  function updateMsgBadge(n) {
    const b = $('#msg-badge');
    if (n > 0) { b.textContent = n; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  // ---------- CATEGORIAS ----------
  async function loadCategories() {
    categories = await api('/categories');
    const opts = '<option value="">Sem categoria</option>' +
      categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('#prod-category').innerHTML = opts;
  }

  // ---------- PRODUTOS ----------
  async function loadProducts() {
    productsCache = await api('/products');
    renderProducts();
  }
  $('#prod-search').addEventListener('input', renderProducts);

  function renderProducts() {
    const q = $('#prod-search').value.toLowerCase();
    const list = productsCache.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || (p.color || '').toLowerCase().includes(q) || (p.category_name || '').toLowerCase().includes(q));
    $('#products-table tbody').innerHTML = list.map((p) => `
      <tr>
        <td>${p.photo_url ? `<img class="thumb" src="${p.photo_url}">` : '<div class="thumb"></div>'}</td>
        <td><strong>${esc(p.name)}</strong>${p.sku ? `<br><span class="muted">${esc(p.sku)}</span>` : ''}</td>
        <td>${esc(p.category_name || '-')}</td>
        <td>${esc(p.color || '-')}</td>
        <td class="${p.quantity <= p.min_stock ? 'low' : ''}">${p.quantity}</td>
        <td>${brl(p.cost_price)}</td>
        <td>${brl(p.sale_price)}</td>
        <td>${p.published ? '<span class="pill on">No site</span>' : '<span class="pill off">Oculto</span>'}</td>
        <td><div class="acts">
          <button class="btn btn-sm" data-edit="${p.id}">Editar</button>
          <button class="btn btn-sm ${p.published ? '' : 'btn-success'}" data-pub="${p.id}" data-on="${p.published}">${p.published ? 'Tirar' : 'Postar'}</button>
          <button class="btn btn-sm btn-danger" data-del="${p.id}">Excluir</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="9" class="muted" style="padding:18px">Nenhum produto ainda. Clique em "Cadastrar produto".</td></tr>';

    $$('[data-edit]').forEach((b) => b.onclick = () => openProductModal(Number(b.dataset.edit)));
    $$('[data-del]').forEach((b) => b.onclick = () => deleteProduct(Number(b.dataset.del)));
    $$('[data-pub]').forEach((b) => b.onclick = () => togglePublish(Number(b.dataset.pub), b.dataset.on === '1' ? 0 : 1));
  }

  async function togglePublish(id, published) {
    await api(`/products/${id}/publish`, { method: 'POST', body: { published } });
    toast(published ? 'Produto postado no site!' : 'Produto retirado do site.');
    loadProducts();
  }
  async function deleteProduct(id) {
    if (!confirm('Excluir este produto? Esta ação não pode ser desfeita.')) return;
    await api(`/products/${id}`, { method: 'DELETE' });
    toast('Produto excluído.');
    loadProducts();
  }

  // ----- modal produto -----
  const modal = $('#product-modal');
  $('#btn-new-product').onclick = () => openProductModal();
  $('#product-modal-close').onclick = closeProductModal;
  $('#product-cancel').onclick = closeProductModal;
  $('#prod-photo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    $('#prod-photo-preview').innerHTML = f ? `<img src="${URL.createObjectURL(f)}">` : '';
  });

  function openProductModal(id) {
    $('#product-form').reset();
    $('#prod-photo-preview').innerHTML = '';
    $('#prod-msg').textContent = '';
    loadCategories();
    if (id) {
      const p = productsCache.find((x) => x.id === id);
      $('#product-modal-title').textContent = 'Editar produto';
      $('#prod-id').value = p.id;
      $('#prod-name').value = p.name;
      $('#prod-category').value = p.category_id || '';
      $('#prod-color').value = p.color || '';
      $('#prod-sku').value = p.sku || '';
      $('#prod-cost').value = p.cost_price;
      $('#prod-sale').value = p.sale_price;
      $('#prod-qty').value = p.quantity;
      $('#prod-min').value = p.min_stock;
      $('#prod-desc').value = p.description || '';
      $('#prod-published').checked = !!p.published;
      if (p.photo_url) $('#prod-photo-preview').innerHTML = `<img src="${p.photo_url}">`;
      $('#product-save-publish').classList.add('hidden');
    } else {
      $('#product-modal-title').textContent = 'Cadastrar produto';
      $('#prod-id').value = '';
      $('#product-save-publish').classList.remove('hidden');
    }
    modal.classList.remove('hidden');
  }
  function closeProductModal() { modal.classList.add('hidden'); }

  $('#product-save-publish').onclick = () => submitProduct(true);
  $('#product-form').addEventListener('submit', (e) => { e.preventDefault(); submitProduct(false); });

  async function submitProduct(forcePublish) {
    $('#prod-msg').textContent = '';
    const id = $('#prod-id').value;
    const fd = new FormData();
    fd.append('name', $('#prod-name').value);
    fd.append('category_id', $('#prod-category').value);
    fd.append('color', $('#prod-color').value);
    fd.append('sku', $('#prod-sku').value);
    fd.append('cost_price', $('#prod-cost').value || '0');
    fd.append('sale_price', $('#prod-sale').value || '0');
    fd.append('quantity', $('#prod-qty').value || '0');
    fd.append('min_stock', $('#prod-min').value || '0');
    fd.append('description', $('#prod-desc').value);
    fd.append('published', (forcePublish || $('#prod-published').checked) ? '1' : '0');
    const photo = $('#prod-photo').files[0];
    if (photo) fd.append('photo', photo);
    try {
      if (id) await api('/products/' + id, { method: 'PUT', body: fd });
      else await api('/products', { method: 'POST', body: fd });
      toast(forcePublish ? 'Produto salvo e postado no site!' : 'Produto salvo!');
      closeProductModal();
      loadProducts();
    } catch (err) {
      $('#prod-msg').textContent = err.message;
    }
  }

  // ---------- ESTOQUE ----------
  async function loadProductOptions() {
    if (!productsCache.length) productsCache = await api('/products');
    $('#mov-product').innerHTML = productsCache
      .map((p) => `<option value="${p.id}">${esc(p.name)} (estoque: ${p.quantity})</option>`).join('');
  }
  async function loadMovements() {
    const rows = await api('/stock/movements');
    $('#movements-table tbody').innerHTML = rows.map((m) => `
      <tr>
        <td>${fmtDate(m.created_at)}</td>
        <td>${esc(m.product_name || '-')}</td>
        <td><span class="pill ${m.type}">${m.type === 'in' ? 'Entrada' : 'Saída'}</span></td>
        <td>${m.quantity}</td>
        <td>${esc(m.reason || '-')}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:14px">Sem movimentações.</td></tr>';
  }
  $('#mov-type').addEventListener('change', (e) => {
    $('#mov-reason').value = e.target.value === 'in' ? 'compra' : 'venda';
  });
  $('#movement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#mov-msg').textContent = '';
    try {
      await api('/stock/movements', { method: 'POST', body: {
        product_id: $('#mov-product').value,
        type: $('#mov-type').value,
        quantity: $('#mov-qty').value,
        unit_price: $('#mov-price').value,
        reason: $('#mov-reason').value,
        affect_finance: $('#mov-finance').checked,
        note: $('#mov-note').value,
      }});
      toast('Movimentação registrada!');
      $('#movement-form').reset();
      productsCache = [];
      await loadProductOptions();
      loadMovements();
    } catch (err) { $('#mov-msg').textContent = err.message; }
  });

  // ---------- FINANCEIRO ----------
  async function loadFinanceCards() {
    const d = await api('/dashboard');
    $('#finance-cards').innerHTML = `
      ${card('Caixa disponível', brl(d.cash), 'green')}
      ${card('Faturamento total', brl(d.revenue), 'pink')}
      ${card('Despesas totais', brl(d.expense), 'red')}
      ${card('Resultado do mês', brl(d.revenueMonth - d.expenseMonth), (d.revenueMonth - d.expenseMonth) >= 0 ? 'green' : 'red')}
    `;
    $('#cash-value').placeholder = 'Caixa inicial atual: ' + brl(d.initialCash);
  }
  async function loadFinance() {
    const rows = await api('/finance');
    $('#finance-table tbody').innerHTML = rows.map((t) => `
      <tr>
        <td>${fmtDate(t.created_at)}</td>
        <td><span class="pill ${t.type === 'revenue' ? 'in' : 'out'}">${t.type === 'revenue' ? 'Receita' : 'Despesa'}</span></td>
        <td>${esc(t.description || '-')}</td>
        <td>${brl(t.amount)}</td>
        <td><button class="btn btn-sm btn-danger" data-finx="${t.id}">×</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:14px">Sem lançamentos.</td></tr>';
    $$('[data-finx]').forEach((b) => b.onclick = async () => {
      await api('/finance/' + b.dataset.finx, { method: 'DELETE' });
      loadFinance(); loadFinanceCards();
    });
  }
  $('#cash-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/finance/initial-cash', { method: 'POST', body: { value: $('#cash-value').value || '0' } });
    toast('Caixa atualizado!');
    $('#cash-value').value = '';
    loadFinanceCards();
  });
  $('#finance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/finance', { method: 'POST', body: {
        type: $('#fin-type').value, amount: $('#fin-amount').value, description: $('#fin-desc').value,
      }});
      toast('Lançamento adicionado!');
      $('#finance-form').reset();
      loadFinance(); loadFinanceCards();
    } catch (err) { toast(err.message, 'err'); }
  });

  // ---------- NOTAS FISCAIS ----------
  async function loadInvoices() {
    const rows = await api('/invoices');
    $('#invoices-table tbody').innerHTML = rows.map((i) => `
      <tr>
        <td>${fmtDate(i.created_at)}</td>
        <td><span class="pill ${i.type === 'sale' ? 'in' : 'out'}">${i.type === 'sale' ? 'Venda' : 'Compra'}</span></td>
        <td>${esc(i.description || '-')}</td>
        <td>${brl(i.amount)}</td>
        <td>${i.file_url ? `<a href="${i.file_url}" target="_blank">abrir</a>` : '-'}</td>
        <td><button class="btn btn-sm btn-danger" data-invx="${i.id}">×</button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted" style="padding:14px">Nenhuma nota guardada.</td></tr>';
    $$('[data-invx]').forEach((b) => b.onclick = async () => {
      if (!confirm('Excluir esta nota?')) return;
      await api('/invoices/' + b.dataset.invx, { method: 'DELETE' });
      loadInvoices();
    });
  }
  $('#invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#inv-msg').textContent = '';
    const fd = new FormData();
    fd.append('type', $('#inv-type').value);
    fd.append('description', $('#inv-desc').value);
    fd.append('amount', $('#inv-amount').value || '0');
    const f = $('#inv-file').files[0];
    if (f) fd.append('file', f);
    try {
      await api('/invoices', { method: 'POST', body: fd });
      toast('Nota guardada!');
      $('#invoice-form').reset();
      loadInvoices();
    } catch (err) { $('#inv-msg').textContent = err.message; }
  });

  // ---------- MENSAGENS ----------
  async function loadMessages() {
    const rows = await api('/messages');
    updateMsgBadge(rows.filter((m) => m.status === 'novo').length);
    $('#messages-list').innerHTML = rows.map((m) => `
      <div class="msg-card ${m.status === 'novo' ? '' : 'read'}">
        <div class="meta">
          <span>👤 ${esc(m.name || '-')}</span>
          <span>✉️ ${esc(m.email || '-')}</span>
          ${m.phone ? `<span>📞 ${esc(m.phone)}</span>` : ''}
          ${m.product_name ? `<span>📦 ${esc(m.product_name)}</span>` : ''}
          <span>${fmtDate(m.created_at)}</span>
        </div>
        <div class="body">${esc(m.message || '')}</div>
        <div class="acts">
          ${m.status === 'novo' ? `<button class="btn btn-sm" data-msgread="${m.id}">Marcar como respondido</button>` : ''}
          <button class="btn btn-sm btn-danger" data-msgx="${m.id}">Excluir</button>
        </div>
      </div>`).join('') || '<p class="muted">Nenhuma mensagem.</p>';
    $$('[data-msgread]').forEach((b) => b.onclick = async () => {
      await api(`/messages/${b.dataset.msgread}/read`, { method: 'POST' });
      loadMessages();
    });
    $$('[data-msgx]').forEach((b) => b.onclick = async () => {
      await api('/messages/' + b.dataset.msgx, { method: 'DELETE' });
      loadMessages();
    });
  }

  // ---------- CONFIGURACOES ----------
  async function loadSettings() {
    const s = await api('/settings');
    ['store_name', 'store_tagline', 'seller_name', 'seller_phone', 'seller_whatsapp', 'seller_email']
      .forEach((k) => { const el = $('#set-' + k); if (el) el.value = s[k] || ''; });
    $('#cred-user').value = s.admin_user || '';
  }
  $('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    ['store_name', 'store_tagline', 'seller_name', 'seller_phone', 'seller_whatsapp', 'seller_email']
      .forEach((k) => body[k] = $('#set-' + k).value);
    await api('/settings', { method: 'PUT', body });
    toast('Configurações salvas!');
  });
  $('#cred-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#cred-msg').textContent = '';
    try {
      await api('/credentials', { method: 'PUT', body: { user: $('#cred-user').value, password: $('#cred-pass').value } });
      toast('Acesso atualizado!');
      $('#cred-pass').value = '';
    } catch (err) { $('#cred-msg').textContent = err.message; }
  });

  async function loadShipping() {
    const rows = await api('/shipping');
    $('#shipping-table tbody').innerHTML = rows.map((r) => `
      <tr>
        <td>${esc(r.region)}</td>
        <td><input type="number" step="0.01" value="${r.price}" data-shipprice="${r.id}" style="width:90px"></td>
        <td><input type="text" value="${esc(r.days || '')}" data-shipdays="${r.id}" style="width:130px"></td>
        <td><button class="btn btn-sm" data-shipsave="${r.id}">Salvar</button></td>
      </tr>`).join('');
    $$('[data-shipsave]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.shipsave;
      await api('/shipping/' + id, { method: 'PUT', body: {
        price: $(`[data-shipprice="${id}"]`).value,
        days: $(`[data-shipdays="${id}"]`).value,
      }});
      toast('Frete atualizado!');
    });
  }

  // ---------- util ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- auto login ----------
  const saved = sessionStorage.getItem('bc_admin_token');
  if (saved) {
    token = saved;
    api('/dashboard').then(enterApp).catch(() => {
      token = null; sessionStorage.removeItem('bc_admin_token');
    });
  }
})();
