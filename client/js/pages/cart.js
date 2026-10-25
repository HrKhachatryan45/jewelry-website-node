import { get, post } from '/js/api.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function row(entry) {
  const key = esc(entry.item_key);
  const slug = esc(entry.slug || '');
  const href = `/product/${slug}`;
  const image = entry.image
    ? `<a href="${href}" class="block w-full h-full"><img src="${esc(entry.image)}" alt="${esc(entry.name)}" class="w-full h-full object-cover hover:scale-110 transition-transform duration-700"></a>`
    : '';
  const sizeBlock = entry.size
    ? `<div class="space-y-1">
            <span class="text-[8px] uppercase tracking-widest text-luxe-black/30">Չափս</span>
            <p class="text-[11px] font-medium text-luxe-black">${esc(entry.size)}</p>
          </div>`
    : '';
  const textBlock = entry.custom_text
    ? `<div class="col-span-2 space-y-1">
            <span class="text-[8px] uppercase tracking-widest text-luxe-black/30">Փորագրություն</span>
            <p class="text-[11px] font-medium text-luxe-black italic">"${esc(entry.custom_text)}"</p>
          </div>`
    : '';

  return `
    <div class="cart-row flex flex-col sm:flex-row gap-8 pb-8 border-b border-border/10" data-key="${key}" data-unit-price="${Number(entry.price)}">
      <div class="w-full sm:w-40 aspect-square bg-section-alt overflow-hidden">${image}</div>
      <div class="flex-1 flex flex-col">
        <div class="flex justify-between items-start mb-4">
          <div>
            <span class="text-[8px] text-luxe-gold uppercase tracking-[0.4em] mb-1 block">${esc(entry.category_display || 'Jewelry')}</span>
            <a href="${href}" class="hover:text-luxe-gold transition-colors">
              <h3 class="text-xl font-heading font-normal text-luxe-black uppercase tracking-widest">${esc(entry.name)}</h3>
            </a>
          </div>
          <button type="button" data-remove="${key}" class="text-luxe-black/20 hover:text-red-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-8">
          <div class="space-y-1">
            <span class="text-[8px] uppercase tracking-widest text-luxe-black/30">Մետաղ</span>
            <p class="text-[11px] font-medium text-luxe-black">${esc(entry.material || '14K Ոսկի')}</p>
          </div>
          ${sizeBlock}
          ${textBlock}
        </div>

        <div class="mt-auto flex items-center justify-between">
          <div class="flex items-center border border-border/10">
            <button type="button" data-dec="${key}" class="w-10 h-10 flex items-center justify-center hover:text-luxe-gold transition-colors">-</button>
            <span id="qty-${key}" class="w-10 text-center text-xs font-medium">${entry.quantity}</span>
            <button type="button" data-inc="${key}" class="w-10 h-10 flex items-center justify-center hover:text-luxe-gold transition-colors">+</button>
          </div>
          <div class="text-lg font-light text-luxe-black" id="subtotal-${key}">
            ${fmt(entry.subtotal)} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-1">AMD</span>
          </div>
        </div>
      </div>
    </div>`;
}

function summaryLine(entry) {
  const key = esc(entry.item_key);
  return `
    <div class="flex justify-between items-center text-[10px] uppercase tracking-widest" id="summary-${key}">
      <span class="text-luxe-black/50 line-clamp-1 mr-4">${esc(entry.name)} × ${entry.quantity}</span>
      <span class="text-luxe-black" id="summary-price-${key}">${fmt(entry.subtotal)} AMD</span>
    </div>`;
}

function recalcTotal() {
  let total = 0;
  document.querySelectorAll('.cart-row').forEach((rowEl) => {
    const key = rowEl.dataset.key;
    const qty = parseInt(document.getElementById(`qty-${key}`).textContent, 10);
    total += qty * parseFloat(rowEl.dataset.unitPrice);
  });
  const gt = document.getElementById('grand-total');
  if (gt) gt.innerHTML = `${fmt(total)} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-1">AMD</span>`;
}

