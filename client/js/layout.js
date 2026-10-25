// Inject header/footer/toast, wire mobile menu, navbar scroll, scroll animations, cart badge sync, contact info
async function loadHTML(sel, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const html = await res.text();
    const el = document.querySelector(sel);
    if (el) el.innerHTML = html;
  } catch (e) {}
}

// True when the fixed, transparent navbar sits over a dark section (hero,
// breadcrumb, policy header...). Samples the page behind the navbar itself so
// every dark-topped page gets white links without per-page configuration.
function navbarOverDarkSection(navbar) {
  const x = window.innerWidth / 2;
  const y = Math.max(10, Math.min(40, (navbar.offsetHeight || 80) / 2));
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el === navbar || navbar.contains(el)) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)/.exec(bg);
    if (!m) continue;
    const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    if (a < 0.5) continue;
    const lum = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
    return lum < 0.5;
  }
  return false;
}

function updateNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const navLogoText = document.querySelectorAll('.nav-logo-text');
  const navLinks = document.querySelectorAll('.nav-link');
  const navIconSvgs = document.querySelectorAll('.nav-cart-svg');
  const mobileIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');
  const bodyPage = document.body.dataset.page || '';

  // The navbar is transparent at the top of every page and gains a solid
  // background once scrolled. While transparent, sample what is actually
  // painted behind it: dark sections (home hero, collection/about/contact
  // heroes, product/cart/checkout breadcrumbs, policy headers...) need white
  // links, light sections need dark links.
  const scrolled = window.scrollY > 100;
  const overDark = !scrolled && navbarOverDarkSection(navbar);
  navbar.classList.toggle('nav-over-dark', overDark);

  if (scrolled) {
    navbar.classList.add('bg-white/95','backdrop-blur-md','shadow-sm','h-16','md:h-20');
    navbar.classList.remove('bg-transparent','h-20','md:h-24');
  } else {
    navbar.classList.remove('bg-white/95','backdrop-blur-md','shadow-sm','h-16','md:h-20');
    navbar.classList.add('bg-transparent','h-20','md:h-24');
  }

  const swap = (el, from, to) => {
    if (!el) return;
    el.classList.remove(...from.split(' ').filter(Boolean));
    el.classList.add(...to.split(' ').filter(Boolean));
  };

  if (overDark) {
    swap(navLogoText[0], 'text-foreground', 'text-primary-foreground uppercase');
    swap(navLogoText[1], 'text-foreground', 'text-primary-foreground uppercase');
    [...navIconSvgs, mobileIcon, closeIcon].forEach(icon => swap(icon, 'text-foreground', 'text-primary-foreground'));
    navLinks.forEach(link => swap(link, 'text-foreground/70', 'text-primary-foreground/70'));
  } else {
    swap(navLogoText[0], 'text-primary-foreground', 'text-foreground uppercase');
    swap(navLogoText[1], 'text-primary-foreground', 'text-foreground uppercase');
    [...navIconSvgs, mobileIcon, closeIcon].forEach(icon => swap(icon, 'text-primary-foreground', 'text-foreground'));
    navLinks.forEach(link => swap(link, 'text-primary-foreground/70', 'text-foreground/70'));
  }

  // active nav
  document.querySelectorAll('.nav-link[data-nav]').forEach(a => {
    const active = a.dataset.nav === bodyPage;
    a.classList.remove('text-luxe-gold');
    if (active) {
      a.classList.add('text-luxe-gold');
    } else {
      a.classList.add(overDark ? 'text-primary-foreground/70' : 'text-foreground/70', 'hover:text-luxe-gold');
    }
  });
}

function setupScrollAnims() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scroll-fade, .scroll-fade-left, .scroll-fade-right, .scroll-scale').forEach(el => observer.observe(el));
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const end = parseInt(el.dataset.count||'0',10);
        let t0=null;
        const dur=2000;
        const step=(ts)=>{ if(!t0)t0=ts; const p=Math.min((ts-t0)/dur,1); el.textContent=Math.floor(p*end)+(el.dataset.suffix||''); if(p<1)requestAnimationFrame(step); };
        requestAnimationFrame(step);
        countObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el=>countObs.observe(el));
}
window.__observeScroll = setupScrollAnims;

