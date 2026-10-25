import { get, post } from '/js/api.js';

const MON = ['Հուն','Փետ','Մար','Ապր','Մայ','Հուն','Հուլ','Օգտ','Սեպ','Հոկ','Նոյ','Դեկ'];

function fmtDate(iso) {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yerevan', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(iso));
  const g = t => parts.find(p => p.type === t).value;
  return `${MON[+g('month') - 1]} ${+g('day')}, ${g('year')}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function starSvg(fill, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="${fill}" stroke="currentColor" stroke-width="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>`;
}

let sort = new URLSearchParams(location.search).get('sort') || 'recent';
let nextPage = null;

function setSortLinks() {
  const rec = document.getElementById('sort-recent');
  const all = document.getElementById('sort-all');
  const active = 'text-luxe-gold';
  const inactive = 'text-luxe-black/30 hover:text-luxe-gold';
  rec.className = `text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${sort === 'recent' ? active : inactive}`;
  all.className = `text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${sort === 'all' ? active : inactive}`;
}

function renderStats(data) {
  const avg = data.avgRating || 0;
  document.getElementById('avg-rating').textContent = avg ? Number(avg).toFixed(1) : '5.0';
  document.getElementById('total-reviews').textContent = String(data.totalReviews || 0);
  document.getElementById('avg-stars').innerHTML = [1, 2, 3, 4, 5]
    .map(i => starSvg(i <= avg ? 'currentColor' : 'none', 14)).join('');
  document.getElementById('breakdown').innerHTML = (data.ratingBreakdown || []).map(row => `
    <div class="flex items-center gap-6">
      <span class="text-[10px] font-bold text-luxe-black/20 w-4">${row.stars}</span>
      <div class="flex-1 bg-luxe-black/5 h-[1px] overflow-hidden">
        <div class="h-full bg-luxe-gold" style="width: ${row.percentage}%;"></div>
      </div>
    </div>`).join('');
}

function reviewCard(r, animate) {
  const stars = [1, 2, 3, 4, 5].map(i => starSvg(i <= (r.rating || 5) ? 'currentColor' : 'none', 12)).join('');
  return `
  <div class="review-item ${animate ? 'animate-fade-in' : 'scroll-fade'} group">
    <div class="bg-white p-10 rounded-none shadow-sm border border-luxe-black/5 h-full flex flex-col hover:border-luxe-gold/30 transition-all duration-700">
      <div class="flex justify-between items-start mb-8">
        <div class="flex gap-1 text-luxe-gold">${stars}</div>
        <span class="text-luxe-black/20 text-[9px] font-bold uppercase tracking-widest">${fmtDate(r.createdAt || r.created_at)}</span>
      </div>
      <p class="text-luxe-black/60 leading-relaxed text-base mb-10 flex-1 italic font-light font-heading">"${esc(r.text)}"</p>
      <div class="flex items-center gap-5 pt-8 border-t border-luxe-black/5">
        <div class="w-12 h-12 rounded-none bg-section-alt flex items-center justify-center text-luxe-gold font-bold text-lg font-heading">${esc(String(r.name || '').slice(0, 1))}</div>
        <div>
          <p class="font-bold text-luxe-black text-xs uppercase tracking-widest">${esc(r.name)}</p>
          <p class="text-luxe-gold text-[8px] font-bold uppercase tracking-[0.2em] mt-1">Հաստատված Հաճախորդ</p>
        </div>
      </div>
    </div>
  </div>`;
}

function updateLoadMore(pagination) {
  const box = document.getElementById('load-more-container');
  if (pagination && pagination.hasNext) {
    nextPage = pagination.nextPage;
    box.classList.remove('hidden');
    box.classList.add('flex');
  } else {
    nextPage = null;
    box.classList.add('hidden');
    box.classList.remove('flex');
  }
}

async function loadPage(page) {
  const data = await get(`/reviews?sort=${encodeURIComponent(sort)}&page=${page}`);
  if (page === 1) {
    renderStats(data);
    document.getElementById('reviews-container').innerHTML = (data.reviews || []).map(r => reviewCard(r, false)).join('');
    updateLoadMore(data.pagination);
    if (window.__observeScroll) window.__observeScroll();
  } else {
    const html = (data.reviews || []).map(r => reviewCard(r, true)).join('');
    document.getElementById('reviews-container').insertAdjacentHTML('beforeend', html);
    updateLoadMore(data.pagination);
  }
  return data;
}

function initStars() {
  const input = document.getElementById('rating-input');
  const btns = document.querySelectorAll('.star-btn');
  const paint = n => btns.forEach(b => {
    const on = +b.dataset.rating <= n;
    b.classList.toggle('text-luxe-gold', on);
    b.classList.toggle('text-white/20', !on);
    b.style.transform = +b.dataset.rating === n ? 'scale(1.15)' : '';
  });
  const sync = () => paint(parseInt(input.value, 10) || 5);
  btns.forEach(b => {
    b.addEventListener('click', () => { input.value = b.dataset.rating; sync(); });
    b.addEventListener('mouseenter', () => paint(+b.dataset.rating));
    b.addEventListener('mouseleave', sync);
  });
  sync();
}

function showMsg(text, isError) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
  el.className = isError
    ? 'mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-center text-[10px] uppercase tracking-widest font-bold'
    : 'mb-8 p-4 bg-luxe-gold/10 border border-luxe-gold/20 text-luxe-gold text-center text-[10px] uppercase tracking-widest font-bold';
}

async function init() {
  setSortLinks();
  initStars();

  try { await loadPage(1); } catch (e) { console.error(e); }

  document.getElementById('sort-recent').addEventListener('click', e => {
    e.preventDefault();
    if (sort === 'recent') return;
    sort = 'recent';
    history.replaceState({}, '', '?sort=recent');
    setSortLinks();
    loadPage(1).catch(console.error);
  });
  document.getElementById('sort-all').addEventListener('click', e => {
    e.preventDefault();
    if (sort === 'all') return;
    sort = 'all';
    history.replaceState({}, '', '?sort=all');
    setSortLinks();
    loadPage(1).catch(console.error);
  });

  const loadBtn = document.getElementById('load-more-btn');
  const spinner = document.getElementById('load-more-spinner');
  loadBtn.addEventListener('click', async () => {
    if (!nextPage) return;
    spinner.classList.remove('hidden');
    loadBtn.disabled = true;
    try { await loadPage(nextPage); } catch (e) { console.error(e); }
    finally { spinner.classList.add('hidden'); loadBtn.disabled = false; }
  });

  document.getElementById('review-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const d = await post('/reviews', body);
      showMsg(d.message || 'Ձեր կարծիքը հաջողությամբ ուղարկվեց և սպասում է հաստատման։', false);
      form.reset();
      document.getElementById('rating-input').value = '5';
      document.querySelectorAll('.star-btn').forEach(b => {
        b.classList.toggle('text-luxe-gold', +b.dataset.rating <= 5);
        b.classList.toggle('text-white/20', +b.dataset.rating > 5);
        b.style.transform = '';
      });
    } catch (err) {
      const errors = err.data && err.data.errors;
      const msg = errors ? Object.values(errors).join(' · ') : (err.data && err.data.error) || 'Սխալ: փորձեք կրկին';
      showMsg(msg, true);
    }
  });
}

init();
