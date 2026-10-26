import { get, post } from '/js/api.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

let baseTotal = 0;

function updateTotalDisplay(deliveryPrice) {
  const gt = document.getElementById('grand-total');
  if (!gt) return;
  const newTotal = baseTotal + (Number(deliveryPrice) || 0);
  gt.innerHTML = `${fmt(newTotal)} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-1">AMD</span>`;
}

function summaryRow(entry) {
  const thumb = entry.image_url
    ? `<div class="w-12 h-12 bg-white border border-border/10 shrink-0 overflow-hidden">
            <img src="${esc(entry.image_url)}" alt="${esc(entry.name)}" class="w-full h-full object-cover">
          </div>`
    : '';
  return `
    <div class="flex items-center gap-4 py-1">
      ${thumb}
      <div class="flex-1 flex justify-between items-center text-[10px] uppercase tracking-widest">
        <span class="text-luxe-black/50 line-clamp-1 mr-4">${esc(entry.name)} × ${entry.quantity}</span>
        <span class="text-luxe-black font-medium">${fmt(entry.subtotal)} AMD</span>
      </div>
    </div>`;
}

function setupDeliveryToggle() {
  document.querySelectorAll('input[name="delivery_type"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const addrSection = document.getElementById('addressSection');
      const pickupSection = document.getElementById('pickupSection');
      const addrInput = document.getElementById('address');
      const deliveryTag = document.getElementById('deliveryTag');

      if (e.target.value === 'pickup') {
        addrSection.classList.add('hidden');
        pickupSection.classList.remove('hidden');
        addrInput.required = false;
        addrInput.value = '';
        deliveryTag.classList.add('hidden');
        deliveryTag.classList.remove('flex');
        document.getElementById('delivery_price').value = '0';
        document.getElementById('lat').value = '';
        document.getElementById('lng').value = '';
        document.getElementById('city').value = '';
        updateTotalDisplay(0);
      } else {
        addrSection.classList.remove('hidden');
        pickupSection.classList.add('hidden');
        addrInput.required = true;
      }
    });
  });
}

function setupTimePicker() {
  const ITEM_H = 40;
  const now = new Date();
  const initHour = now.getHours();
  const initMin = (Math.round(now.getMinutes() / 5) * 5) % 60;
  let userHasTouched = false;

  function buildDrum(el, items, initIndex) {
    const track = document.createElement('div');
    track.style.cssText = `
      display:flex;flex-direction:column;align-items:center;
      transition:transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94);
      will-change:transform;`;

    [...items, ...items, ...items].forEach((val) => {
      const row = document.createElement('div');
      row.className = 'drum-row';
      row.style.cssText = `
        height:${ITEM_H}px;line-height:${ITEM_H}px;
        text-align:center;font-family:inherit;
        font-size:1.1rem;font-weight:300;color:#1a1a2e;
        flex-shrink:0;width:100%; transition: all 0.2s;`;
      row.textContent = String(val).padStart(2, '0');
      track.appendChild(row);
    });

    el.appendChild(track);

    const len = items.length;
    let currentIdx = initIndex;
    let startY = 0;
    let startOffset = 0;
    let isDragging = false;

    const containerH = 120;
    const centerOff = containerH / 2 - ITEM_H / 2;

    function getOffset(idx) {
      return -(idx + len) * ITEM_H + centerOff;
    }

    function setIndex(idx, animate) {
      currentIdx = ((idx % len) + len) % len;
      const off = getOffset(currentIdx);
      track.style.transition = animate
        ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
        : 'none';
      track.style.transform = `translateY(${off}px)`;

      track.querySelectorAll('.drum-row').forEach((row, i) => {
        const isCenter = i % len === currentIdx;
        row.style.color = isCenter ? '#D4AF37' : 'rgba(26,26,46,0.6)';
        row.style.fontSize = isCenter ? '1.25rem' : '1rem';
        row.style.fontWeight = isCenter ? '400' : '300';
      });

      updateHidden();
    }

    setIndex(initIndex, false);

    function updateHidden() {
      if (!userHasTouched) return;
      const h = document.getElementById('drumHour');
      const m = document.getElementById('drumMinute');
      const hIdx = h._drum ? h._drum.getIdx() : initHour;
      const mIdx = m._drum ? m._drum.getIdx() : initMin;
      const hVal = String(hIdx).padStart(2, '0');
      const mVal = String(Math.round(mIdx / 5) * 5 % 60).padStart(2, '0');
      document.getElementById('delivery_time').value = `${hVal}:${mVal}`;
    }

    function onStart(clientY) {
      userHasTouched = true;
      isDragging = true;
      startY = clientY;
      startOffset = getOffset(currentIdx);
      track.style.transition = 'none';
      el.style.cursor = 'grabbing';
    }

    function onMove(clientY) {
      if (!isDragging) return;
      const dy = clientY - startY;
      const raw = startOffset + dy;
      track.style.transform = `translateY(${raw}px)`;
    }

    function onEnd(clientY) {
      if (!isDragging) return;
      isDragging = false;
      el.style.cursor = 'grab';
      const dy = clientY - startY;
      const steps = Math.round(-dy / ITEM_H);
      setIndex(currentIdx + steps, true);
    }

    el.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    window.addEventListener('mousemove', (e) => onMove(e.clientY));
    window.addEventListener('mouseup', (e) => onEnd(e.clientY));
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e.touches[0].clientY); }, { passive: false });
    el.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e.touches[0].clientY); }, { passive: false });
    el.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      setIndex(currentIdx + Math.sign(e.deltaY), true);
    }, { passive: false });

    el._drum = { getIdx: () => currentIdx };
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  buildDrum(document.getElementById('drumHour'), hours, initHour);
  buildDrum(document.getElementById('drumMinute'), minutes, Math.floor(initMin / 5));
}