let toastTimeout;
window.showToast = function(name, imageUrl) {
  const toast = document.getElementById('global-cart-toast');
  const progress = document.getElementById('global-toast-progress');
  const toastImg = document.getElementById('global-toast-product-image');
  const toastName = document.getElementById('global-toast-product-name');
  if (!toast) return;
  clearTimeout(toastTimeout);
  if (toastImg && imageUrl) toastImg.src = imageUrl;
  if (toastName && name) toastName.textContent = name;
  toast.classList.remove('translate-x-[150%]','opacity-0','pointer-events-none');
  toast.classList.add('translate-x-0','opacity-100');
  if (progress) {
    progress.style.transition='none';
    progress.style.transform='scaleX(1)';
    void progress.offsetHeight;
    progress.style.transition='transform 5s linear';
    progress.style.transform='scaleX(0)';
  }
  toastTimeout=setTimeout(()=>window.closeToast(),5000);
};
window.closeToast=function(){
  const toast=document.getElementById('global-cart-toast');
  if (toast){ toast.classList.add('translate-x-[150%]','opacity-0','pointer-events-none'); toast.classList.remove('translate-x-0','opacity-100'); }
};

async function syncCartBadge(){
  try{
    const res=await fetch('/api/cart',{credentials:'include'});
    const data=await res.json();
    const c = data.cart_count||0;
    document.querySelectorAll('#cart-count,.mobile-cart-count').forEach(b=>{ b.textContent=c; });
  }catch(e){}
}
window.addToCart = async function(itemId, event){
  if (event){ event.preventDefault(); event.stopPropagation(); }
  const btn = event?event.currentTarget:null;
  let orig;
  if (btn){ btn.classList.add('pointer-events-none','opacity-70'); orig=btn.innerHTML; btn.innerHTML='<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'; }
  try{
    const r=await fetch('/api/cart/add/'+itemId,{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({quantity:1}),credentials:'include'});
    const d=await r.json();
    if(d.success){
      const c=d.cart_count||0;
      document.querySelectorAll('#cart-count,.mobile-cart-count').forEach(b=>{ b.textContent=c; b.classList.add('scale-125','bg-emerald-400'); setTimeout(()=>b.classList.remove('scale-125','bg-emerald-400'),500); });
      if (typeof window.showToast==='function') window.showToast(d.item_name,d.item_image);
    }
  }finally{
    if (btn){ btn.classList.remove('pointer-events-none','opacity-70'); btn.innerHTML=orig; }
  }
};

async function loadConfig(){
  try{
    const r=await fetch('/api/config',{credentials:'include'});
    const cfg=await r.json();
    document.querySelectorAll('[data-contact="phone"]').forEach(e=>{ e.textContent=cfg.contact?.phone||''; });
    document.querySelectorAll('[data-contact="phone-href"]').forEach(e=>{ e.href='tel:'+(cfg.contact?.phone||'').replace(/\s+/g,''); });
    document.querySelectorAll('[data-contact="email"]').forEach(e=>{ e.textContent=cfg.contact?.email||''; });
    document.querySelectorAll('[data-contact="email-href"]').forEach(e=>{ e.href='mailto:'+(cfg.contact?.email||''); });
    const y=document.getElementById('copyright-year');
    if(y) y.textContent=new Date().getFullYear();
  }catch(e){}
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await Promise.all([
    loadHTML('#header-slot','/partials/header.html'),
    loadHTML('#footer-slot','/partials/footer.html'),
    loadHTML('#toast-slot','/partials/toast.html')
  ]);
  // wire mobile menu after header injected
  const btn=document.getElementById('mobile-menu-btn');
  const menu=document.getElementById('mobile-menu');
  const mi=document.getElementById('menu-icon');
  const ci=document.getElementById('close-icon');
  if (btn){
    btn.addEventListener('click',()=>{
      const open=menu.classList.contains('max-h-[500px]');
      if(open){ menu.classList.replace('max-h-[500px]','max-h-0'); if(mi) mi.classList.remove('hidden'); if(ci) ci.classList.add('hidden'); }
      else { menu.classList.replace('max-h-0','max-h-[500px]'); if(mi) mi.classList.add('hidden'); if(ci) ci.classList.remove('hidden'); }
    });
  }
  updateNavbar();
  window.addEventListener('scroll',updateNavbar,{passive:true});
  setupScrollAnims();
  await syncCartBadge();
  await loadConfig();
  // trigger i18n re-apply if present
  if (window.I18N && typeof window.I18N.apply==='function'){
    const lang=localStorage.getItem('luxe_lang')||'hy';
    window.I18N.setLang(lang);
  }
});
