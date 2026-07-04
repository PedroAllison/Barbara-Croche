/* Pagina de detalhe do produto */
(function () {
  const { api, esc, brl, toast, isLogged, openAccountModal, getStoreInfo } = window.BC;
  const box = document.querySelector('#product-detail');
  const id = new URLSearchParams(location.search).get('id');
  let product = null;

  async function load() {
    if (!id) { box.innerHTML = '<p class="empty">Produto não informado.</p>'; return; }
    try {
      product = await api('/products/' + id);
    } catch (err) {
      box.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
      return;
    }
    render();
  }

  function render() {
    const p = product;
    box.innerHTML = `
      <div class="photo">${p.photo_url ? `<img src="${p.photo_url}" alt="${esc(p.name)}">` : '<span class="placeholder">🧶</span>'}</div>
      <div class="pd-info">
        <div class="pd-cat">${esc(p.category_name || '')}</div>
        <h1 class="pd-name">${esc(p.name)}</h1>
        <div class="pd-price">${brl(p.price)}</div>
        <div class="pd-meta">
          ${p.color ? `<span>🎨 Cor: <strong>${esc(p.color)}</strong></span>` : ''}
          <span class="stock-tag ${p.in_stock ? 'in' : 'out'}">${p.in_stock ? 'Em estoque: ' + p.quantity + ' un.' : 'Esgotado'}</span>
          ${p.sku ? `<span class="muted small">Cód.: ${esc(p.sku)}</span>` : ''}
        </div>
        ${p.description ? `<p class="pd-desc">${esc(p.description)}</p>` : ''}

        <div class="box">
          <h3>📦 Calcular frete</h3>
          <div class="ship-row">
            <input id="cep" type="text" inputmode="numeric" maxlength="9" placeholder="Digite seu CEP" />
            <button class="btn btn-primary" id="calc-ship">Calcular</button>
          </div>
          <div id="ship-result" class="ship-result"></div>
        </div>

        <div class="box">
          <h3>💬 Falar com o vendedor</h3>
          <div id="contact-area"></div>
        </div>
      </div>`;

    document.querySelector('#calc-ship').onclick = calcShipping;
    document.querySelector('#cep').addEventListener('keydown', (e) => { if (e.key === 'Enter') calcShipping(); });
    renderContact();
  }

  async function calcShipping() {
    const cep = document.querySelector('#cep').value;
    const out = document.querySelector('#ship-result');
    out.innerHTML = 'Calculando...';
    try {
      const r = await api('/shipping/calc', { method: 'POST', body: { cep } });
      out.innerHTML = `<strong>${r.region}</strong> · ${brl(r.price)} ${r.days ? `· prazo: ${esc(r.days)}` : ''}`;
    } catch (err) {
      out.innerHTML = `<span style="color:#d65555">${esc(err.message)}</span>`;
    }
  }

  function renderContact() {
    const area = document.querySelector('#contact-area');
    const info = getStoreInfo();
    const wppLink = info.seller_whatsapp
      ? `https://wa.me/${info.seller_whatsapp}?text=${encodeURIComponent('Olá! Tenho interesse no produto: ' + product.name)}`
      : null;

    let html = '';
    if (wppLink) {
      html += `<a class="btn btn-whats btn-block" target="_blank" href="${wppLink}">💬 Chamar no WhatsApp</a>`;
    }
    if (info.seller_phone) html += `<p class="muted small" style="margin-top:8px">📞 ${esc(info.seller_phone)}</p>`;

    html += '<hr style="border:none;border-top:1px solid #ece4ee;margin:14px 0">';
    if (isLogged()) {
      html += `
        <p class="muted small">Envie uma mensagem direto pelo site:</p>
        <textarea id="msg-text" rows="3" placeholder="Escreva sua mensagem..."></textarea>
        <button class="btn btn-primary btn-block" id="send-msg" style="margin-top:8px">Enviar mensagem</button>
        <p id="msg-status" class="error-text"></p>`;
    } else {
      html += `<p class="muted small">Para enviar uma mensagem pelo site, <button class="btn-link" id="need-login">crie uma conta ou entre</button>. (Não é obrigatório só para ver os produtos.)</p>`;
    }
    area.innerHTML = html;

    if (isLogged()) {
      document.querySelector('#send-msg').onclick = sendMessage;
    } else {
      document.querySelector('#need-login').onclick = openAccountModal;
    }
  }

  async function sendMessage() {
    const text = document.querySelector('#msg-text').value.trim();
    const status = document.querySelector('#msg-status');
    if (!text) { status.textContent = 'Escreva sua mensagem.'; return; }
    try {
      await api('/contact', { method: 'POST', body: { product_id: product.id, message: text } });
      toast('Mensagem enviada ao vendedor!');
      document.querySelector('#msg-text').value = '';
      status.textContent = '';
    } catch (err) { status.textContent = err.message; }
  }

  // re-renderiza o contato quando o cliente faz login pelo modal
  window.BC_onLogin = renderContact;

  load();
})();