function setupAddressAutocomplete() {
  const addressInput = document.getElementById('address');
  const cityDropdown = document.getElementById('cityDropdown');
  const latInput = document.getElementById('lat');
  const lngInput = document.getElementById('lng');
  const cityInput = document.getElementById('city');
  const deliveryPriceInput = document.getElementById('delivery_price');
  const deliveryTag = document.getElementById('deliveryTag');
  const deliveryTagText = document.getElementById('deliveryTagText');
  const deliveryClearBtn = document.getElementById('deliveryClearBtn');

  let debounceTimer;

  addressInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const query = this.value.trim();
    if (query.length < 3) {
      cityDropdown.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(() => {
      fetch(`https://map.am/api/search?q=${encodeURIComponent(query)}&limit=5`)
        .then((res) => res.json())
        .then((data) => {
          cityDropdown.innerHTML = '';
          if (data && data.length > 0) {
            data.forEach((item) => {
              const div = document.createElement('div');
              div.className = 'px-4 py-3 text-xs hover:bg-luxe-gold/5 cursor-pointer border-b border-border/5 last:border-0 transition-colors';
              div.textContent = item.display_name;
              div.addEventListener('click', () => selectAddress(item));
              cityDropdown.appendChild(div);
            });
            cityDropdown.classList.remove('hidden');
          } else {
            cityDropdown.classList.add('hidden');
          }
        })
        .catch((err) => console.error('Map API error:', err));
    }, 300);
  });

  function selectAddress(item) {
    addressInput.value = item.display_name;
    latInput.value = item.lat;
    lngInput.value = item.lon;
    cityInput.value = (item.address && (item.address.city || item.address.town || item.address.village)) || 'Yerevan';

    const isYerevan = item.display_name.toLowerCase().includes('yerevan') || item.display_name.toLowerCase().includes('երևան');
    const price = isYerevan ? 1000 : 2000;

    deliveryPriceInput.value = price;
    deliveryTagText.textContent = `${price} AMD — Առաքում`;
    deliveryTag.classList.remove('hidden');
    deliveryTag.classList.add('flex');
    cityDropdown.classList.add('hidden');

    updateTotalDisplay(price);
  }

  deliveryClearBtn.addEventListener('click', () => {
    addressInput.value = '';
    latInput.value = '';
    lngInput.value = '';
    cityInput.value = '';
    deliveryPriceInput.value = '0';
    deliveryTag.classList.add('hidden');
    deliveryTag.classList.remove('flex');
    updateTotalDisplay(0);
  });

  document.addEventListener('click', (e) => {
    if (!addressInput.contains(e.target) && !cityDropdown.contains(e.target)) {
      cityDropdown.classList.add('hidden');
    }
  });
}

