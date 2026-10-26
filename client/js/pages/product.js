import { get, post } from '/js/api.js';
import { openTryOn } from '/js/tryon.js';
import { isTryOnCategory } from '/js/ar/categories.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugFromUrl() {
  const path = location.pathname.replace(/\/+$/, '');
  const m = path.match(/\/product\/(.+)$/);
  if (m) return decodeURIComponent(m[1]);
  return new URLSearchParams(location.search).get('slug') || '';
}

window.switchImage = function (index, thumb) {
  const gallery = document.getElementById('product-gallery');
  const slides = gallery.querySelectorAll('.gallery-slide');

  if (slides[index]) {
    gallery.scrollTo({
      left: slides[index].offsetLeft,
      behavior: 'smooth',
    });
  }

  document.querySelectorAll('.gallery-thumb').forEach((t) => t.classList.remove('active'));
  thumb.classList.add('active');
};

window.scrollGallery = function (direction) {
  const gallery = document.getElementById('product-gallery');
  const slideWidth = gallery.offsetWidth;
  const currentScroll = gallery.scrollLeft;
  const maxScroll = gallery.scrollWidth - slideWidth;

  let targetScroll = currentScroll + direction * slideWidth;

  if (targetScroll > maxScroll + 10) {
    targetScroll = 0;
  } else if (targetScroll < -10) {
    targetScroll = maxScroll;
  }

  gallery.scrollTo({
    left: targetScroll,
    behavior: 'smooth',
  });
};

window.changeQty = function (delta) {
  const input = document.getElementById('qty-input');
  input.value = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
  if (window.updateLivePrice) window.updateLivePrice();
};

function setupSwipe() {
  const gallery = document.getElementById('product-gallery');
  if (!gallery) return;
  let startX = 0, startY = 0, isDragging = false;

  gallery.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  gallery.addEventListener('touchend', function (e) {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = startX - endX;
    const diffY = startY - endY;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      window.scrollGallery(diffX > 0 ? 1 : -1);
    }
  }, { passive: true });
}

function buildBody(action) {
  const body = { quantity: parseInt(document.getElementById('qty-input').value, 10) || 1 };
  const variant = document.querySelector('.variant-radio:checked');
  if (variant) body.variant = variant.value;
  const weight = document.getElementById('weight');
  if (weight && weight.value) body.weight = weight.value;
  const custom = document.getElementById('custom_text');
  if (custom && custom.value) body.custom_text = custom.value;
  if (action) body.action = action;
  return body;
}

