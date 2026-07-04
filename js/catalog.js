/* Pagina inicial: catalogo de produtos */
(function () {
  const { api, esc, brl } = window.BC;
  const grid = document.querySelector('#products-grid');
  const search = document.querySelector('#search');
  const catFilter = document.querySelector('#category-filter');
  let timer = null;

  async function loadCategories() {
    try {
      const cats = await api('/categories');
      catFilter.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    } catch (_) {}
  }

  async function loadProducts() {
    const params = new URLSearchParams();
    if (search.value) params.set('q', search.value);
    if (catFilter.value) params.set('category', catFilter.value);
    let list = [];
    try { list = await api('/products?' + params.toString()); } catch (_) {}
    document.querySelector('#empty-msg').classList.toggle('hidden', list.length > 0);
    grid.innerHTML = list.map((p) => `
      <a class="product-card" href="/produto.html?id=${p.id}">
        <div class="img">${p.photo_url ? `<img src="${p.photo_url}" alt="${esc(p.name)}">` : '<span class="placeholder">🧶</span>'}</div>
        <div class="info">
          <span class="cat">${esc(p.category_name || '')}</span>
          <span class="name">${esc(p.name)}</span>
          <span class="price">${brl(p.price)}</span>
          <span class="stock-tag ${p.in_stock ? 'in' : 'out'}">${p.in_stock ? 'Em estoque: ' + p.quantity : 'Esgotado'}</span>
        </div>
      </a>`).join('');
  }

  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadProducts, 250); });
  catFilter.addEventListener('change', loadProducts);

  loadCategories();
  loadProducts();
})();
