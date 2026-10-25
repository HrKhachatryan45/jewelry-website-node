// Luxe Jewelry admin SPA — hash router + auth guard (vanilla JS, no framework).
import { get, post } from '../api.js';
import { esc, toast } from './ui.js';
import * as views from './views.js';

const NAV = [
  { hash: '#/dashboard', label: 'Գլխավոր', mobileLabel: 'Վահանակ', match: ['dashboard'], mobile: true, section: 'Վահանակ', icon: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>' },
  { hash: '#/products', label: 'Զարդեր', match: ['products'], mobile: true, section: 'Կառավարում', icon: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>' },
  { hash: '#/hero', label: 'Գլխ. Նկարներ', match: ['hero'], mobile: true, icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>' },
  { hash: '#/orders', label: 'Պատվերներ', match: ['orders'], mobile: true, icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
  { hash: '#/bespoke', label: 'Անհատական', match: ['bespoke'], mobile: true, icon: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>' },
  { hash: '#/reviews', label: 'Կարծիքներ', match: ['reviews'], icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { hash: '#/messages', label: 'Կապ', match: ['messages'], icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { hash: '#/users', label: 'Օգտատերեր', match: ['users'], icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
];

const state = { user: null };

const app = () => document.getElementById('app');

function icon(paths) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function renderLogin(error = '') {
  app().innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-luxe-black p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-10">
          <h1 class="font-heading text-3xl tracking-[0.3em] uppercase text-white">Luxe <span class="text-primary">Jewelry</span></h1>
          <p class="text-white/30 text-[10px] font-bold tracking-[0.4em] uppercase mt-2">Ադմին Պանել</p>
        </div>
        <form id="login-form" class="bg-white/5 border border-white/10 p-8 space-y-6">
          ${error ? `<div class="text-red-400 text-[11px] font-bold uppercase tracking-widest border-l-2 border-red-500 pl-3">${esc(error)}</div>` : ''}
          <div>
            <label class="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Մուտքանուն</label>
            <input name="username" autocomplete="username" class="w-full px-4 py-3 bg-white/5 border border-white/10 text-white focus:border-primary outline-none transition-all" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Գաղտնաբառ</label>
            <input name="password" type="password" autocomplete="current-password" class="w-full px-4 py-3 bg-white/5 border border-white/10 text-white focus:border-primary outline-none transition-all" />
          </div>
          <button class="w-full py-4 bg-primary text-luxe-black text-[11px] font-bold uppercase tracking-[0.3em] hover:bg-white transition-colors">Մուտք</button>
        </form>
        <p class="text-center text-white/20 text-[10px] mt-6 uppercase tracking-widest"><a href="/" class="hover:text-primary">← Վերադառնալ կայք</a></p>
      </div>
    </div>`;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user } = await post('/auth/login', { username: fd.get('username'), password: fd.get('password') });
      if (user.role !== 'admin') {
        await post('/auth/logout');
        return renderLogin('Այս օգտատերը ադմին չէ');
      }
      state.user = user;
      renderShell();
    } catch (err) {
      renderLogin(err.data && err.data.error ? 'Սխալ մուտքանուն կամ գաղտնաբառ' : err.message);
    }
  });
}

function renderShell() {
  const u = state.user;
  app().innerHTML = `
    <aside class="fixed top-0 left-0 z-40 w-72 h-screen transition-transform -translate-x-full lg:translate-x-0 bg-luxe-black border-r border-white/5" id="sidebar">
      <div class="h-full flex flex-col">
        <div class="p-8 border-b border-white/5">
          <a href="#/dashboard" class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary text-luxe-black flex items-center justify-center font-heading text-2xl">L</div>
            <div>
              <h1 class="text-white font-heading text-xl tracking-wider uppercase leading-none mb-1">Luxe</h1>
              <p class="text-primary text-[10px] font-bold tracking-[0.3em] uppercase leading-none">Jewelry</p>
            </div>
          </a>
        </div>
        <nav class="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar" id="admin-nav"></nav>
        <div class="p-6 bg-white/5">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-primary/20 text-primary flex items-center justify-center font-bold">${esc((u.username || 'A')[0].toUpperCase())}</div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white truncate">${esc(u.username)}</p>
              <button id="logout-btn" class="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Ելք</button>
            </div>
          </div>
        </div>
      </div>
    </aside>


    <!-- Mobile Bottom Navigation -->
    <nav id="mobile-nav" class="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 px-2 py-1 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div class="flex items-center justify-around h-16" id="mobile-nav-inner"></div>
    </nav>

    <main class="lg:ml-72 min-h-screen pb-20 lg:pb-0">
      <header class="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div class="flex items-center justify-between px-4 sm:px-8 py-4">
          <div class="flex items-center gap-4">
            <div class="lg:hidden">
              <h1 class="font-heading text-lg font-normal tracking-widest uppercase"><span class="text-luxe-black">Luxe</span> <span class="text-primary">Jewelry</span></h1>
            </div>
            <div class="hidden lg:block">
              <h2 id="page-title" class="text-lg font-heading uppercase tracking-tight text-gray-900"></h2>
              <p id="page-subtitle" class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5"></p>
            </div>
          </div>
          <div class="flex items-center gap-3 sm:gap-6">
            <div class="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-400"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>ՕՆԼԱՅՆ</div>
            <div class="w-px h-6 bg-gray-100 hidden sm:block"></div>
            <div class="flex items-center gap-3">
              <span class="text-[11px] font-bold text-gray-900 uppercase tracking-widest hidden sm:block">${esc(u.username)}</span>
              <div class="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-bold">${esc((u.username || 'A')[0].toUpperCase())}</div>
            </div>
          </div>
        </div>
      </header>
      <div id="view" class="p-4 sm:p-8"></div>
    </main>`;

  const nav = document.getElementById('admin-nav');
  let lastSection = '';
  NAV.forEach((item) => {
    if (item.section && item.section !== lastSection) {
      lastSection = item.section;
      const p = document.createElement('p');
      p.className = 'px-4 text-[9px] font-bold text-white/20 uppercase tracking-[0.4em] mb-4 mt-8 first:mt-0';
      p.textContent = item.section;
      nav.appendChild(p);
    }
    const a = document.createElement('a');
    a.href = item.hash;
    a.dataset.match = item.match.join(',');
    a.className = 'flex items-center gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all';
    a.innerHTML = `${icon(item.icon)}<span>${item.label}</span>`;
    nav.appendChild(a);
  });
  const ext = document.createElement('div');
  ext.className = 'pt-8 mt-8 border-t border-white/5';
  ext.innerHTML = `<a href="/" target="_blank" class="flex items-center gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-primary transition-all">${icon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>')}<span>Դիտել կայքը</span></a>`;
  nav.appendChild(ext);

  // Mobile bottom nav (mirrors Python base.html: 5 sections + logout)
  const mnav = document.getElementById('mobile-nav-inner');
  mnav.innerHTML = '';
  NAV.filter((item) => item.mobile).forEach((item) => {
    const a = document.createElement('a');
    a.href = item.hash;
    a.dataset.match = item.match.join(',');
    a.className = 'flex flex-col items-center gap-1.5 p-2 text-gray-400';
    a.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      <span class="text-[8px] font-bold uppercase tracking-widest">${item.mobileLabel || item.label}</span>
    `;
    mnav.appendChild(a);
  });
  const ma = document.createElement('a');
  ma.href = '#';
  ma.id = 'm-logout';
  ma.className = 'flex flex-col items-center gap-1.5 p-2 text-gray-400';
  ma.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span class="text-[8px] font-bold uppercase tracking-widest">Ելք</span>`;
  mnav.appendChild(ma);

  const doLogout = async () => {
    await post('/auth/logout');
    state.user = null;
    renderLogin();
  };
  document.getElementById('logout-btn').addEventListener('click', doLogout);
  ma.addEventListener('click', (e) => {
    e.preventDefault();
    doLogout();
  });

  window.addEventListener('hashchange', navigate);
  if (!location.hash) location.hash = '#/dashboard';
  navigate();
}

function setActiveNav(top) {
  document.querySelectorAll('#admin-nav a').forEach((a) => {
    if (!a.dataset.match) return;
    const on = a.dataset.match.split(',').includes(top);
    a.className = on
      ? 'flex items-center gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all bg-primary text-luxe-black'
      : 'flex items-center gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all text-white/60 hover:text-primary hover:bg-white/5';
  });
  document.querySelectorAll('#mobile-nav-inner a').forEach((a) => {
    if (!a.dataset.match) return;
    const on = a.dataset.match.split(',').includes(top);
    a.className = on
      ? 'flex flex-col items-center gap-1.5 p-2 text-primary'
      : 'flex flex-col items-center gap-1.5 p-2 text-gray-400';
  });
}

const ctx = {
  get user() {
    return state.user;
  },
  container: () => document.getElementById('view'),
  title: (t, s = '') => {
    document.getElementById('page-title').textContent = t;
    document.getElementById('page-subtitle').textContent = s;
  },
  navigate: (hash) => {
    location.hash = hash;
  },
};

async function navigate() {
  if (!state.user) return;
  const path = location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  const [top, ...rest] = path.split('/');

  const route = () => {
    switch (top) {
      case 'dashboard':
        return views.dashboard(ctx);
      case 'products':
        if (rest[0] === 'new') return views.productForm(ctx, null);
        if (rest[0] === 'page') return views.productsList(ctx, rest[1] || 1);
        return rest[0] ? views.productForm(ctx, rest[0]) : views.productsList(ctx, 1);
      case 'hero':
        return views.hero(ctx);
      case 'orders':
        if (rest[0] === 'page') return views.ordersList(ctx, rest[1] || 1);
        return rest[0] ? views.orderDetail(ctx, rest[0]) : views.ordersList(ctx, 1);
      case 'bespoke':
        if (rest[0] === 'page') return views.bespokeList(ctx, rest[1] || 1);
        return rest[0] ? views.bespokeDetail(ctx, rest[0]) : views.bespokeList(ctx, 1);
      case 'reviews':
        return views.reviewsList(ctx, rest[0] === 'page' ? rest[1] || 1 : rest[0] || 1);
      case 'messages':
        return views.messagesList(ctx, rest[0] === 'page' ? rest[1] || 1 : rest[0] || 1);
      case 'users':
        return views.usersList(ctx);
      default:
        return views.dashboard(ctx);
    }
  };

  setActiveNav(top);
  document.getElementById('sidebar').classList.add('-translate-x-full');
  try {
    await route();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      state.user = null;
      return renderLogin('Ձեր սեսիան ավարտվել է');
    }
    toast(err.message || 'Սխալ', 'error');
  }
}

async function boot() {
  try {
    const { user } = await get('/auth/me');
    if (user && user.role === 'admin') {
      state.user = user;
      renderShell();
      return;
    }
  } catch {
    /* not logged in */
  }
  renderLogin();
}

boot();