async function init() {
  const slug = slugFromUrl();
  if (!slug) {
    location.href = '/collection';
    return;
  }

  let item, related = [];
  try {
    const res = await get('/products/' + slug);
    item = res.item;
    related = res.related || [];
  } catch (e) {
    if (e.status === 404) {
      location.href = '/404';
      return;
    }
    console.error('product load failed', e);
    const loading = document.getElementById('product-loading');
    const section = document.getElementById('product-content');
    if (loading) {
      loading.innerHTML = '<p role="alert" class="text-sm text-foreground/60">Ապրանքը չհաջողվեց բեռնել։ Խնդրում ենք կրկին փորձել։</p>';
      loading.setAttribute('aria-label', 'Ապրանքը չի բեռնվել');
    }
    if (section) section.setAttribute('aria-busy', 'false');
    return;
  }

  const p = item;
  document.title = `Luxe Jewelry — ${p.name}`;

  document.getElementById('crumb-name').textContent = p.name;
  document.getElementById('cat-label').textContent = p.categoryDisplay || '';
  document.getElementById('item-name').textContent = p.name;

  const perGram = p.priceType === 'per_gram' ? ' / Գրամ' : '';
  document.getElementById('price-block').innerHTML =
    `${p.price} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-2">AMD${perGram}</span>`;

  document.getElementById('description').innerHTML = esc(p.description || '');

  if (p.isNew) document.getElementById('new-badge').classList.remove('hidden');

  // Gallery (Django renders the main image + extra images 3 times for looping)
  const gallery = document.getElementById('product-gallery');
  let slidesHtml = '';
  for (let r = 0; r < 3; r++) {
    if (p.image) {
      slidesHtml += `<div class="gallery-slide snap-center shrink-0 w-full h-full" data-index="0">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" class="w-full h-full object-cover">
      </div>`;
    }
    (p.images || []).forEach((img, i) => {
      slidesHtml += `<div class="gallery-slide snap-center shrink-0 w-full h-full" data-index="${i + 1}">
        <img src="${esc(img.image)}" alt="${esc(p.name)}" class="w-full h-full object-cover">
      </div>`;
    });
  }
  gallery.innerHTML = slidesHtml;

  if ((p.images || []).length) {
    document.getElementById('gal-prev').classList.remove('hidden');
    document.getElementById('gal-next').classList.remove('hidden');

    const row = document.getElementById('thumbs-row');
    row.classList.remove('hidden');
    let thumbs = `<div onclick="switchImage(0, this)" class="gallery-thumb active aspect-square bg-section-alt overflow-hidden">
      <img src="${esc(p.image || '')}" alt="" class="w-full h-full object-cover">
    </div>`;
    (p.images || []).forEach((img, i) => {
      thumbs += `<div onclick="switchImage(${i + 1}, this)" class="gallery-thumb aspect-square bg-section-alt overflow-hidden">
        <img src="${esc(img.image)}" alt="" class="w-full h-full object-cover">
      </div>`;
    });
    row.innerHTML = thumbs;
  }

  // Specifications
  let specs = `<div class="spec-item">
      <span class="spec-label">Մետաղ</span>
      <span class="spec-value">${esc(p.materialKarat || '14K Ոսկի')}</span>
    </div>`;
  if (p.gemstone) {
    specs += `<div class="spec-item">
      <span class="spec-label">Քար</span>
      <span class="spec-value">${esc(p.gemstone)}</span>
    </div>`;
  }
  specs += `<div class="spec-item">
      <span class="spec-label">Չափսերը</span>
      <span class="spec-value">${esc(p.dimensions || 'Ստանդարտ')}</span>
    </div>`;
  document.getElementById('specs').innerHTML = specs;

  // Variants / per-gram weight
  const variants = (p.variants || []).filter((v) => v.isAvailable !== false);
  const vblock = document.getElementById('variant-block');
  if (variants.length) {
    vblock.classList.remove('hidden');
    vblock.innerHTML = `<div class="space-y-4">
      <label class="spec-label">Տարբերակներ</label>
      <div class="flex overflow-x-auto gap-3 pb-4 snap-x hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
        ${variants.map((v, i) => `
        <label class="cursor-pointer snap-start shrink-0">
          <input type="radio" name="variant" value="${v.id}" data-price="${v.price}" data-weight="${v.weight}" class="hidden variant-radio"${i === 0 ? ' checked' : ''}>
          <span class="variant-btn flex flex-col items-center px-5 py-3 border border-border/10 transition-all text-center min-w-[5rem]">
            ${v.size
              ? `<span class="text-xs font-medium text-luxe-black">${esc(v.size)}</span>
                 <span class="text-[9px] text-luxe-gold/40 mt-0.5">${v.weight}g</span>`
              : `<span class="text-xs font-medium text-luxe-black">${v.weight}g</span>`}
            <span class="text-[9px] text-luxe-black/40 mt-1">${v.price} AMD</span>
          </span>
        </label>`).join('')}
      </div>
    </div>`;
  } else if (p.priceType === 'per_gram') {
    vblock.classList.remove('hidden');
    vblock.innerHTML = `<div class="space-y-4">
      <label for="weight" class="spec-label">Քաշը (գրամ)</label>
      <input type="number" name="weight" id="weight" step="0.1" min="0.1" placeholder="Օրինակ՝ 5.5" required
        class="w-full bg-transparent border-b border-border/20 py-4 text-sm font-light focus:border-luxe-gold outline-none transition-all">
    </div>`;
  }

  // Live price
  const basePrice = parseFloat(p.price);
  const priceType = p.priceType;
  const qtyInput = document.getElementById('qty-input');
  const weightInput = document.getElementById('weight');
  const livePriceContainer = document.getElementById('live-price-container');
  const livePriceValue = document.getElementById('live-price-value');
  const variantRadios = document.querySelectorAll('.variant-radio');

  window.updateLivePrice = function () {
    let qty = parseInt(qtyInput.value, 10) || 1;
    let finalPrice = basePrice * qty;

    if (variantRadios.length > 0) {
      const selected = document.querySelector('.variant-radio:checked');
      if (selected) {
        finalPrice = parseFloat(selected.dataset.price) * qty;
      }
    } else if (priceType === 'per_gram') {
      if (!weightInput || !weightInput.value) {
        livePriceContainer.classList.add('hidden');
        return;
      }
      const weight = parseFloat(weightInput.value);
      finalPrice = basePrice * weight * qty;
    }

    livePriceValue.textContent = Math.round(finalPrice).toLocaleString('en-US');
    livePriceContainer.classList.remove('hidden');
  };

  variantRadios.forEach((radio) => radio.addEventListener('change', window.updateLivePrice));
  if (weightInput) weightInput.addEventListener('input', window.updateLivePrice);
  if (qtyInput) qtyInput.addEventListener('input', window.updateLivePrice);
  window.updateLivePrice();

  // Add to cart
  const form = document.getElementById('order-form');
  const btn = document.getElementById('add-to-cart-btn');
  const btnText = btn.querySelector('.btn-text');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const originalText = btnText.textContent;

    btn.classList.add('pointer-events-none', 'opacity-70');
    btnText.innerHTML = '<span class="animate-pulse">Ավելացվում է...</span>';

    try {
      const d = await post('/cart/add/' + p.id, buildBody());
      if (d.success) {
        const c = d.cart_count || 0;
        document.querySelectorAll('#cart-count,.mobile-cart-count').forEach((b) => {
          b.textContent = c;
          b.classList.add('scale-125');
          setTimeout(() => b.classList.remove('scale-125'), 500);
        });
        if (typeof window.showToast === 'function') window.showToast(d.item_name, d.item_image);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      btn.classList.remove('pointer-events-none', 'opacity-70');
      btnText.textContent = originalText;
    }
  };

  window.buyNow = async function () {
    try {
      const d = await post('/cart/add/' + p.id, buildBody('order_now'));
      if (d.success) location.href = '/checkout';
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Image-upload virtual try-on for wearable categories.
  const tryonBtn = document.getElementById('tryon-btn');
  if (tryonBtn && isTryOnCategory(p.category)) {
    tryonBtn.classList.remove('hidden');
    tryonBtn.addEventListener('click', async () => {
      tryonBtn.disabled = true;
      try {
        const { portraitUrl } = await get('/account/portrait');
        openTryOn({
          productCategory: p.category,
          productImageUrl: p.tryOnAsset,
          productModelUrl: p.model3d,
          productMetadataUrl: p.tryOnMetadataUrl,
          productName: p.name,
          portraitUrl,
        });
      } catch (error) {
        if (error.status !== 401) console.error('Could not load saved portrait for product try-on', error);
        openTryOn({
          productCategory: p.category,
          productImageUrl: p.tryOnAsset,
          productModelUrl: p.model3d,
          productMetadataUrl: p.tryOnMetadataUrl,
          productName: p.name,
        });
      } finally {
        tryonBtn.disabled = false;
      }
    });
  }

  setupSwipe();

  // Related items
  if (related.length) {
    document.getElementById('related-section').classList.remove('hidden');
    document.getElementById('related-grid').innerHTML = related.slice(0, 4).map((rel) => {
      const relPerGram = rel.priceType === 'per_gram' ? ' / Գրամ' : '';
      return `
      <div class="group bg-white border border-border/10 hover:shadow-2xl transition-all duration-700 flex flex-col relative">
        <a href="/product/${esc(rel.slug)}" class="block overflow-hidden relative aspect-square">
          ${rel.image ? `<img src="${esc(rel.image)}" alt="${esc(rel.name)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">` : ''}
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:flex items-center justify-center translate-y-4 group-hover:translate-y-0">
            <div class="w-full px-8">
              <button onclick="addToCart(${rel.id}, event)" class="w-full bg-white text-luxe-black hover:bg-luxe-gold hover:text-white py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-colors">
                Ավելացնել Զամբյուղ
              </button>
            </div>
          </div>
        </a>
        <div class="p-5 flex-1 flex flex-col items-center text-center">
          <h3 class="text-xs font-heading font-normal text-foreground mb-2 uppercase tracking-widest">${esc(rel.name)}</h3>
          <div class="mt-auto pt-4 w-full flex items-center justify-between gap-4">
            <span class="text-sm font-light text-foreground">${rel.price} <span class="text-[8px] uppercase tracking-widest text-luxe-black/30 ml-2">AMD${relPerGram}</span></span>
            <button onclick="addToCart(${rel.id}, event)" class="md:hidden w-8 h-8 bg-luxe-black text-luxe-gold flex items-center justify-center rounded-none active:scale-95 transition-transform" aria-label="Add to cart">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('product-loading')?.setAttribute('hidden', '');
  document.getElementById('order-form')?.removeAttribute('hidden');
  document.getElementById('product-content')?.setAttribute('aria-busy', 'false');

  if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
  if (typeof window.__observeScroll === 'function') window.__observeScroll();
}
init();
