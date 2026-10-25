import { get } from '/js/api.js';

const CATEGORY_ICONS = {
  rings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M3,14A9,9,0,1,0,14.822,5.46l1.019-1.585a1,1,0,0,0,.031-1.032l-.75-1.333A1,1,0,0,0,14.25,1H9.75a1,1,0,0,0-.872.51l-.75,1.333a1,1,0,0,0,.031,1.032L9.178,5.46A9.011,9.011,0,0,0,3,14Zm8.282-8.966L10.167,3.3l.168-.3h3.33l.168.3L12.718,5.034C12.468,5.011,12.23,5,12,5S11.532,5.011,11.282,5.034ZM12,7a7,7,0,1,1-7,7A7.022,7.022,0,0,1,12,7Z"></path></g></svg>`,
  necklaces: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 12c0-3 2-5 4-6l4 2 4-2c2 1 4 3 4 6"/>
            <circle cx="12" cy="16" r="3"/>
        </svg>`,
  earrings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="6" r="2"/>
            <circle cx="12" cy="18" r="4"/>
            <line x1="12" y1="8" x2="12" y2="14"/>
        </svg>`,
  bracelets: `<svg fill="currentColor" height="16" width="16" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path d="M396.74,0c-9.729,0-18.335,4.877-23.503,12.304c-14.19-3.584-28.811-5.406-43.726-5.406 c-28.204,0-55.179,6.389-80.173,18.989c-3.865,1.949-5.419,6.661-3.47,10.525c1.377,2.733,4.138,4.311,7.003,4.311 c1.186,0,2.39-0.27,3.521-0.84c22.787-11.487,47.387-17.311,73.118-17.311c13.181,0,26.105,1.576,38.665,4.641 c-0.021,0.436-0.033,0.875-0.033,1.316c0,15.731,12.828,28.529,28.597,28.529c15.771,0,28.6-12.798,28.6-28.529 C425.34,12.798,412.511,0,396.74,0z M396.74,41.384c-7.126,0-12.923-5.767-12.923-12.855c0-7.089,5.797-12.855,12.923-12.855 c7.127,0,12.926,5.767,12.926,12.855S403.868,41.384,396.74,41.384z"></path> </g> </g> <g> <g> <path d="M511.354,108.341c0-15.731-12.829-28.529-28.6-28.529c-15.77,0-28.598,12.798-28.598,28.529 c0,15.731,12.828,28.529,28.598,28.529c0.637,0,1.27-0.028,1.898-0.07c4.695,15.235,7.074,31.097,7.074,47.412 c0,78.847-56.952,144.679-132.016,158.821c0.433-5.027,0.666-10.109,0.666-15.246c0-9.781-0.807-19.601-2.4-29.186 c-0.709-4.271-4.748-7.16-9.015-6.446c-4.269,0.709-7.156,4.746-6.446,9.014c1.452,8.738,2.188,17.694,2.188,26.618 c0,5.891-0.327,11.707-0.947,17.437c-4.695,0.409-9.444,0.63-14.244,0.63c-89.445,0-162.214-72.512-162.214-161.642 c0-5.871,0.325-11.687,0.938-17.436c4.699-0.41,9.451-0.631,14.255-0.631c68.822,0,130.355,43.454,153.117,108.131 c1.437,4.083,5.91,6.226,9.992,4.791c4.082-1.437,6.229-5.911,4.791-9.994c-24.965-70.939-92.439-118.601-167.9-118.601 c-3.95,0-7.867,0.143-11.754,0.397c7.798-37.326,28.622-70.747,59.742-94.687c3.43-2.639,4.071-7.56,1.433-10.99 c-2.636-3.43-7.557-4.073-10.99-1.434c-35.533,27.334-58.828,65.944-66.506,108.929C69.619,166.145,4.601,239.536,4.601,327.787 c0,18.144,2.678,35.782,7.976,52.711c-7.217,5.184-11.931,13.631-11.931,23.161c0,15.731,12.829,28.529,28.6,28.529 c15.77,0,28.598-12.798,28.598-28.529c0-15.731-12.828-28.529-28.598-28.529c-0.637,0-1.27,0.028-1.898,0.069 c-4.696-15.235-7.075-31.097-7.075-47.412c0-78.841,56.942-144.667,131.995-158.818c-0.426,5.039-0.646,10.123-0.646,15.243 c0,97.772,79.8,177.315,177.888,177.315c3.936,0,7.839-0.142,11.711-0.395c-15.465,73.185-80.758,128.296-158.734,128.296 c-13.181,0-26.105-1.576-38.665-4.642c0.021-0.437,0.033-0.875,0.033-1.316c0-15.731-12.828-28.529-28.597-28.529 c-15.771,0-28.6,12.798-28.6,28.529S99.488,512,115.259,512c9.73,0,18.335-4.877,23.502-12.303 c14.191,3.583,28.811,5.406,43.727,5.406c87.294,0,160.103-63.002,175.069-145.786c84.808-13.447,149.842-86.844,149.842-175.105 c0-18.144-2.678-35.782-7.976-52.711C506.642,126.318,511.354,117.871,511.354,108.341z M29.246,390.804 c7.126-0.001,12.924,5.766,12.924,12.855c0,7.089-5.798,12.855-12.924,12.855c-7.127,0-12.926-5.767-12.926-12.855 C16.319,396.571,22.118,390.804,29.246,390.804z M115.26,496.326c-7.127,0-12.926-5.767-12.926-12.855 c0-7.089,5.799-12.855,12.926-12.855c7.126,0,12.923,5.767,12.923,12.855C128.183,490.56,122.386,496.326,115.26,496.326z M482.754,121.197c-7.126,0-12.924-5.767-12.924-12.855c0-7.089,5.798-12.855,12.924-12.855c7.127,0,12.926,5.767,12.926,12.855 C495.681,115.43,489.882,121.197,482.754,121.197z"></path> </g> </g> <g> <g> <path d="M437.086,399.584c-14.396-3.975-15.297-4.874-19.271-19.268c-1.521-5.525-6.589-9.384-12.323-9.384 c-5.733,0-10.801,3.859-12.321,9.381c-3.974,14.396-4.874,15.296-19.274,19.272c-5.523,1.527-9.381,6.594-9.381,12.321 c0,5.726,3.857,10.794,9.383,12.323c14.398,3.976,15.298,4.877,19.271,19.269c1.522,5.525,6.59,9.384,12.323,9.384 s10.8-3.859,12.321-9.38c3.977-14.399,4.877-15.299,19.276-19.274c5.52-1.527,9.376-6.593,9.376-12.321 C446.466,406.179,442.609,401.111,437.086,399.584z M405.493,430.558c-3.809-10.082-8.569-14.843-18.654-18.651 c10.082-3.809,14.844-8.569,18.653-18.65c3.81,10.081,8.57,14.843,18.651,18.65C414.064,415.716,409.302,420.476,405.493,430.558z "></path> </g> </g> <g> <g> <path d="M145.558,67.902c-14.396-3.975-15.297-4.875-19.271-19.268c-1.521-5.525-6.589-9.384-12.323-9.384 c-5.733,0-10.801,3.859-12.321,9.381C97.67,63.026,96.769,63.927,82.37,67.903c-5.523,1.527-9.381,6.594-9.381,12.323 c0,5.726,3.857,10.793,9.382,12.321c14.398,3.976,15.298,4.877,19.271,19.269c1.522,5.525,6.59,9.384,12.323,9.384 c5.732,0,10.8-3.859,12.321-9.381c3.977-14.399,4.877-15.299,19.276-19.274c5.52-1.527,9.376-6.594,9.376-12.32 C154.938,74.496,151.081,69.428,145.558,67.902z M113.966,98.877c-3.81-10.082-8.569-14.843-18.654-18.651 c10.083-3.81,14.844-8.57,18.652-18.65c3.81,10.081,8.57,14.843,18.651,18.65C122.538,84.034,117.776,88.794,113.966,98.877z"></path> </g> </g> </g></svg>`,
  bespoke: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>`,
};

function productCard(p) {
  const img = p.image || (p.images && p.images[0] && p.images[0].image) || '';
  const isNew = p.isNew;
  const perGram = p.priceType === 'per_gram' ? ' / Գրամ' : '';
  const catDisplay = p.categoryDisplay || '';

  return `
    <div class="group bg-white border border-border/10 hover:shadow-2xl transition-all duration-700 flex flex-col relative">
      <a href="/product/${p.slug}" class="block overflow-hidden relative aspect-[16/13]">
        ${img ? `<img src="${img}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">` : ''}
        ${isNew ? `<span class="absolute top-6 left-6 bg-luxe-black text-luxe-gold text-[8px] uppercase tracking-[0.3em] px-3 py-1.5 z-10">New</span>` : ''}
        <!-- Hover Overlay -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:flex items-center justify-center translate-y-4 group-hover:translate-y-0">
          <div class="w-full px-8">
            <button onclick="addToCart(${p.id}, event)" class="w-full bg-white text-luxe-black hover:bg-luxe-gold hover:text-white py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors">
              Ավելացնել Զամբյուղ
            </button>
          </div>
        </div>
      </a>
      <div class="p-5 flex-1 flex flex-col items-center text-center">
        <span class="text-[8px] text-luxe-gold uppercase tracking-[0.4em] mb-3 font-medium">${catDisplay}</span>
        <h3 class="text-sm font-heading font-normal text-foreground mb-2 uppercase tracking-widest">
          <a href="/product/${p.slug}" class="hover:text-luxe-gold transition-colors">${p.name}</a>
        </h3>
        <div class="mt-auto pt-4 w-full flex items-center justify-between gap-4">
          <span class="text-base md:text-lg font-light text-foreground">${p.price} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-2">AMD${perGram}</span></span>
          <!-- Mobile Add to Cart Icon -->
          <button onclick="addToCart(${p.id}, event)" class="md:hidden w-10 h-10 bg-luxe-black text-luxe-gold flex items-center justify-center rounded-none active:scale-95 transition-transform" aria-label="Add to cart">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function renderCatTabs(cats, currentCat, counts = {}) {
  const wrap = document.getElementById('cat-tabs');
  if (!wrap) return;
  const allCount = counts.all || 0;

  const html = [];
  html.push(
    `<a href="/collection?category=all" class="cat-tab ${currentCat === 'all' || !currentCat ? 'active' : ''}">
      <span>Բոլորը</span>
      <span class="tab-count">${allCount}</span>
    </a>`
  );

  (cats || []).forEach((c) => {
    const slug = c.slug;
    const active = currentCat === slug;
    const icon = CATEGORY_ICONS[slug] || '';
    html.push(
      `<a href="/collection?category=${slug}" class="cat-tab ${active ? 'active' : ''}">
        ${icon}
        <span>${c.name}</span>
        <span class="tab-count">${counts[slug] || 0}</span>
      </a>`
    );
  });

  wrap.innerHTML = html.join('');
}

function renderPagination(pagination, currentPage, currentCat, q, sort) {
  const pg = document.getElementById('pagination');
  if (!pg) return;
  const totalPages = (pagination && pagination.totalPages) || 1;
  if (totalPages <= 1) {
    pg.innerHTML = '';
    return;
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const baseUrl = (params) => {
    const u = new URLSearchParams();
    const cat = currentCat && currentCat !== 'all' ? currentCat : params.cat;
    if (cat) u.set('category', cat);
    if (q) u.set('search', q);
    if (sort) u.set('sort', sort);
    if (params.page) u.set('page', String(params.page));
    return `/collection?${u}`;
  };

  let html = '';
  html += `<a href="${baseUrl({ page: hasPrev ? currentPage - 1 : 1, cat: currentCat })}" class="page-btn nav-btn ${!hasPrev ? 'disabled' : ''}">Նախորդ</a>`;

  for (let i = 1; i <= totalPages; i++) {
    const active = i === currentPage;
    html += `<a href="${baseUrl({ page: i, cat: currentCat })}" class="page-btn ${active ? 'active' : ''}">${i}</a>`;
  }

  html += `<a href="${baseUrl({ page: hasNext ? currentPage + 1 : totalPages, cat: currentCat })}" class="page-btn nav-btn ${!hasNext ? 'disabled' : ''}">Հաջորդ</a>`;
  pg.innerHTML = html;
}

async function init() {
  const params = new URLSearchParams(location.search);
  const cat = params.get('category') || 'all';
  const page = parseInt(params.get('page') || '1', 10);
  const q = params.get('search') || params.get('q') || '';
  const sort = params.get('sort') || '';

  const qs = new URLSearchParams({ page: String(page) });
  if (cat && cat !== 'all') qs.set('category', cat);
  if (q) qs.set('search', q);
  if (sort) qs.set('sort', sort);

  try {
    const [catsRes, data] = await Promise.all([get('/categories'), get(`/products?${qs}`)]);
    const grid = document.getElementById('grid');
    const items = data.items || [];
    if (grid) {
      grid.innerHTML = items.length
        ? items.map(productCard).join('')
        : `<div class="col-span-full py-24 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="1" class="mx-auto mb-6 opacity-30">
                <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
              </svg>
              <h3 class="text-xl font-heading uppercase tracking-widest text-luxe-black mb-2">Ոչինչ չի գտնվել</h3>
              <p class="text-white/40 text-sm">Փորձեք փոխել ֆիլտրերը կամ որոնման բառը:</p>
            </div>`;
    }

    // Setup counts
    const cats = catsRes.categories || [];
    const counts = { all: data.pagination ? data.pagination.totalResults : items.length };
    cats.forEach((c) => {
      counts[c.slug] = c.count || 0;
    });

    renderCatTabs(cats, cat, counts);
    renderPagination(data.pagination, page, cat, q, sort);

    const searchInput = document.getElementById('search-input');
    const categoryHidden = document.getElementById('category-hidden');
    if (searchInput) searchInput.value = q || '';
    if (categoryHidden) categoryHidden.value = cat && cat !== 'all' ? cat : '';

    const searchForm = document.getElementById('search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchVal = document.getElementById('search-input')?.value.trim() || '';
        const catVal = document.getElementById('category-hidden')?.value || 'all';
        const u = new URLSearchParams();
        if (catVal && catVal !== 'all') u.set('category', catVal);
        if (searchVal) u.set('search', searchVal);
        u.set('page', '1');
        location.href = `/collection?${u}`;
      });
    }
    const total = document.getElementById('result-count');
    if (total && data.pagination) total.textContent = data.pagination.totalResults || 0;

    if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
    if (typeof window.__observeScroll === 'function') window.__observeScroll();
  } catch (e) {
    console.error('collection init failed', e);
  }
}

init();