let entries = [];
let isBuyNow = false;

function render() {
  const grid = document.getElementById('cart-grid');
  const empty = document.getElementById('cart-empty');
  const clearBtn = document.getElementById('clear-cart');
  const checkoutLink = document.getElementById('checkout-link');

  if (!entries.length) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');
  if (clearBtn) clearBtn.classList.toggle('hidden', isBuyNow);

  document.getElementById('cart-items').innerHTML =
    entries.map(row).join('') +
    `<div class="pt-8">
      <a href="/collection" class="text-[10px] uppercase tracking-[0.2em] text-luxe-black/40 hover:text-luxe-gold transition-colors flex items-center gap-2 group">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="group-hover:-translate-x-1 transition-transform"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Շարունակել Գնումները
      </a>
    </div>`;

  document.getElementById('summary-lines').innerHTML = entries.map(summaryLine).join('');
  recalcTotal();

  if (checkoutLink) checkoutLink.setAttribute('href', isBuyNow ? '/checkout?buy_now=1' : '/checkout');

  const count = entries.reduce((s, e) => s + e.quantity, 0);
  document.querySelectorAll('#cart-count,.mobile-cart-count').forEach((b) => { b.textContent = count; });
}

async function load() {
  const buyNowParam = new URLSearchParams(location.search).get('buy_now') === '1';
  let data = await get('/cart');
  if (!buyNowParam && data.is_buy_now) {
    await post('/cart/buy-now-clear');
    data = await get('/cart');
  }
  entries = data.cart_items || [];
  isBuyNow = !!data.is_buy_now;
  render();
}

function updateQty(item_key, delta) {
  const entry = entries.find((e) => e.item_key === item_key);
  const qtyEl = document.getElementById(`qty-${item_key}`);
  const rowEl = document.querySelector(`.cart-row[data-key="${item_key}"]`);
  if (!entry || !qtyEl || !rowEl) return;

  let qty = parseInt(qtyEl.textContent, 10) + delta;
  if (qty < 1) return;
  qtyEl.textContent = qty;
  entry.quantity = qty;

  const subtotal = parseFloat(rowEl.dataset.unitPrice) * qty;
  document.getElementById(`subtotal-${item_key}`).innerHTML =
    `${fmt(subtotal)} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-1">AMD</span>`;

  const summaryPrice = document.getElementById(`summary-price-${item_key}`);
  if (summaryPrice) summaryPrice.textContent = `${fmt(subtotal)} AMD`;
  const summaryName = document.getElementById(`summary-${item_key}`)?.querySelector('span');
  if (summaryName) summaryName.textContent = `${entry.name} × ${qty}`;

  recalcTotal();
  const count = entries.reduce((s, e) => s + e.quantity, 0);
  document.querySelectorAll('#cart-count,.mobile-cart-count').forEach((b) => { b.textContent = count; });

  post('/cart/update', { item_key, quantity: qty }).catch((e) => console.error(e));
}

function removeItem(item_key) {
  const rowEl = document.querySelector(`.cart-row[data-key="${item_key}"]`);
  rowEl?.remove();
  document.getElementById(`summary-${item_key}`)?.remove();
  entries = entries.filter((e) => e.item_key !== item_key);
  recalcTotal();

  if (!document.querySelectorAll('.cart-row').length) {
    render();
    location.reload();
    return;
  }
  const count = entries.reduce((s, e) => s + e.quantity, 0);
  document.querySelectorAll('#cart-count,.mobile-cart-count').forEach((b) => { b.textContent = count; });

  post('/cart/remove', { item_key }).catch((e) => console.error(e));
}

async function init() {
  await load();

  document.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const del = e.target.closest('[data-remove]');
    if (inc) updateQty(inc.dataset.inc, 1);
    else if (dec) updateQty(dec.dataset.dec, -1);
    else if (del) removeItem(del.dataset.remove);
  });

  const clearBtn = document.getElementById('clear-cart');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      await post('/cart/clear', {});
      location.reload();
    };
  }
}
init();
