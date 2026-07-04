/* Comum a todas as paginas da loja: info da loja, conta do cliente, toast */
window.BC = (function () {
  const API = '/api/store';
  let token = localStorage.getItem('bc_customer_token') || null;
  let customerName = localStorage.getItem('bc_customer_name') || null;
  let storeInfo = {};

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function toast(msg, type) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.className = 'toast ' + (type || 'ok');
    setTimeout(() => t.classList.add('hidden'), 2800);
  }

  async function api(pathname, opts = {}) {
    const headers = opts.headers || {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + pathname, { ...opts, headers });
    let data = null; try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || 'Erro');
    return data;
  }

  function isLogged() { return !!token; }

  function setSession(t, name) {
    token = t; customerName = name;
    localStorage.setItem('bc_customer_token', t);
    localStorage.setItem('bc_customer_name', name);
    renderAccount();
  }
  function logout() {
    token = null; customerName = null;
    localStorage.removeItem('bc_customer_token');
    localStorage.removeItem('bc_customer_name');
    renderAccount();
    toast('Você saiu da conta.');
  }

  // ---- header + footer da loja ----
  async function loadStoreInfo() {
    try {
      storeInfo = await api('/info');
    } catch (_) { storeInfo = {}; }
    const setText = (id, v) => { const el = $('#' + id); if (el && v) el.textContent = v; };
    setText('store-name', storeInfo.store_name);
    setText('hero-title', storeInfo.store_name ? storeInfo.store_name : null);
    setText('hero-tagline', storeInfo.store_tagline);
    setText('footer-store', storeInfo.store_name);
    setText('footer-tagline', storeInfo.store_tagline);
    document.title = (storeInfo.store_name || 'Loja') + (document.title.includes('Produto') ? ' · Produto' : ' · Loja');
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

    const fc = $('#footer-contact');
    if (fc) {
      fc.innerHTML = `
        <strong>Contato</strong>
        ${storeInfo.seller_name ? `<div class="muted small">${esc(storeInfo.seller_name)}</div>` : ''}
        ${storeInfo.seller_phone ? `<div class="muted small">📞 ${esc(storeInfo.seller_phone)}</div>` : ''}
        ${storeInfo.seller_email ? `<a class="small" href="mailto:${esc(storeInfo.seller_email)}">✉️ ${esc(storeInfo.seller_email)}</a>` : ''}
        ${storeInfo.seller_whatsapp ? `<a class="small" target="_blank" href="https://wa.me/${esc(storeInfo.seller_whatsapp)}">💬 WhatsApp</a>` : ''}`;
    }
    renderAccount();
  }

  function renderAccount() {
    const el = $('#account-area');
    if (!el) return;
    if (isLogged()) {
      el.innerHTML = `<span class="muted">Olá, ${esc(customerName || 'cliente')}</span> · <button class="btn-link" id="logout-link">Sair</button>`;
      $('#logout-link').onclick = logout;
    } else {
      el.innerHTML = `<button class="btn-link" id="open-account">Entrar / Criar conta</button>`;
      $('#open-account').onclick = openAccountModal;
    }
  }

  // ---- modal de conta ----
  function openAccountModal() {
    const m = $('#account-modal'); if (m) m.classList.remove('hidden');
  }
  function closeAccountModal() {
    const m = $('#account-modal'); if (m) m.classList.add('hidden');
  }

  function wireAccountModal() {
    const close = $('#account-close'); if (close) close.onclick = closeAccountModal;
    $$('.tab-btn').forEach((b) => b.onclick = () => {
      $$('.tab-btn').forEach((x) => x.classList.toggle('active', x === b));
      $('#login-form').classList.toggle('hidden', b.dataset.at !== 'login');
      $('#register-form').classList.toggle('hidden', b.dataset.at !== 'register');
    });
    const lf = $('#login-form');
    if (lf) lf.addEventListener('submit', async (e) => {
      e.preventDefault(); $('#li-msg').textContent = '';
      try {
        const d = await api('/account/login', { method: 'POST', body: { email: $('#li-email').value, password: $('#li-pass').value } });
        setSession(d.token, d.name); closeAccountModal(); toast('Bem-vindo(a)!');
        if (window.BC_onLogin) window.BC_onLogin();
      } catch (err) { $('#li-msg').textContent = err.message; }
    });
    const rf = $('#register-form');
    if (rf) rf.addEventListener('submit', async (e) => {
      e.preventDefault(); $('#rg-msg').textContent = '';
      try {
        const d = await api('/account/register', { method: 'POST', body: {
          name: $('#rg-name').value, email: $('#rg-email').value, phone: $('#rg-phone').value, password: $('#rg-pass').value } });
        setSession(d.token, d.name); closeAccountModal(); toast('Conta criada!');
        if (window.BC_onLogin) window.BC_onLogin();
      } catch (err) { $('#rg-msg').textContent = err.message; }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireAccountModal();
    loadStoreInfo();
  });

  return { api, esc, brl, toast, isLogged, openAccountModal, getStoreInfo: () => storeInfo, getName: () => customerName };
})();
