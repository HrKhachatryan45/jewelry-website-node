import { get } from '/js/api.js';

function categoryCard(c) {
  const n = (c.names && c.names.hy) || c.name;
  const img = c.image
    ? `<img src="${c.image}" alt="${n}" loading="lazy" onerror="this.onerror=null;this.src='/uploads/hero/default_hero.png'" class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700">`
    : '';
  return `
    <a href="/collection?category=${c.slug}" class="group relative overflow-hidden aspect-[4/5] bg-luxe-black flex items-end justify-center pb-6 block scroll-fade">
      ${img}
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"></div>
      <div class="relative text-center">
        <p class="text-primary-foreground text-sm uppercase tracking-widest font-medium">${n}</p>
        <p class="text-luxe-gold text-xs mt-1">${c.count} ապրանք</p>
      </div>
    </a>`;
}

function featuredSlide(p) {
  const img = p.image || (p.images && p.images[0] && p.images[0].image) || '';
  const perGram = p.priceType === 'per_gram' ? ' / Գրամ' : '';
  return `
    <div class="swiper-slide !h-auto w-[82vw] sm:w-[45vw] md:w-[32vw] lg:w-[24vw] flex">
      <div class="group bg-white border border-border/10 hover:shadow-2xl transition-all duration-700 flex flex-col relative w-full">
        <a href="/product/${p.slug}" class="block overflow-hidden relative aspect-[16/13]">
          ${img ? `<img src="${img}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">` : ''}
          <div class="absolute top-6 right-6 z-10">
            <span class="bg-luxe-black text-luxe-gold text-[8px] uppercase tracking-[0.3em] px-3 py-1.5">Limited</span>
          </div>
        </a>
        <div class="p-6 md:p-8 flex-1 flex flex-col items-center text-center">
          <span class="text-[8px] text-luxe-gold uppercase tracking-[0.4em] mb-3 font-medium">${p.categoryDisplay || ''}</span>
          <h3 class="text-sm md:text-base font-heading font-normal text-foreground mb-2 uppercase tracking-widest">${p.name}</h3>
          <div class="mt-auto pt-4 w-full flex items-center justify-between gap-4">
            <span class="text-base md:text-lg font-light text-foreground">${p.price} <span class="text-[10px] uppercase tracking-widest text-luxe-black/30 ml-2">AMD${perGram}</span></span>
            <button onclick="addToCart(${p.id}, event)" class="w-10 h-10 bg-luxe-black text-luxe-gold flex items-center justify-center rounded-none active:scale-95 transition-all duration-300 hover:bg-luxe-gold hover:text-luxe-black" aria-label="Add to cart">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}
function initFeaturedCarousel() {
  const el = document.querySelector('.featured-swiper');
  if (!el || typeof window.Swiper === 'undefined') return;
  
  const swiper = new window.Swiper(el, {
    rewind: true,
    grabCursor: true,
    speed: 600,
    autoplay: { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true },
    navigation: { nextEl: '.featured-nav-next', prevEl: '.featured-nav-prev' },
    pagination: { el: '.featured-pagination', clickable: true },
    
    // Use 'auto' so Swiper reads the precise CSS widths we defined above
    slidesPerView: 'auto',
    centeredSlides: false,
    spaceBetween: 16,
    
    breakpoints: {
      640: { spaceBetween: 20 },
      768: { spaceBetween: 24 },
      1024: { spaceBetween: 32 },
    },
  });

  let startX = null;
  el.addEventListener(
    'touchstart',
    (e) => {
      startX = e.touches && e.touches[0] ? e.touches[0].clientX : null;
    },
    { passive: true }
  );
  el.addEventListener(
    'touchend',
    (e) => {
      const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
      const dx = startX != null && endX != null ? endX - startX : 0;
      startX = null;
      if (swiper.isEnd && dx < -30) swiper.slideTo(0, 600);
      else if (swiper.isBeginning && dx > 30) swiper.slideTo(swiper.slides.length - 1, 600);
    },
    { passive: true }
  );

  if (swiper.autoplay) {
    let resumeTimer;
    const stop = () => {
      clearTimeout(resumeTimer);
      swiper.autoplay.stop();
    };
    const scheduleResume = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => swiper.autoplay.start(), 8000);
    };
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchend', scheduleResume, { passive: true });
  }
}

function initHeroCarousel(slides) {
  const background = document.getElementById('hero-bg');
  const controls = document.getElementById('hero-slide-controls');
  if (!background || !controls) return;

  const imageSlides = slides.filter((slide) => slide.image);
  if (!imageSlides.length) return;

  const layers = [0, 1].map(() => {
    const image = document.createElement('img');
    image.className = 'hero-slide-bg';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.draggable = false;
    background.appendChild(image);
    return image;
  });

  let activeLayer = -1;
  let activeSlide = -1;
  let requestedSlide = 0;
  let requestId = 0;
  let timer = 0;
  const buttons = imageSlides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero-slide-indicator';
    button.setAttribute('aria-label', `Show hero slide ${index + 1}${slide.title ? `: ${slide.title}` : ''}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      requestedSlide = index;
      showSlide(index);
      restartTimer();
    });
    controls.appendChild(button);
    return button;
  });

  function showSlide(index) {
    requestedSlide = index;
    if (index === activeSlide) {
      requestId++;
      return;
    }
    const request = ++requestId;
    const nextLayer = (activeLayer + 1) % layers.length;
    const probe = new Image();
    probe.onload = () => {
      if (request !== requestId) return;
      const layer = layers[nextLayer];
      layer.src = probe.src;
      layer.classList.add('is-active');
      if (activeLayer !== -1) layers[activeLayer].classList.remove('is-active');
      activeLayer = nextLayer;
      activeSlide = index;
      buttons.forEach((button, buttonIndex) => {
        const isActive = buttonIndex === index;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    };
    probe.onerror = () => {
      if (request === requestId) {
        console.error(`Failed to load hero slide image: ${imageSlides[index].image}`);
      }
    };
    probe.src = imageSlides[index].image;
  }

  function showNextSlide() {
    const nextIndex = (requestedSlide + 1) % imageSlides.length;
    requestedSlide = nextIndex;
    showSlide(nextIndex);
  }

  function restartTimer() {
    window.clearInterval(timer);
    if (imageSlides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = window.setInterval(showNextSlide, 6000);
    }
  }

  showSlide(0);
  restartTimer();
}

async function init() {
  try {
    const [home, cats] = await Promise.all([get('/home'), get('/categories')]);

    initHeroCarousel(home.heroSlides || []);

    const hs = home.heroSettings || {};
    const title = document.getElementById('hero-title');
    if (title && (hs.titleLine1 || hs.titleHighlight)) {
      const hi = hs.titleHighlight
        ? `<br><span class="text-luxe-gold font-serif italic font-normal">${hs.titleHighlight}</span>`
        : '';
      title.innerHTML = `${hs.titleLine1 || ''}${hi}`;
    }
    const sub = document.getElementById('hero-subtitle');
    if (sub && hs.description) sub.textContent = hs.description;

    const cg = document.getElementById('categories-grid');
    if (cg) {
      const all = cats.categories || [];
      const withImage = all.filter((c) => c.image);
      cg.innerHTML = (withImage.length ? withImage : all).slice(0, 5).map(categoryCard).join('');
    }

    const items = home.featuredItems || [];
    const wrap = document.getElementById('featured-wrapper');
    if (wrap) wrap.innerHTML = items.map(featuredSlide).join('');
    initFeaturedCarousel();

    // stats (animated count-up handled by layout's [data-count] observer)
    const setStat = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      const target = Math.round(Number(value) || 0);
      el.textContent = target;
      el.dataset.count = String(target);
    };
    setStat('stat-reviews', home.totalReviews);
    setStat('stat-products', home.menuItemsCount);
    const rating = document.getElementById('stat-rating');
    if (rating) rating.textContent = (Number(home.avgRating) || 0).toFixed(1);

    // re-run observers for newly injected nodes
    if (typeof window.__observeScroll === 'function') window.__observeScroll();
    if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
  } catch (e) {
    console.error('home init failed', e);
  }
}
init();