function applyPrefill(prefill) {
  if (!prefill || !Object.keys(prefill).length) return;
  const form = document.getElementById('checkoutForm');
  ['full_name', 'phone', 'city', 'address'].forEach((k) => {
    if (prefill[k]) {
      const el = form.elements[k];
      if (el) el.value = prefill[k];
    }
  });
  if (prefill.order_note) document.getElementById('notes').value = prefill.order_note;

  const type = prefill.delivery_type || 'delivery';
  const radio = form.querySelector(`input[name="delivery_type"][value="${type}"]`);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  }
}

// Server sends Django-style paths (/payment/order-success.html?pm=...); map to client routes.
function normalise(redirect) {
  if (!redirect) return '/order-success';
  const m = redirect.match(/\?(.*)$/);
  const q = m ? '?' + m[1] : '';
  if (redirect.includes('order-success')) {
    const params = new URLSearchParams(q);
    const orderId = params.get('id');
    if (params.get('pm') === 'cash' && /^\d+$/.test(orderId || '')) {
      return `/account/orders/${orderId}`;
    }
    return '/order-success' + q;
  }
  if (redirect.includes('idram_success')) return '/idram-success' + q;
  if (redirect.includes('idram_fail')) return '/idram-fail' + q;
  if (redirect.includes('card_success')) return '/card-success' + q;
  if (redirect.includes('card_fail')) return '/card-fail' + q;
  return redirect;
}

async function initiate(method, initiatePath) {
  const res = await fetch('/api' + initiatePath, { method: 'POST', credentials: 'include' });
  const data = await res.json();

  if (data.paymentUrl && data.params) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.paymentUrl;
    Object.entries(data.params).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return;
  }

  if (data.formUrl) { location.href = data.formUrl; return; }
  if (data.redirect) location.href = normalise(data.redirect);
  else if (data.error) msg(data.error, true);
}

function msg(text, isError) {
  let el = document.getElementById('msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'msg';
    el.className = 'mb-6 p-4 text-[10px] uppercase tracking-widest';
    document.getElementById('submitOrder').before(el);
  }
  el.textContent = text;
  el.className = 'mb-6 p-4 text-[10px] uppercase tracking-widest ' + (isError ? 'bg-red-600 text-white' : 'bg-luxe-black text-luxe-gold');
}

async function submitOrder() {
  const form = document.getElementById('checkoutForm');
  if (!form.reportValidity()) return;

  const btn = document.getElementById('submitOrder');
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '...'; }

  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const data = await post('/checkout', body);

    if (data.payment && data.payment.initiate) {
      await initiate(data.payment.method, data.payment.initiate);
      return;
    }
    location.href = normalise(data.redirect);
  } catch (err) {
    const errorMessage = err.data?.error || err.data?.errors?.full_name || 'Սխալ';
    msg(errorMessage, true);
    if (err.data?.loginRequired) {
      const link = document.createElement('a');
      link.href = `/login?next=${encodeURIComponent('/checkout')}`;
      link.textContent = ' Մուտք գործել';
      link.className = 'ml-2 underline';
      document.getElementById('msg').appendChild(link);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
  }
}

async function init() {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  // Contact address for the pickup box
  try {
    const cfg = await get('/config');
    const addr = cfg.contact && (cfg.contact.addressFull || cfg.contact.address);
    if (addr) document.getElementById('pickup-address').textContent = addr;
  } catch (e) { /* optional */ }

  // Cart context (400 = empty cart → back to /cart, like Django redirect)
  try {
    const orderId = new URLSearchParams(location.search).get('order_id');
    const ctx = await get('/checkout' + (orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''));
    baseTotal = Number(ctx.total) || 0;
    document.getElementById('summary-items').innerHTML = (ctx.cart_items || []).map(summaryRow).join('');
    updateTotalDisplay(0);
    applyPrefill(ctx.prefill);
  } catch (err) {
    if (err.status === 400) { location.href = '/cart'; return; }
    msg('Զամբյուղը դատարկ է', true);
    const btn = document.getElementById('submitOrder');
    if (btn) btn.disabled = true;
    return;
  }

  setupDeliveryToggle();
  setupTimePicker();
  setupAddressAutocomplete();

  form.onsubmit = (e) => { e.preventDefault(); submitOrder(); };
  document.getElementById('submitOrder').onclick = submitOrder;
}
init();
