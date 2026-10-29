// Admin SPA views. Each renders into ctx.container() and wires its own events.
// Ported 1:1 from templates/custom_admin/* (Django custom admin), including mobile layouts.
import { get, post, put, del } from '../api.js';
import { esc, toast, confirmDialog, modal } from './ui.js';

// ── Inline SVG icon path sets (match the Django templates) ─────────────
const P = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7v2H2V7z"/><path d="M2 12h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z"/><path d="M7 12v-3"/><path d="M12 12v-3"/><path d="M17 12v-3"/>',
  gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  editText: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

function svg(paths, { size = 18, sw = 2, cls = '', fill = 'none' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${paths}</svg>`;
}

function starIcon(size, filled, color = '#D4AF37') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? color : 'none'}" stroke="${filled ? color : '#D1D5DB'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

function stars(rating, size = 12, color = '#D4AF37') {
  let h = '';
  for (let i = 1; i <= 5; i += 1) h += starIcon(size, i <= rating, color);
  return h;
}

const initial = (s) => esc(((s || '?').trim()[0] || '?').toUpperCase());

// ── Date formatters (mirror Django `date` filter output) ───────────────
const pad = (n) => String(n).padStart(2, '0');
const parts = (v) => {
  const d = new Date(v);
  return { dd: pad(d.getDate()), mm: pad(d.getMonth() + 1), yyyy: d.getFullYear(), HH: pad(d.getHours()), MM: pad(d.getMinutes()) };
};
const fDmy = (v) => { const p = parts(v); return `${p.dd}.${p.mm}.${p.yyyy}`; };
const fDmyTime = (v) => { const p = parts(v); return `${p.dd}.${p.mm}.${p.yyyy} ${p.HH}:${p.MM}`; };
const fDayMonth = (v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const fDayMonthYear = (v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fDayMonthTime = (v) => { const p = parts(v); return `${fDayMonth(v)}, ${p.HH}:${p.MM}`; };
const fDayMonthYearTime = (v) => { const p = parts(v); return `${fDayMonthYear(v)}, ${p.HH}:${p.MM}`; };

// ── Choice maps / label helpers ────────────────────────────────────────
const MATERIALS = [
  ['gold_yellow', 'Դեղին Ոսկի'],
  ['gold_white', 'Սպիտակ Ոսկի'],
  ['gold_rose', 'Վարդագույն Ոսկի'],
  ['silver', 'Արծաթ 925'],
  ['platinum', 'Պլատին'],
];
const CATEGORIES = [
  ['rings', 'Մատանիներ'],
  ['necklaces', 'Վզնոցներ'],
  ['earrings', 'Ականջօղեր'],
  ['bracelets', 'Ապարանջաններ'],
  ['watches', 'Ժամացույցներ'],
  ['bespoke', 'Անհատական Պատվեր'],
  ['collections', 'Հավաքածուներ'],
];
const JEWELRY_TYPES = { ring: 'Մատանի', necklace: 'Վզնոց', earrings: 'Ականջօղեր', bracelet: 'Ապարանջան', other: 'Այլ' };
const jewelryLabel = (t) => JEWELRY_TYPES[t] || t || '—';

const STATUS_SELECT = {
  new: 'bg-orange-50 text-orange-600',
  confirmed: 'bg-blue-50 text-blue-600',
  ready: 'bg-yellow-50 text-yellow-600',
  delivered: 'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-600',
};
const BESPOKE_CHIP = {
  new: 'bg-blue-50 text-blue-500 border-blue-100',
  contacted: 'bg-amber-50 text-amber-500 border-amber-100',
  in_progress: 'bg-purple-50 text-purple-500 border-purple-100',
  completed: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  cancelled: 'bg-gray-50 text-gray-400 border-gray-100',
};
const DETAIL_STATUS = {
  new: 'bg-orange-50 text-orange-600 border-orange-100',
  confirmed: 'bg-blue-50 text-blue-600 border-blue-100',
  ready: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  delivered: 'bg-green-50 text-green-600 border-green-100',
  cancelled: 'bg-red-50 text-red-600 border-red-100',
};

function opts(list, selected) {
  return list.map(([v, l]) => `<option value="${v}" ${String(v) === String(selected) ? 'selected' : ''}>${l}</option>`).join('');
}

function orderStatusChip(o, small = false) {
  const c = small ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[10px]';
  const base = `${c} font-black uppercase tracking-wider border`;
  if (o.status === 'new') return `<span class="${base} border-blue-200 text-blue-700">Նոր</span>`;
  if (o.status === 'delivered') return `<span class="${base} border-emerald-200 text-emerald-700">Ավարտված</span>`;
  if (o.status === 'cancelled') return `<span class="${base} border-red-200 text-red-700">Չեղարկված</span>`;
  return `<span class="${base} border-gray-200 text-gray-700">${esc(o.statusDisplay || o.status)}</span>`;
}

// ── Pagination helpers ─────────────────────────────────────────────────
function pagerButtons(meta) {
  const btn = (label, page) => `<button data-page="${page}" class="px-4 py-2 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:bg-luxe-black hover:text-white transition-all">${label}</button>`;
  return `<div class="flex items-center gap-2 flex-wrap">
    ${meta.hasPrevious ? btn('Առաջին', 1) + btn('Նախորդ', meta.page - 1) : ''}
    <span class="px-6 py-2 bg-primary text-luxe-black font-bold text-[10px] uppercase tracking-widest">Էջ ${meta.page}</span>
    ${meta.hasNext ? btn('Հաջորդ', meta.page + 1) + btn('Վերջին', meta.totalPages) : ''}
  </div>`;
}

function numberedPager(meta) {
  let h = '<div class="mt-8 flex justify-center gap-2 flex-wrap">';
  if (meta.hasPrevious) h += `<button data-page="${meta.page - 1}" class="w-10 h-10 flex items-center justify-center border border-gray-200 text-gray-400 hover:border-primary hover:text-primary transition-all">${svg(P.chevronLeft, { size: 16, sw: 2.5 })}</button>`;
  for (let n = 1; n <= meta.totalPages; n += 1) {
    if (n === meta.page) h += `<span class="w-10 h-10 flex items-center justify-center bg-luxe-black text-primary border border-luxe-black text-[10px] font-bold">${n}</span>`;
    else if (n > meta.page - 3 && n < meta.page + 3) h += `<button data-page="${n}" class="w-10 h-10 flex items-center justify-center border border-gray-200 text-gray-400 hover:border-primary hover:text-primary transition-all text-[10px] font-bold">${n}</button>`;
  }
  if (meta.hasNext) h += `<button data-page="${meta.page + 1}" class="w-10 h-10 flex items-center justify-center border border-gray-200 text-gray-400 hover:border-primary hover:text-primary transition-all">${svg(P.chevronRight, { size: 16, sw: 2.5 })}</button>`;
  return `${h}</div>`;
}

function bindPages(ctx, onPage) {
  ctx.container().querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => onPage(b.dataset.page)));
}

function hashQuery() {
  return new URLSearchParams(location.hash.split('?')[1] || '');
}

// ── Chart.js (dynamic load, CSS-bar fallback) ──────────────────────────
let chartPromise = null;
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartPromise) {
    chartPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = () => (window.Chart ? resolve(window.Chart) : reject(new Error('no chart')));
      s.onerror = () => reject(new Error('chart load failed'));
      document.head.appendChild(s);
    });
  }
  return chartPromise;
}

function fallbackBars(chart) {
  const host = document.getElementById('chart-host');
  if (!host) return;
  const max = Math.max(1, ...chart.data);
  host.innerHTML = `<div class="flex items-end gap-3 h-full pb-8">${chart.data
    .map((v, i) => `<div class="flex-1 flex flex-col items-center justify-end gap-2 h-full"><span class="text-[10px] font-bold text-gray-400">${v}</span><div class="w-full bg-primary/80" style="height:${Math.max(4, (v / max) * 100)}%"></div><span class="text-[9px] font-bold text-gray-400 uppercase">${esc(chart.labels[i])}</span></div>`)
    .join('')}</div>`;
}

async function drawOrdersChart(chart) {
  const canvas = document.getElementById('ordersChart');
  if (!canvas) return;
  try {
    const Chart = await loadChartJs();
    // eslint-disable-next-line no-new
    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: chart.labels,
        datasets: [{
          label: 'Պատվերներ',
          data: chart.data,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#D4AF37',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#D4AF37',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 0,
            displayColors: false,
            titleFont: { size: 11, weight: 'bold', family: 'system-ui' },
            bodyFont: { size: 14, weight: 'bold' },
          },
        },
        scales: {
          y: { beginAtZero: true, border: { display: false }, grid: { color: '#f3f4f6', drawTicks: false }, ticks: { padding: 10, color: '#9ca3af', font: { size: 11, weight: 'bold' } } },
          x: { border: { display: false }, grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11, weight: 'bold' } } },
        },
      },
    });
  } catch {
    fallbackBars(chart);
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────
export async function dashboard(ctx) {
  ctx.title('Գլխավոր', 'Բարի գալուստ ձեր ադմինիստրատիվ վահանակ');
  const d = await get('/admin/dashboard');
  const s = d.stats;

  const lightCard = ({ href, icon, value, label, cta, delay }) => `
    <div class="relative overflow-hidden group bg-white rounded-none p-6 text-gray-900 shadow-xl shadow-gray-100 hover:shadow-gray-200 transition-all duration-300 border border-gray-100">
      <div class="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">${svg(icon, { size: 120, sw: 2 })}</div>
      <div class="relative z-10">
        <div class="w-12 h-12 bg-gray-50 border border-gray-100 rounded-none flex items-center justify-center mb-4 text-primary">${svg(icon, { size: 24, sw: 2 })}</div>
        <h3 class="text-4xl font-heading font-normal mb-1 tabular-nums">${value}</h3>
        <p class="text-gray-400 text-[10px] font-bold tracking-[0.2em] uppercase">${label}</p>
        <a href="${href}" class="inline-flex items-center gap-2 mt-4 text-[10px] font-bold border border-gray-200 text-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2 transition-all uppercase tracking-widest">${cta} ${svg(P.chevronRight, { size: 14, sw: 2.5 })}</a>
      </div>
    </div>`;

  ctx.container().innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="relative overflow-hidden group bg-gradient-to-br from-[#111827] to-[#1F2937] rounded-none p-6 text-white shadow-xl shadow-gray-900/10 hover:shadow-gray-900/20 transition-all duration-300 border border-white/5">
        <div class="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-primary">${svg(P.gem, { size: 120, sw: 1.5 })}</div>
        <div class="relative z-10">
          <div class="w-12 h-12 bg-primary/10 backdrop-blur-md rounded-none border border-primary/20 flex items-center justify-center mb-4">${svg(P.gem, { size: 24, sw: 2, cls: 'text-primary' })}</div>
          <h3 class="text-4xl font-heading font-normal mb-1 tabular-nums text-primary">${s.totalMenuItems}</h3>
          <p class="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase">Ընդհանուր Տեսականի</p>
          <a href="#/products" class="inline-flex items-center gap-2 mt-4 text-[10px] font-bold border border-primary/30 text-primary hover:bg-primary hover:text-luxe-black px-4 py-2 transition-all uppercase tracking-widest">Կառավարել ${svg(P.chevronRight, { size: 14, sw: 2.5 })}</a>
        </div>
      </div>
      ${lightCard({ href: '#/orders', icon: P.bag, value: s.newOrders, label: 'Նոր Պատվերներ', cta: 'Դիտել' })}
      ${lightCard({ href: '#/reviews', icon: P.star, value: s.totalReviews, label: 'Կարծիքներ', cta: 'Դիտել' })}
      ${lightCard({ href: '#/messages', icon: P.message, value: s.totalMessages, label: 'Կապի Հաղորդագրություն', cta: 'Կարդալ' })}
    </div>

    <div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden mb-8">
      <div class="p-8 border-b border-gray-50 bg-gray-50/50">
        <h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Պատվերների վիճակագրություն</h3>
        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Վերջին 7 օրեր</p>
      </div>
      <div class="p-8"><div id="chart-host" class="relative h-64 sm:h-96"><canvas id="ordersChart" class="w-full h-full"></canvas></div></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div class="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Վերջին կարծիքները</h3>
            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Հաճախորդների հետադարձ կապ</p>
          </div>
          <a href="#/reviews" class="px-6 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a>
        </div>
        <div class="p-8 space-y-6">
          ${d.recentReviews.map((r) => `
            <div class="flex items-start gap-5 p-4 rounded-none hover:bg-gray-50 transition-all group">
              <div class="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-none border border-primary/20 flex items-center justify-center text-primary font-heading text-2xl">${initial(r.name)}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-bold text-gray-900 text-sm uppercase tracking-wide">${esc(r.name)}</h4>
                  <div class="flex items-center gap-1">${stars(r.rating, 12)}</div>
                </div>
                <p class="text-gray-500 text-sm leading-relaxed font-light">${esc(r.text)}</p>
              </div>
            </div>`).join('') || '<div class="text-center py-10"><p class="text-gray-400 font-medium italic">Կարծիքներ չկան</p></div>'}
        </div>
      </div>

      <div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div class="p-8 border-b border-gray-50 bg-gray-50/50">
          <h3 class="text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Հանրաճանաչ Զարդեր</h3>
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Լավագույն վաճառքներ</p>
        </div>
        <div class="p-6 space-y-4">
          ${d.popularItems.map((it) => `
            <a href="#/products/${it.id}" class="flex items-center gap-4 p-3 rounded-none hover:bg-gray-50 transition-all group">
              <div class="w-16 h-16 rounded-none overflow-hidden shadow-sm flex-shrink-0 border border-gray-100 bg-gray-50">
                ${it.image ? `<img src="${it.image}" alt="${esc(it.name)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>` : '<div class="w-full h-full flex items-center justify-center text-xl">💎</div>'}
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-bold text-gray-900 text-[13px] uppercase tracking-wide truncate group-hover:text-primary transition-colors">${esc(it.name)}</h4>
                <p class="text-primary font-black text-xs mt-1 tabular-nums">${it.price} AMD</p>
              </div>
              <div class="text-gray-300 group-hover:text-primary transition-colors">${svg(P.chevronRight, { size: 18, sw: 3 })}</div>
            </a>`).join('') || '<p class="text-gray-400 text-center py-10 font-medium italic">Տվյալներ չկան</p>'}
          <a href="#/products" class="block w-full text-center py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 hover:text-primary transition-colors border-t border-gray-50 mt-4">Տեսնել ամբողջ տեսականին</a>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
      <div class="lg:col-span-2 bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div class="p-5 md:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 class="text-lg md:text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Վերջին Պատվերները</h3>
            <p class="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Նոր պատվերներ</p>
          </div>
          <a href="#/orders" class="px-6 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a>
        </div>
        <div class="p-5 md:p-8 space-y-4">
          <div class="block md:hidden divide-y divide-gray-100">
            ${d.recentOrders.map((o) => `
              <div class="py-4 space-y-3">
                <div class="flex justify-between items-start">
                  <div>
                    <span class="text-[10px] font-mono text-gray-400">#${o.id}</span>
                    <h4 class="font-bold text-gray-900 leading-tight">${esc(o.fullName)}</h4>
                  </div>
                  <div class="text-right">
                    <p class="font-black text-primary text-sm tabular-nums">${o.total} AMD</p>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${fDayMonthTime(o.createdAt)}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  ${orderStatusChip(o, true)}
                  <a href="#/orders/${o.id}" class="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Մանրամասն</a>
                </div>
              </div>`).join('') || '<div class="py-8 text-center text-gray-400 text-sm italic">Պատվերներ չկան</div>'}
          </div>
          <div class="hidden md:block overflow-x-auto pb-4">
            <table class="w-full text-left border-collapse min-w-[600px]">
              <thead><tr class="text-[10px] uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100">
                <th class="pb-4 font-bold whitespace-nowrap">ID</th><th class="pb-4 font-bold whitespace-nowrap">Հաճախորդ</th>
                <th class="pb-4 font-bold whitespace-nowrap">Գումար</th><th class="pb-4 font-bold whitespace-nowrap">Կարգավիճակ</th>
                <th class="pb-4 font-bold whitespace-nowrap">Ամսաթիվ</th><th class="pb-4"></th>
              </tr></thead>
              <tbody class="text-sm">
                ${d.recentOrders.map((o) => `
                  <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td class="py-5 font-bold text-gray-900">#${o.id}</td>
                    <td class="py-5 text-gray-700 font-medium"><span class="uppercase tracking-wide">${esc(o.fullName)}</span><br><span class="text-[11px] text-gray-400">${esc(o.phone || '')}</span></td>
                    <td class="py-5 font-black text-primary tabular-nums whitespace-nowrap">${o.total} AMD</td>
                    <td class="py-5 whitespace-nowrap">${orderStatusChip(o, false)}</td>
                    <td class="py-5 text-gray-500 text-sm whitespace-nowrap">${fDayMonthYearTime(o.createdAt)}</td>
                    <td class="py-5 text-right">
                      <a href="#/orders/${o.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-none border border-gray-200 text-gray-400 hover:text-primary hover:border-primary transition-all opacity-0 group-hover:opacity-100">${svg(P.chevronRight, { size: 16, sw: 2.5 })}</a>
                    </td>
                  </tr>`).join('') || '<tr><td colspan="6" class="py-12 text-center text-gray-400 font-medium italic">Պատվերներ չկան</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-none border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div class="p-5 md:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 class="text-lg md:text-xl font-heading font-normal uppercase tracking-tight text-gray-900">Հաղորդագրություններ</h3>
            <p class="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Կապ մեզ հետ</p>
          </div>
          <a href="#/messages" class="px-4 py-2 border border-gray-200 hover:bg-gray-900 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all">Բոլորը</a>
        </div>
        <div class="p-5 md:p-6 space-y-4">
          ${d.recentMessages.map((m) => `
            <div class="p-5 rounded-none hover:bg-gray-50 transition-all border border-gray-100">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-bold text-gray-900 text-[11px] uppercase tracking-widest">${esc(m.name)}</h4>
                <span class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">${fDayMonth(m.createdAt)}</span>
              </div>
              <p class="text-[11px] font-bold text-primary mb-2 uppercase tracking-wide truncate">Կապի հաղորդագրություն</p>
              <p class="text-gray-500 text-xs font-light leading-relaxed line-clamp-3">${esc(m.message)}</p>
            </div>`).join('') || '<div class="py-10 text-center"><p class="text-gray-400 font-medium text-sm italic">Հաղորդագրություններ չկան</p></div>'}
        </div>
      </div>
    </div>`;

  drawOrdersChart(d.chart);
}

// ── Products ──────────────────────────────────────────────────────────
export async function productsList(ctx, page = 1) {
  ctx.title('Զարդեր', 'Կառավարեք ձեր տեսականին');
  const q = hashQuery();
  const search = q.get('search') || '';
  const category = q.get('category') || '';
  const params = new URLSearchParams({ page });
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const data = await get(`/admin/products?${params}`);
  const meta = data.pagination;
  const size = 12;
  const start = (meta.page - 1) * size + 1;
  const end = Math.min(meta.page * size, meta.totalResults);

  const emptyBlock = `
    <div class="bg-white rounded-none border border-gray-100 p-12 sm:p-20 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-gray-100 mx-auto mb-6">${P.gem}</svg>
      <h3 class="text-xl font-heading font-normal uppercase tracking-widest text-gray-900 mb-2">Արդյունքներ չեն գտնվել</h3>
      <p class="text-xs text-gray-400 mb-8 uppercase tracking-widest">Փորձեք փոխել ֆիլտրները կամ ավելացնել նոր ապրանքը</p>
      <a href="#/products/new" class="inline-flex items-center gap-3 px-8 py-4 bg-primary text-luxe-black font-bold rounded-none transition-all text-[11px] uppercase tracking-[0.3em] shadow-lg">${svg(P.plus, { size: 20, sw: 2.5 })} Ավելացնել առաջին Զարդը</a>
    </div>`;

  ctx.container().innerHTML = `
    <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        <div class="flex-1 w-full">
          <form id="p-filter" class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-gray-400">${svg(P.search, { size: 20, sw: 2 })}</div>
              <input type="text" name="search" value="${esc(search)}" placeholder="Փնտրել անունով, նկարագրությամբ..." class="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm uppercase tracking-wide"/>
            </div>
            <select name="category" class="px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm uppercase tracking-wide font-bold">
              <option value="">Բոլորը</option>
              ${CATEGORIES.map(([v, l]) => `<option value="${v}" ${category === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button type="submit" class="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-900 bg-gray-900 hover:bg-white hover:text-gray-900 text-white font-bold rounded-none transition-all text-[10px] uppercase tracking-widest">Ֆիլտրել</button>
          </form>
        </div>
        <a href="#/products/new" class="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary hover:bg-luxe-black text-luxe-black hover:text-primary font-bold rounded-none transition-all shadow-md text-[10px] uppercase tracking-widest">${svg(P.plus, { size: 18, sw: 2.5 })} Ավելացնել Զարդ</a>
      </div>
    </div>

    ${data.items.length ? `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
        ${data.items.map((it) => `
          <div class="bg-white relative rounded-none border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
            <a href="/product/${esc(it.slug)}" target="_blank" class="block">
              ${it.image
                ? `<div class="aspect-square overflow-hidden bg-gray-50"><img src="${it.image}" alt="${esc(it.name)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/></div>`
                : `<div class="aspect-square bg-gray-50 flex items-center justify-center text-gray-200">${svg(P.gem, { size: 40, sw: 1.5 })}</div>`}
            </a>
            <div class="p-4 sm:p-6">
              <div class="flex items-start justify-between mb-3 gap-2">
                <div class="flex-1 min-w-0">
                  <h3 class="font-heading font-normal text-gray-900 truncate text-[15px] uppercase tracking-wide group-hover:text-primary transition-colors"><a href="/product/${esc(it.slug)}" target="_blank">${esc(it.name)}</a></h3>
                </div>
                ${it.isPopular ? '<span class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 border border-primary text-primary text-[9px] font-bold uppercase tracking-widest">Featured</span>' : ''}
                ${!it.isActive ? '<span class="absolute top-4 left-4 inline-flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-md text-gray-400 text-[10px] font-bold uppercase tracking-widest border border-gray-100">Ապակտիվ</span>' : ''}
              </div>
              ${it.description ? `<p class="text-[11px] text-gray-400 mb-4 leading-relaxed font-light line-clamp-2">${esc(it.description)}</p>` : ''}
              <div class="flex items-center justify-between mb-5">
                <p class="text-xl font-heading font-normal text-primary tabular-nums">${it.price} <span class="text-[10px] text-gray-400 uppercase tracking-widest ml-1">AMD</span></p>
                <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">${esc(it.categoryDisplay)}</span>
              </div>
              <div class="flex gap-2">
                <a href="#/products/${it.id}" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-900 bg-gray-900 text-white hover:bg-white hover:text-gray-900 font-bold transition-all text-[10px] uppercase tracking-widest">${svg(P.pencil, { size: 14, sw: 2 })} Խմբագրել</a>
                <button data-del="${it.id}" data-name="${esc(it.name)}" class="inline-flex items-center justify-center px-4 py-2.5 border border-red-100 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold transition-all">${svg(P.trash, { size: 14, sw: 2 })}</button>
              </div>
            </div>
          </div>`).join('')}
      </div>` : emptyBlock}

    ${meta.totalPages > 1 ? `
      <div class="bg-white rounded-none border border-gray-200 shadow-sm p-6">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p class="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Ցուցադրվում է <span class="text-gray-900">${start}</span> - <span class="text-gray-900">${end}</span>-ը՝ ընդհանուր <span class="text-gray-900">${meta.totalResults}</span>-ից</p>
          ${pagerButtons(meta)}
        </div>
      </div>` : ''}`;

  const form = document.getElementById('p-filter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (form.search.value) qs.set('search', form.search.value);
    if (form.category.value) qs.set('category', form.category.value);
    ctx.navigate(`#/products/page/1${qs.toString() ? '?' + qs : ''}`);
  });
  bindPages(ctx, (p) => {
    const qs = new URLSearchParams({ page: p });
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    ctx.navigate(`#/products/page/${p === '1' ? '1' : p}?${qs.toString()}`);
  });
  ctx.container().querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirmDialog(`Համոզվա՞ծ եք, որ ցանկանում եք ջնջել «${btn.dataset.name}»-ը։`)) return;
      await del(`/admin/products/${btn.dataset.del}`);
      toast('Զարդը ջնջվեց');
      productsList(ctx, meta.page);
    });
  });
}

export async function productForm(ctx, id) {
  ctx.title(id ? 'Խմբագրել Զարդ' : 'Նոր Զարդ', 'Կատալոգ');
  const existing = id ? (await get(`/admin/products/${id}`)).item : null;
  const imageEntries = [];
  const seenImagePaths = new Set();
  if (existing?.image) {
    imageEntries.push({ key: 'main', type: 'main', image: existing.image });
    seenImagePaths.add(existing.image);
  }
  (existing?.images || [])
    .slice()
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .forEach((image) => {
      if (seenImagePaths.has(image.image)) return;
      seenImagePaths.add(image.image);
      imageEntries.push({
        key: `existing-${image.id}`,
        type: 'existing',
        id: image.id,
        image: image.image,
      });
    });

  const materialChecks = MATERIALS.map(
    ([v, l]) => `<label class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
      <input type="checkbox" name="available_materials" value="${v}" ${existing && existing.availableMaterials.includes(v) ? 'checked' : ''} class="accent-primary"/> ${l}</label>`
  ).join('');

  ctx.container().innerHTML = `
    <form id="product-form" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white border border-gray-100 p-6 space-y-5">
          <h3 class="font-heading text-lg uppercase tracking-tight">Հիմնական</h3>
          <div><label class="lbl">Անուն *</label><input name="name" required value="${esc(existing?.name || '')}" class="inp"/></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="lbl">Կատեգորիա</label><select name="category" class="inp">${opts(CATEGORIES, existing?.category)}</select></div>
            <div><label class="lbl">Գնի տեսակ</label><select name="price_type" class="inp">${opts([['fixed', 'Ֆիքսված'], ['per_gram', 'Գրամով']], existing?.priceType)}</select></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="lbl">Գին (֏) *</label><input name="price" type="number" step="1" required value="${existing?.price ?? ''}" class="inp"/></div>
            <div><label class="lbl">Պատրաստման օր</label><input name="preparation_days" type="number" value="${existing?.preparationDays ?? 7}" class="inp"/></div>
          </div>
          <div><label class="lbl">Նկարագրություն</label><textarea name="description" rows="4" class="inp">${esc(existing?.description || '')}</textarea></div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label class="lbl">Մետաղ</label><input name="material_karat" value="${esc(existing?.materialKarat || '')}" class="inp"/></div>
            <div><label class="lbl">Քար</label><input name="gemstone" value="${esc(existing?.gemstone || '')}" class="inp"/></div>
            <div><label class="lbl">Չափեր</label><input name="dimensions" value="${esc(existing?.dimensions || '')}" class="inp"/></div>
          </div>
          <div><label class="lbl">Try-on image (PNG)</label><input name="try_on_asset" value="${esc(existing?.tryOnAsset || '')}" class="inp" placeholder="/uploads/..."/></div>
          <div class="space-y-2">
            <label class="lbl">3D մոդել (GLB)</label>
            <input name="model_3d" value="${esc(existing?.model3d || '')}" class="inp" placeholder="/uploads/models/...glb"/>
            <input name="model_3d_file" type="file" accept=".glb,model/gltf-binary" class="text-xs"/>
            <p class="text-[10px] text-gray-400">Վերբեռնված GLB ֆայլը կփոխարինի վերևի հղմանը։ Առավելագույնը՝ 80 ՄԲ։</p>
          </div>
          <div class="flex flex-wrap gap-6 pt-2">
            <label class="cbx"><input type="checkbox" name="is_active" ${!existing || existing.isActive ? 'checked' : ''}/> Ակտիվ</label>
            <label class="cbx"><input type="checkbox" name="is_popular" ${existing?.isPopular ? 'checked' : ''}/> Հայտնի</label>
            <label class="cbx"><input type="checkbox" name="is_new" ${existing?.isNew ? 'checked' : ''}/> Նոր</label>
            <label class="cbx"><input type="checkbox" name="allows_custom_text" ${!existing || existing.allowsCustomText ? 'checked' : ''}/> Անհատական գրություն</label>
          </div>
          <div><label class="lbl">Հասանելի մետաղներ</label><div class="flex flex-wrap gap-4 mt-2">${materialChecks}</div></div>
        </div>

        <div class="bg-white border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-heading text-lg uppercase tracking-tight">Չափեր / Տարբերակներ</h3>
            <button type="button" id="add-variant" class="text-primary text-[10px] font-bold uppercase tracking-widest hover:underline">+ Ավելացնել</button>
          </div>
          <div id="variants" class="space-y-3"></div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white border border-gray-100 p-6 space-y-4">
          <h3 class="font-heading text-lg uppercase tracking-tight">Նկարներ</h3>
          <label class="lbl" for="product-images">Ավելացնել նկարներ (մինչև 5)</label>
          <input id="product-images" type="file" accept="image/*" multiple class="text-xs"/>
          <p id="gallery-count" class="text-[10px] text-gray-400">Առաջին նկարը կլինի հիմնականը․ քաշեք նկարները՝ հերթականությունը փոխելու համար։</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2" id="gallery"></div>
        </div>
        <div class="bg-white border border-gray-100 p-6 space-y-3">
          <button type="submit" class="w-full py-4 bg-luxe-black text-primary text-[11px] font-bold uppercase tracking-[0.3em] hover:bg-primary hover:text-luxe-black transition-colors">Պահպանել</button>
          <a href="#/products" class="block text-center py-3 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-gray-900">Չեղարկել</a>
        </div>
      </div>
    </form>`;

  const variantsHost = document.getElementById('variants');
  const galleryHost = document.getElementById('gallery');
  const imageInput = document.getElementById('product-images');
  const galleryCount = document.getElementById('gallery-count');
  const renderGallery = () => {
    galleryHost.innerHTML = imageEntries.map((entry, index) => `
      <div class="relative border border-gray-100 bg-white" data-gallery-item data-key="${esc(entry.key)}" data-type="${entry.type}" ${entry.id ? `data-id="${entry.id}"` : ''}>
        <img src="${esc(entry.preview || entry.image)}" alt="" class="w-full aspect-square object-cover bg-gray-50 pointer-events-none"/>
        <span data-image-role class="absolute left-1 top-1 bg-luxe-black/85 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-primary">${index === 0 ? 'Հիմնական' : 'Նկար'}</span>
        <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/95 px-2 py-1">
          <button type="button" data-drag-image aria-label="Տեղափոխել նկարը" class="cursor-grab px-2 text-gray-400 active:cursor-grabbing">⠿</button>
          <button type="button" data-remove-image aria-label="Հեռացնել նկարը" class="px-2 text-red-500">×</button>
        </div>
      </div>`).join('');
    galleryCount.textContent = `${imageEntries.length}/5 նկար․ առաջին նկարը կլինի հիմնականը, քաշեք՝ հերթականությունը փոխելու համար։`;
    imageInput.disabled = imageEntries.length >= 5;
    galleryHost.querySelectorAll('[data-image-role]').forEach((badge, index) => {
      badge.textContent = index === 0 ? 'Հիմնական' : 'Նկար';
    });
  };
  renderGallery();
  if (!window.Sortable) throw new Error('SortableJS failed to load; product image ordering is unavailable.');
  new window.Sortable(galleryHost, {
    animation: 150,
    draggable: '[data-gallery-item]',
    handle: '[data-drag-image]',
    onEnd: () => {
      const entriesByKey = new Map(imageEntries.map((entry) => [entry.key, entry]));
      const reordered = [...galleryHost.querySelectorAll('[data-gallery-item]')]
        .map((card) => entriesByKey.get(card.dataset.key))
        .filter(Boolean);
      imageEntries.splice(0, imageEntries.length, ...reordered);
      renderGallery();
    },
  });
  imageInput.addEventListener('change', () => {
    const selected = [...imageInput.files];
    const remaining = Math.max(0, 5 - imageEntries.length);
    if (selected.length > remaining) {
      toast('Կարող եք ունենալ առավելագույնը 5 նկար։', 'error');
    }
    selected.slice(0, remaining).forEach((file) => imageEntries.push({
      key: `new-${crypto.randomUUID()}`,
      type: 'new',
      file,
      preview: URL.createObjectURL(file),
    }));
    imageInput.value = '';
    renderGallery();
  });
  galleryHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;
    const card = button.closest('[data-gallery-item]');
    const index = imageEntries.findIndex((entry) => entry.key === card.dataset.key);
    if (index < 0) return;
    if (imageEntries[index].preview) URL.revokeObjectURL(imageEntries[index].preview);
    imageEntries.splice(index, 1);
    renderGallery();
  });

  const addVariantRow = (v = {}) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 sm:grid-cols-5 gap-2 items-center variant-row';
    row.innerHTML = `
      <input type="hidden" data-v="id" value="${v.id || ''}"/>
      <input data-v="size" value="${esc(v.size || '')}" placeholder="Չափ" class="inp text-xs"/>
      <input data-v="weight" type="number" step="0.01" value="${v.weight ?? ''}" placeholder="Քաշ" class="inp text-xs"/>
      <input data-v="price" type="number" value="${v.price ?? ''}" placeholder="Գին" class="inp text-xs"/>
      <input data-v="stock" type="number" value="${v.stock ?? 0}" placeholder="Պահեստ" class="inp text-xs"/>
      <button type="button" class="text-red-400 text-lg">×</button>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    variantsHost.appendChild(row);
  };
  (existing?.variants || []).forEach(addVariantRow);
  document.getElementById('add-variant').addEventListener('click', () => addVariantRow());

  const form = document.getElementById('product-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', form.name.value);
    fd.append('category', form.category.value);
    fd.append('price_type', form.price_type.value);
    fd.append('price', form.price.value);
    fd.append('preparation_days', form.preparation_days.value);
    fd.append('description', form.description.value);
    fd.append('material_karat', form.material_karat.value);
    fd.append('gemstone', form.gemstone.value);
    fd.append('dimensions', form.dimensions.value);
    fd.append('try_on_asset', form.try_on_asset.value);
    fd.append('model_3d', form.model_3d.value);
    if (form.model_3d_file.files[0]) fd.append('model_3d_file', form.model_3d_file.files[0]);
    fd.append('is_active', form.is_active.checked);
    fd.append('is_popular', form.is_popular.checked);
    fd.append('is_new', form.is_new.checked);
    fd.append('allows_custom_text', form.allows_custom_text.checked);
    fd.append('available_materials', JSON.stringify([...form.querySelectorAll('input[name=available_materials]:checked')].map((c) => c.value)));

    const variants = [...variantsHost.querySelectorAll('.variant-row')].map((r) => ({
      id: r.querySelector('[data-v=id]').value || undefined,
      size: r.querySelector('[data-v=size]').value,
      weight: r.querySelector('[data-v=weight]').value,
      price: r.querySelector('[data-v=price]').value,
      stock: r.querySelector('[data-v=stock]').value,
      is_available: true,
    })).filter((v) => v.price !== '');
    fd.append('variants', JSON.stringify(variants));

    const imagesData = [];
    galleryHost.querySelectorAll('[data-gallery-item]').forEach((card) => {
      const entry = imageEntries.find((image) => image.key === card.dataset.key);
      if (!entry) return;
      if (entry.type === 'new') {
        const index = imagesData.filter((image) => image.type === 'new').length;
        fd.append('additional_images', entry.file);
        imagesData.push({ type: 'new', index });
      } else if (entry.type === 'existing') {
        imagesData.push({ type: 'existing', id: entry.id });
      } else {
        imagesData.push({ type: 'main' });
      }
    });
    fd.append('images_data', JSON.stringify(imagesData));

    try {
      const res = await fetch(`/api/admin/products${existing ? '/' + existing.id : ''}`, {
        method: existing ? 'PUT' : 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Սխալ');
      toast(data.message || 'Պահպանվեց');
      ctx.navigate('#/products');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ── Hero slides ───────────────────────────────────────────────────────
export async function hero(ctx) {
  ctx.title('Գլխավոր Սլայդեր', 'Կառավարեք կայքի գլխավոր էջի մեծ նկարները');
  const data = await get('/admin/hero');
  const s = data.settings;

  const slideModal = (slide) => {
    const isEdit = !!slide;
    const m = modal({
      title: isEdit ? `Խմբագրել Սլայդ #${slide.id}` : 'Նոր Սլայդ',
      body: `
        <div class="space-y-5">
          <div><label class="lbl">Վերնագիր</label><input id="s-title" value="${esc(slide?.title || '')}" class="inp" placeholder="Սլայդի վերնագիր"/></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="lbl">Հերթականություն</label><input id="s-order" type="number" value="${slide?.order ?? 0}" class="inp"/></div>
            <div class="flex items-end pb-3"><label class="cbx"><input id="s-active" type="checkbox" ${!slide || slide.isActive ? 'checked' : ''}/> Ակտիվ</label></div>
          </div>
          <div>
            <label class="lbl">Նկար ${isEdit ? '(ըստ ցանկության)' : '*'}</label>
            ${slide?.image ? `<img src="${slide.image}" class="w-full aspect-[16/9] object-cover bg-gray-50 mb-2"/>` : ''}
            <input id="s-image" type="file" accept="image/*" class="text-xs"/>
          </div>
        </div>`,
      footer: `
        <button data-close class="px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50">Չեղարկել</button>
        <button id="s-save" class="px-8 py-3 bg-luxe-black text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-luxe-black transition-colors">Պահպանել</button>`,
    });
    m.el.querySelector('#s-save').addEventListener('click', async () => {
      const fd = new FormData();
      fd.append('title', m.el.querySelector('#s-title').value);
      fd.append('order', m.el.querySelector('#s-order').value);
      fd.append('is_active', m.el.querySelector('#s-active').checked);
      const f = m.el.querySelector('#s-image').files[0];
      if (f) fd.append('image', f);
      try {
        const res = await fetch(`/api/admin/hero/slides${isEdit ? '/' + slide.id : ''}`, { method: isEdit ? 'PUT' : 'POST', body: fd, credentials: 'include' });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Սխալ');
        toast(r.message || 'Պահպանվեց');
        m.close();
        hero(ctx);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  };

  ctx.container().innerHTML = `
    <div class="mb-8 flex justify-end">
      <button id="add-slide" class="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-primary text-luxe-black hover:bg-luxe-black hover:text-primary font-bold uppercase tracking-[0.4em] text-[10px] transition-all shadow-xl">${svg(P.plus, { size: 18, sw: 3 })} Ավելացնել Սլայդ</button>
    </div>

    <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden mb-12">
      <div class="p-6 border-b border-gray-100 bg-gray-50">
        <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Գլխավոր էջի տեքստ (Hero Text)</h3>
      </div>
      <div class="p-6 md:p-8">
        <form id="hero-settings">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div><label class="lbl">Վերնագիր (Տող 1)</label><input name="title_line1" value="${esc(s.titleLine1 || '')}" class="inp"/></div>
            <div><label class="lbl">Գունավոր Վերնագիր (Տող 2)</label><input name="title_highlight" value="${esc(s.titleHighlight || '')}" class="inp"/></div>
          </div>
          <div class="mb-8"><label class="lbl">Նկարագրություն</label><textarea name="description" rows="3" class="inp">${esc(s.description || '')}</textarea></div>
          <button type="submit" class="px-8 py-4 bg-luxe-gold text-luxe-black hover:bg-luxe-black hover:text-luxe-gold font-bold uppercase tracking-[0.2em] text-[10px] transition-all">Պահպանել Տեքստը</button>
        </form>
      </div>
    </div>

    <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-gray-100"><h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Ակտիվ Սլայդեր</h3></div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-gray-100">
        ${data.slides.map((sl) => `
          <div class="group relative bg-white">
            <div class="aspect-[16/9] overflow-hidden bg-gray-50">
              ${sl.image ? `<img src="${sl.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"/>` : ''}
            </div>
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Սլայդ #${sl.id}</span>
                ${sl.isActive
                  ? '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-500 text-[8px] font-bold uppercase tracking-widest border border-emerald-100">Ակտիվ</span>'
                  : '<span class="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-bold uppercase tracking-widest border border-gray-100">Պասիվ</span>'}
              </div>
              <h4 class="font-heading font-normal text-gray-900 text-lg uppercase tracking-wide truncate mb-1">${esc(sl.title || 'Առանց Վերնագրի')}</h4>
              <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-6">Հերթականություն: ${sl.order}</p>
              <div class="flex items-center gap-3">
                <button data-edit="${sl.id}" class="flex-1 py-3 border border-gray-100 text-gray-400 font-bold uppercase tracking-widest text-[9px] text-center hover:text-primary hover:border-primary transition-all">Խմբագրել</button>
                <button data-del="${sl.id}" class="px-4 py-3 bg-red-50 text-red-400 hover:bg-red-400 hover:text-white transition-all">${svg(P.trash, { size: 14, sw: 2.5 })}</button>
              </div>
            </div>
          </div>`).join('') || '<div class="col-span-full p-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Սլայդեր չկան</p></div>'}
      </div>
    </div>`;

  document.getElementById('add-slide').addEventListener('click', () => slideModal(null));
  ctx.container().querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => slideModal(data.slides.find((x) => String(x.id) === b.dataset.edit))));
  ctx.container().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirmDialog('Համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս սլայդը։')) return;
    await del(`/admin/hero/slides/${b.dataset.del}`);
    toast('Սլայդը հեռացվեց');
    hero(ctx);
  }));
  document.getElementById('hero-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await put('/admin/hero/settings', { title_line1: f.title_line1.value, title_highlight: f.title_highlight.value, description: f.description.value });
    toast('Գլխավոր էջի տեքստը թարմացվեց');
  });
}

// ── Orders ────────────────────────────────────────────────────────────
export async function ordersList(ctx, page = 1) {
  ctx.title('Պատվերներ', 'Բոլոր պատվերների կառավարում');
  const q = hashQuery();
  const search = q.get('search') || '';
  const status = q.get('status') || '';
  const params = new URLSearchParams({ page });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const data = await get(`/admin/orders?${params}`);
  const meta = data.pagination;

  const deliveryChip = (o) => (o.deliveryType === 'delivery'
    ? `<span class="px-2 py-1 bg-blue-50 text-blue-600 text-[8px] font-bold uppercase tracking-widest border border-blue-100 flex items-center gap-1.5">${svg(P.truck, { size: 10, sw: 3 })} Առաքում</span>`
    : `<span class="px-2 py-1 bg-gray-50 text-gray-400 text-[8px] font-bold uppercase tracking-widest border border-gray-100 flex items-center gap-1.5">${svg(P.store, { size: 10, sw: 3 })} Սրահից</span>`);

  ctx.container().innerHTML = `
    <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
      <form id="o-filter" class="flex flex-col sm:flex-row gap-3">
        <input type="text" name="search" value="${esc(search)}" placeholder="Որոնել անունով կամ հեռախոսով..." class="flex-1 border border-gray-200 rounded-none px-4 py-3 text-[10px] uppercase tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"/>
        <select name="status" class="border border-gray-200 rounded-none px-4 py-3 text-[10px] uppercase tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white">
          <option value="">Բոլորը</option>
          ${data.statusChoices.map((c) => `<option value="${c.value}" ${status === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
        <button type="submit" class="inline-flex items-center justify-center gap-2 px-8 py-3 bg-luxe-black text-primary hover:bg-primary hover:text-luxe-black rounded-none text-[10px] uppercase tracking-[0.3em] font-bold transition-all shadow-lg">${svg(P.search, { size: 16, sw: 2.5 })} Որոնել</button>
        ${search || status ? '<button type="button" id="o-clear" class="inline-flex items-center justify-center gap-2 px-8 py-3 border border-gray-200 text-gray-400 rounded-none text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-gray-50 transition-all">Մաքրել</button>' : ''}
      </form>
    </div>

    <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Պատվերների Ցանկ
          ${data.newOrdersCount ? `<span class="ml-2 text-[9px] font-bold bg-primary text-luxe-black px-2 py-0.5 uppercase tracking-widest">${data.newOrdersCount} նոր</span>` : ''}
        </h3>
        <span class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">${meta.totalResults} ընդամենը</span>
      </div>

      <div class="block lg:hidden divide-y divide-gray-50">
        ${data.orders.map((o) => `
          <div class="p-4 space-y-4 bg-white hover:bg-gray-50 transition-colors">
            <div class="flex justify-between items-start">
              <div class="space-y-1">
                <span class="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">#${o.id}</span>
                <h4 class="font-heading font-normal text-gray-900 text-base uppercase tracking-wide">${esc(o.fullName)}</h4>
                <a href="tel:${esc(o.phone)}" class="text-[11px] text-primary font-bold tracking-widest">${esc(o.phone)}</a>
              </div>
              <div class="text-right">
                <p class="font-heading font-normal text-gray-900 text-lg tabular-nums">${o.total} <span class="text-[9px] text-gray-400 uppercase">AMD</span></p>
                <span class="text-[9px] text-gray-300 uppercase tracking-widest font-bold">${fDmyTime(o.createdAt)}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-3 pt-2">
              <div class="flex items-center gap-2">
                ${deliveryChip(o)}
                <span class="px-2 py-1 bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-widest border border-primary/20">${esc(o.paymentMethodDisplay)}</span>
              </div>
              <div class="flex items-center gap-3">
                ${o.paymentMethod !== 'cash' ? `<button data-paid="${o.id}" data-val="${!o.isPaid}" class="px-2 py-1 text-[8px] font-bold uppercase tracking-widest border transition-all ${o.isPaid ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}">${o.isPaid ? 'Վճարված' : 'Չվճարված'}</button>` : ''}
                <a href="#/orders/${o.id}" class="w-10 h-10 bg-luxe-black text-primary flex items-center justify-center hover:bg-primary hover:text-luxe-black transition-all shadow-md">${svg(P.chevronRight, { size: 14, sw: 3 })}</a>
              </div>
            </div>
          </div>`).join('') || '<div class="p-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Պատվերներ չկան</p></div>'}
      </div>

      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100"><tr>
            ${['ID', 'Հաճախորդ', 'Եղանակ', 'Վճարում', 'Վճարված', 'Գումար', 'Կարգավիճակ', 'Ամսաթիվ'].map((h) => `<th class="text-left px-8 py-5 text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">${h}</th>`).join('')}
            <th class="px-8 py-5"></th>
          </tr></thead>
          <tbody class="divide-y divide-gray-50">
            ${data.orders.map((o) => `
              <tr class="hover:bg-gray-50/50 transition-colors group">
                <td class="px-8 py-6"><span class="text-[10px] font-bold text-gray-300 uppercase tracking-widest">#${o.id}</span></td>
                <td class="px-8 py-6">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-bold text-sm">${initial(o.fullName)}</div>
                    <div>
                      <h4 class="font-heading font-normal text-gray-900 text-base uppercase tracking-wide leading-none mb-1">${esc(o.fullName)}</h4>
                      <a href="tel:${esc(o.phone)}" class="text-[10px] text-gray-400 font-bold tracking-widest hover:text-primary transition-colors">${esc(o.phone)}</a>
                    </div>
                  </div>
                </td>
                <td class="px-8 py-6">${o.deliveryType === 'delivery'
                  ? `<span class="inline-flex items-center gap-2 text-[10px] text-blue-500 font-bold uppercase tracking-widest">${svg(P.truck, { size: 12, sw: 2.5 })} Առաքում</span>`
                  : `<span class="inline-flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">${svg(P.store, { size: 12, sw: 2.5 })} Սրահից</span>`}</td>
                <td class="px-8 py-6"><span class="text-[9px] font-bold uppercase tracking-widest text-gray-400">${esc(o.paymentMethodDisplay)}</span></td>
                <td class="px-8 py-6">${o.paymentMethod !== 'cash'
                  ? `<button data-paid="${o.id}" data-val="${!o.isPaid}" class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border transition-all ${o.isPaid ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}">${o.isPaid ? 'Վճարված' : 'Չվճարված'}</button>` : ''}</td>
                <td class="px-8 py-6"><span class="font-heading font-normal text-primary text-xl tabular-nums">${o.total} <span class="text-[9px] text-gray-400 uppercase ml-1">AMD</span></span></td>
                <td class="px-8 py-6">
                  <select data-ostatus="${o.id}" class="text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 border border-gray-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-all ${STATUS_SELECT[o.status] || 'bg-red-50 text-red-600'}">
                    ${data.statusChoices.map((c) => `<option value="${c.value}" ${o.status === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                  </select>
                </td>
                <td class="px-8 py-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">${fDmyTime(o.createdAt)}</td>
                <td class="px-8 py-6 text-right"><a href="#/orders/${o.id}" class="inline-flex items-center gap-2 text-[10px] text-luxe-black hover:text-primary font-bold uppercase tracking-[0.3em] transition-colors">Դիտել ${svg(P.chevronRight, { size: 14, sw: 2.5 })}</a></td>
              </tr>`).join('') || '<tr><td colspan="9" class="px-8 py-20 text-center"><p class="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold">Պատվերներ չկան</p></td></tr>'}
          </tbody>
        </table>
      </div>

      ${meta.totalPages > 1 ? `
        <div class="px-8 py-8 border-t border-gray-100 flex flex-col lg:flex-row items-center justify-between gap-6">
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ցուցադրված է ${(meta.page - 1) * 15 + 1}–${Math.min(meta.page * 15, meta.totalResults)} պատվերները (${meta.totalResults}-ից)</p>
          ${pagerButtons(meta)}
        </div>` : ''}
    </div>`;

  const form = document.getElementById('o-filter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (form.search.value) qs.set('search', form.search.value);
    if (form.status.value) qs.set('status', form.status.value);
    ctx.navigate(`#/orders/page/1${qs.toString() ? '?' + qs : ''}`);
  });
  const clear = document.getElementById('o-clear');
  if (clear) clear.addEventListener('click', () => ctx.navigate('#/orders/page/1'));
  bindPages(ctx, (p) => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    ctx.navigate(`#/orders/page/${p}${qs.toString() ? '?' + qs : ''}`);
  });
  ctx.container().querySelectorAll('[data-ostatus]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      sel.className = sel.className.replace(/bg-\w+-50 text-\w+-600/g, '');
      sel.classList.add(...(STATUS_SELECT[sel.value] || '').split(' '));
      try {
        const r = await put(`/admin/orders/${sel.dataset.ostatus}`, { status: sel.value });
        toast(r.message || 'Թարմացվեց');
      } catch (e) {
        toast(e.message, 'error');
        ordersList(ctx, meta.page);
      }
    });
  });
  ctx.container().querySelectorAll('[data-paid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const r = await put(`/admin/orders/${btn.dataset.paid}`, { is_paid: btn.dataset.val === 'true' });
        toast(r.message || 'Թարմացվեց');
        ordersList(ctx, meta.page);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
}

export async function orderDetail(ctx, id) {
  const data = await get(`/admin/orders/${id}`);
  const o = data.order;
  const menuItems = data.menuItems;
  ctx.title(`Պատվեր #${o.id}`, `${o.fullName} — ${fDmyTime(o.createdAt)}`);

  const payDisplay = o.paymentMethod === 'cash' ? 'Կանխիկ' : o.paymentMethod === 'card' ? 'Քարտ (POS)' : o.paymentMethod === 'idram' ? 'Idram' : o.paymentMethodDisplay;

  ctx.container().innerHTML = `
    <div class="lg:hidden mb-6">
      <a href="#/orders" class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 hover:text-primary transition-colors">${svg(P.chevronLeft, { size: 16, sw: 3 })} Վերադառնալ</a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-8">
        <div class="bg-white rounded-none border border-gray-200 shadow-sm overflow-hidden">
          <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Պատվիրված Զարդեր</h3>
            <span class="px-3 py-1 bg-gray-50 text-gray-400 text-[9px] font-bold uppercase tracking-widest border border-gray-100">${o.items.length} Զարդ</span>
          </div>
          <div class="divide-y divide-gray-50">
            ${o.items.map((item) => `
              <div class="p-6 hover:bg-gray-50 transition-colors group">
                <div class="flex gap-6">
                  <img src="/uploads/${menuItems.find(m => m.id === item.menuItemId)?.image || ''}" alt="${esc(item.name)}" class="w-24 h-24 sm:w-32 sm:h-32 rounded-none overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100 shadow-sm" />
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <h4 class="font-heading font-normal text-gray-900 text-lg sm:text-xl uppercase tracking-wide">${esc(item.name)}</h4>
                        <p class="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-1.5">Կատեգորիա</p>
                      </div>
                      <div class="text-left sm:text-right">
                        <p class="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1 tabular-nums">${item.price} ֏ / հատ</p>
                        <p class="text-xl font-heading font-normal text-primary tabular-nums">${item.subtotal} ֏</p>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      ${item.weight ? `<div class="p-3 bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center"><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Քաշ</span><span class="text-[11px] font-bold text-gray-700 uppercase tracking-wide">${item.weight} գր․</span></div>` : ''}
                      ${item.material ? `<div class="p-3 bg-primary/5 border border-primary/10 flex flex-col items-center justify-center text-center"><span class="text-[8px] font-bold text-primary uppercase tracking-widest mb-1">Մետաղ</span><span class="text-[11px] font-bold text-luxe-black uppercase tracking-wide">${esc(item.materialDisplay)}</span></div>` : ''}
                      ${item.size ? `<div class="p-3 bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center"><span class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Չափս</span><span class="text-[11px] font-bold text-gray-700">${esc(item.size)}</span></div>` : ''}
                    </div>
                    ${item.customText ? `
                      <div class="mt-4 p-4 bg-gray-900 border-l-4 border-primary">
                        <div class="flex items-center gap-2 mb-2">${svg(P.editText, { size: 12, sw: 3, cls: 'text-primary' })}<span class="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Փորագրություն</span></div>
                        <p class="text-sm font-heading font-normal text-white italic tracking-wide">"${esc(item.customText)}"</p>
                      </div>` : ''}
                    ${item.note ? `<div class="mt-4 flex items-start gap-2 text-gray-400"><span class="text-[11px] font-medium leading-relaxed italic">📝 ${esc(item.note)}</span></div>` : ''}
                  </div>
                </div>
              </div>`).join('')}
          </div>
          <div class="p-8 bg-gray-50 border-t border-gray-100">
            <p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Ապրանքներ</p>
            <p class="text-xl font-heading font-normal text-gray-500 tabular-nums">${o.total - o.deliveryPrice} ֏</p>
            <p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-2">Առաքում</p>
            <p class="text-xl font-heading font-normal text-gray-500 tabular-nums">${o.deliveryPrice} ֏</p>
            <p class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mt-4">Ընդհանուր Գումար</p>
            <p class="text-4xl font-heading font-normal text-primary tracking-tight tabular-nums">${o.total} <span class="text-sm text-gray-400 uppercase tracking-widest ml-1">AMD</span></p>
          </div>
        </div>

        <div class="space-y-8">
          ${o.orderNote ? `
            <div class="bg-gray-900 border-l-4 border-primary p-8 relative overflow-hidden group">
              <h3 class="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-4 relative z-10">Ծանոթագրություն</h3>
              <p class="text-white text-lg font-heading font-normal leading-relaxed relative z-10 italic">"${esc(o.orderNote)}"</p>
            </div>` : ''}
          ${o.deliveryType === 'delivery' && o.address ? `
            <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8 overflow-hidden relative group">
              <div class="absolute -right-8 -bottom-8 text-gray-50 opacity-20 group-hover:scale-110 transition-transform duration-1000">${svg(P.mapPin, { size: 160, sw: 1 })}</div>
              <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900 mb-6 flex items-center gap-3 relative z-10">${svg(P.mapPin, { size: 20, sw: 2.5, cls: 'text-primary' })} Առաքման Հասցե</h3>
              <p class="text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-2">${esc(o.city || '')}</p>
              <p class="text-gray-900 font-heading font-normal text-2xl leading-relaxed relative z-10">${esc(o.address)}</p>
            </div>` : ''}
        </div>
      </div>

      <div class="space-y-8">
        <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8 overflow-hidden">
          <h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mb-8">Հաճախորդ</h3>
          <div class="flex items-center gap-5 mb-8">
            <div class="w-16 h-16 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-heading text-3xl">${initial(o.fullName)}</div>
            <div>
              <p class="font-heading font-normal text-gray-900 text-2xl uppercase tracking-tight leading-none mb-2">${esc(o.fullName)}</p>
              <a href="tel:${esc(o.phone)}" class="text-[11px] font-bold text-primary tracking-widest flex items-center gap-2">${svg(P.phone, { size: 14, sw: 3 })} ${esc(o.phone)}</a>
            </div>
          </div>
          <div class="space-y-4 pt-8 border-t border-gray-100">
            ${o.email ? `<div class="flex justify-between items-center"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Էլ. փոստ</span><a href="mailto:${esc(o.email)}" class="text-[10px] font-bold text-gray-900 hover:text-primary transition-colors truncate ml-4">${esc(o.email)}</a></div>` : ''}
            <div class="flex justify-between items-center"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Ստացում</span><span class="text-[10px] font-bold text-gray-900 uppercase tracking-widest">${esc(o.deliveryTypeDisplay)}</span></div>
            ${o.deliveryTime ? `<div class="flex justify-between items-center"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Նախընտրելի ժամ</span><span class="text-[10px] font-bold text-gray-900 uppercase tracking-widest">${esc(o.deliveryTime)}</span></div>` : ''}
            <div class="flex justify-between items-center"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Վճարում</span><span class="text-[10px] font-bold text-primary uppercase tracking-widest">${esc(payDisplay)}</span></div>
            <div class="flex justify-between items-center"><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Ամսաթիվ</span><span class="text-[10px] font-bold text-gray-900 uppercase tracking-widest">${fDmy(o.createdAt)}</span></div>
          </div>
        </div>

        <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8">
          <h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mb-8">Կարգավիճակ</h3>
          <div class="mb-8">
            <span class="inline-flex items-center px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] border ${DETAIL_STATUS[o.status] || DETAIL_STATUS.cancelled}">
              <span class="w-1.5 h-1.5 rounded-full mr-2.5 bg-current"></span>${esc(o.statusDisplay)}
            </span>
          </div>
          <div class="grid grid-cols-1 ${o.paymentMethod !== 'cash' ? 'sm:grid-cols-2' : ''} gap-4">
            ${o.paymentMethod !== 'cash' ? `
              <div class="flex flex-col gap-3"><label class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Վճարման կարգավիճակ</label>
                <span class="w-full px-6 py-4 text-[10px] font-bold uppercase tracking-widest border text-center ${o.isPaid ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}">${o.isPaid ? 'Վճարված' : 'Չվճարված'}</span></div>` : ''}
            <div class="flex flex-col gap-3"><label class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em]">Պատվերի կարգավիճակ</label>
              <div class="relative">
                <select id="d-status" class="w-full appearance-none border border-gray-100 rounded-none px-4 py-4 pr-10 text-[10px] font-bold uppercase tracking-widest text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer">
                  ${data.statusChoices.map((c) => `<option value="${c.value}" ${o.status === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
                <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">${svg(P.chevronDown, { size: 16, sw: 3 })}</div>
              </div></div>
          </div>
          <button id="d-save" class="mt-6 w-full inline-flex items-center justify-center gap-3 px-8 py-5 bg-luxe-black text-primary hover:bg-primary hover:text-luxe-black rounded-none text-[10px] font-bold uppercase tracking-[0.4em] transition-all shadow-lg">${svg(P.check, { size: 16, sw: 3 })} Պահպանել</button>
        </div>

        <a href="#/orders" class="flex items-center justify-center gap-3 px-8 py-5 border border-gray-200 text-gray-400 font-bold rounded-none hover:text-primary hover:border-primary transition-all group uppercase tracking-[0.3em] text-[10px]">${svg(P.chevronLeft, { size: 16, sw: 3, cls: 'group-hover:-translate-x-1 transition-transform duration-200' })} Պատվերների ցանկ</a>

        <div class="pt-8 border-t border-gray-100">
          <button id="d-delete" class="w-full flex items-center justify-center gap-3 px-8 py-4 border border-red-100 text-red-400 hover:bg-red-50 hover:border-red-200 transition-all text-[9px] font-bold uppercase tracking-[0.3em]">${svg(P.trash, { size: 14, sw: 3 })} Ջնջել Պատվերը</button>
        </div>
      </div>
    </div>`;

  document.getElementById('d-save').addEventListener('click', async () => {
    try {
      const r = await put(`/admin/orders/${o.id}`, { status: document.getElementById('d-status').value });
      toast(r.message || 'Թարմացվեց');
      orderDetail(ctx, id);
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  document.getElementById('d-delete').addEventListener('click', async () => {
    if (!confirmDialog('Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս պատվերը։ Այս գործողությունը անդառնալի է։')) return;
    const r = await del(`/admin/orders/${o.id}`);
    toast(r.message || 'Ջնջվեց');
    ctx.navigate('#/orders');
  });
}

// ── Bespoke orders ────────────────────────────────────────────────────
const BESPOKE_LIST_CHIP = {
  new: { label: 'Նոր', cls: 'bg-blue-50 text-blue-500 border-blue-100' },
  contacted: { label: 'Կապ', cls: 'bg-amber-50 text-amber-500 border-amber-100' },
  in_progress: { label: 'Ընթացք', cls: 'bg-purple-50 text-purple-500 border-purple-100' },
  completed: { label: 'Ավարտված', cls: 'bg-emerald-50 text-emerald-500 border-emerald-100' },
};
function bespokeChip(status, small = false) {
  const c = BESPOKE_LIST_CHIP[status] || { label: status, cls: 'bg-gray-50 text-gray-400 border-gray-100' };
  return `<span class="px-2 ${small ? 'py-0.5' : 'py-1'} ${c.cls} text-[8px] font-bold uppercase tracking-widest border">${esc(c.label)}</span>`;
}

export async function bespokeList(ctx, page = 1) {
  ctx.title('Անհատական Պատվերներ', 'Կառավարեք զարդերի անհատական պատրաստման հայտերը');
  const q = hashQuery();
  const search = q.get('search') || '';
  const status = q.get('status') || '';
  const params = new URLSearchParams({ page });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const data = await get(`/admin/bespoke?${params}`);
  const meta = data.pagination;

  const pill = (label, val, active) => `<button data-status="${val}" class="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${active ? 'bg-luxe-black text-primary border-luxe-black' : 'border-gray-200 text-gray-400 hover:border-primary hover:text-primary'} transition-all">${label}</button>`;

  ctx.container().innerHTML = `
    <div class="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      <div class="flex flex-wrap gap-2">
        ${pill('Բոլորը', '', !status)}
        ${data.statusChoices.map((c) => pill(c.label, c.value, status === c.value)).join('')}
      </div>
      <form id="b-search" class="w-full sm:w-auto relative">
        <input type="text" name="search" value="${esc(search)}" placeholder="Փնտրել..." class="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 text-[10px] font-bold uppercase tracking-widest focus:border-primary outline-none transition-all"/>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">${P.search}</svg>
      </form>
    </div>

    <div class="bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div class="hidden lg:block">
        <table class="w-full text-left border-collapse">
          <thead><tr class="bg-gray-50 border-b border-gray-100">
            ${['Հայտ #', 'Հաճախորդ', 'Տեսակ', 'Բյուջե', 'Կարգավիճակ', 'Ամսաթիվ'].map((h) => `<th class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">${h}</th>`).join('')}<th class="px-6 py-4"></th>
          </tr></thead>
          <tbody class="divide-y divide-gray-50">
            ${data.orders.map((b) => `
              <tr class="hover:bg-gray-50/50 transition-colors group">
                <td class="px-6 py-4 text-xs font-bold text-gray-900 tracking-wider">#${b.id}</td>
                <td class="px-6 py-4"><div class="text-xs font-bold text-gray-900 mb-0.5">${esc(b.fullName)}</div><div class="text-[10px] text-gray-400 font-medium">${esc(b.phone)}</div></td>
                <td class="px-6 py-4"><span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">${jewelryLabel(b.jewelryType)}</span></td>
                <td class="px-6 py-4 text-xs font-bold text-gray-900">${esc(b.budgetRange || '')}</td>
                <td class="px-6 py-4">${bespokeChip(b.status)}</td>
                <td class="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">${fDayMonthYear(b.createdAt)}</td>
                <td class="px-6 py-4 text-right"><a href="#/bespoke/${b.id}" class="inline-flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[9px] hover:underline">Դիտել ${svg(P.chevronRight, { size: 12, sw: 3 })}</a></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="lg:hidden divide-y divide-gray-100">
        ${data.orders.map((b) => `
          <div class="p-6 hover:bg-gray-50 transition-colors">
            <div class="flex justify-between items-start mb-4">
              <div><span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">#${b.id}</span><h4 class="text-xs font-bold text-gray-900 mt-1 uppercase tracking-wide">${esc(b.fullName)}</h4></div>
              ${b.status === 'new' || b.status === 'completed' ? bespokeChip(b.status, true) : ''}
            </div>
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div><p class="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1">Տեսակ</p><p class="text-[10px] font-bold text-gray-600 uppercase">${jewelryLabel(b.jewelryType)}</p></div>
              <div><p class="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1">Բյուջե</p><p class="text-[10px] font-bold text-gray-900">${esc(b.budgetRange || '')}</p></div>
            </div>
            <a href="#/bespoke/${b.id}" class="block w-full py-3 bg-gray-50 border border-gray-100 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-primary hover:border-primary transition-all">Մանրամասն</a>
          </div>`).join('')}
      </div>
    </div>

    ${meta.totalPages > 1 ? numberedPager(meta) : ''}`;

  ctx.container().querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    const qs = new URLSearchParams();
    if (b.dataset.status) qs.set('status', b.dataset.status);
    if (search) qs.set('search', search);
    ctx.navigate(`#/bespoke/page/1${qs.toString() ? '?' + qs : ''}`);
  }));
  document.getElementById('b-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = e.target.search.value;
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (val) qs.set('search', val);
    ctx.navigate(`#/bespoke/page/1${qs.toString() ? '?' + qs : ''}`);
  });
  bindPages(ctx, (p) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (search) qs.set('search', search);
    ctx.navigate(`#/bespoke/page/${p}${qs.toString() ? '?' + qs : ''}`);
  });
}

export async function bespokeDetail(ctx, id) {
  const data = await get(`/admin/bespoke/${id}`);
  const b = data.order;
  ctx.title(`Հայտ #${b.id}`, 'Անհատական պատվերի մանրամասներ');

  ctx.container().innerHTML = `
    <div class="max-w-5xl">
      <div class="mb-8">
        <a href="#/bespoke" class="inline-flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] hover:text-primary transition-all">${svg(P.chevronLeft, { size: 14, sw: 3 })} Հետ դեպի ցուցակ</a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-8">
          <div class="bg-white border border-gray-200 p-8 shadow-sm">
            <div class="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
              <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900">Պատվերի Տվյալներ</h3>
              <span class="text-[9px] font-bold text-gray-300 uppercase tracking-widest">${fDayMonthYearTime(b.createdAt).replace(',', ',')}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
              <div><p class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Զարդի տեսակ</p><p class="text-sm font-bold text-gray-900 uppercase tracking-wide">${jewelryLabel(b.jewelryType)}</p></div>
              <div><p class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Բյուջեի շրջանակ</p><p class="text-sm font-bold text-gray-900 uppercase tracking-wide">${esc(b.budgetRange || '—')}</p></div>
              <div><p class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Վերջնաժամկետ</p><p class="text-sm font-bold text-gray-900 uppercase tracking-wide">${b.deadline ? fDayMonthYear(b.deadline) : 'Նշված չէ'}</p></div>
            </div>
            <div class="mt-12"><p class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-4">Քարերի նախընտրություն</p><div class="p-6 bg-gray-50 border border-gray-100 text-sm text-gray-600 italic">${esc(b.gemstonePreferences || 'Նախընտրություններ չկան')}</div></div>
            <div class="mt-12"><p class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-4">Լրացուցիչ մանրամասներ</p><div class="p-6 bg-gray-50 border border-gray-100 text-sm text-gray-600 leading-relaxed">${esc(b.description || '')}</div></div>
          </div>

          ${b.sketches.length ? `
            <div class="bg-white border border-gray-200 p-8 shadow-sm">
              <h3 class="text-sm font-heading font-normal uppercase tracking-widest text-gray-900 mb-8">Էսքիզ / Նկար</h3>
              <div class="space-y-4">
                ${b.sketches.map((src) => `<div class="border border-gray-100 overflow-hidden"><a href="${src}" target="_blank"><img src="${src}" class="w-full h-auto object-cover hover:scale-105 transition-transform duration-700"/></a></div>`).join('')}
              </div>
            </div>` : ''}
        </div>

        <div class="space-y-8">
          <div class="bg-luxe-black p-8 shadow-xl">
            <h3 class="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-8">Կարգավիճակ</h3>
            <select id="b-status" class="w-full bg-white/5 border border-white/10 text-white px-4 py-4 text-[10px] font-bold uppercase tracking-widest focus:border-primary outline-none transition-all">
              ${data.statusChoices.map((c) => `<option value="${c.value}" class="bg-luxe-black" ${b.status === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
            <div class="mt-10 pt-8 border-t border-white/5">
              <p class="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-4">Հաճախորդի տվյալներ</p>
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 border border-white/10 flex items-center justify-center text-primary">${svg(P.user, { size: 14, sw: 2.5 })}</div>
                  <p class="text-[10px] font-bold text-white uppercase tracking-wide">${esc(b.fullName)}</p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 border border-white/10 flex items-center justify-center text-primary">${svg(P.phone, { size: 14, sw: 2.5 })}</div>
                  <a href="tel:${esc(b.phone)}" class="text-[10px] font-bold text-white uppercase tracking-wide hover:text-primary">${esc(b.phone)}</a>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 border border-white/10 flex items-center justify-center text-primary">${svg(P.mail, { size: 14, sw: 2.5 })}</div>
                  <p class="text-[10px] font-bold text-white tracking-wide truncate">${esc(b.email || '')}</p>
                </div>
              </div>
              <div class="mt-10"><a href="tel:${esc(b.phone)}" class="block w-full py-4 bg-primary text-luxe-black text-center font-bold uppercase tracking-[0.4em] text-[10px] hover:bg-white transition-all shadow-xl">Զանգահարել</a></div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 p-8 shadow-sm">
            <h3 class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-6">Հայտի Նշումներ</h3>
            <textarea id="b-note" class="w-full bg-gray-50 border border-gray-100 p-4 text-xs min-h-[100px] outline-none focus:border-primary transition-all" placeholder="Ավելացնել ներքին նշում..."></textarea>
            <button id="b-note-save" class="mt-4 w-full py-3 border border-gray-200 text-gray-400 text-[9px] font-bold uppercase tracking-widest hover:border-primary hover:text-primary transition-all">Պահպանել</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('b-status').addEventListener('change', async (e) => {
    try {
      const r = await put(`/admin/bespoke/${b.id}`, { status: e.target.value });
      toast(r.message || 'Թարմացվեց');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  document.getElementById('b-note-save').addEventListener('click', () => toast('Նշումների պահպանումը դեռ հասանելի չէ'));
}

// ── Reviews ───────────────────────────────────────────────────────────
export async function reviewsList(ctx, page = 1) {
  ctx.title('Կարծիքներ', 'Կառավարեք հաճախորդների կարծիքները');
  const q = hashQuery();
  const search = q.get('search') || '';
  const rating = q.get('rating') || '';
  const params = new URLSearchParams({ page });
  if (search) params.set('search', search);
  if (rating) params.set('rating', rating);
  const data = await get(`/admin/reviews?${params}`);
  const meta = data.pagination;

  const reviewFormModal = (review) => {
    const m = modal({
      title: review ? 'Խմբագրել Կարծիք' : 'Ավելացնել Կարծիք',
      body: `
        <form id="r-form" class="space-y-5">
          <div><label class="lbl">Անուն</label><input name="name" required value="${esc(review?.name || '')}" class="inp"/></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="lbl">Վարկանիշ</label><select name="rating" class="inp">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${review?.rating === n ? 'selected' : ''}>${n} աստղ</option>`).join('')}</select></div>
            <div><label class="lbl">Նշում (badge)</label><input name="badge" value="${esc(review?.badge || '')}" class="inp" placeholder="Local Guide · 10 reviews"/></div>
          </div>
          <div><label class="lbl">Ժամանակ</label><input name="time" value="${esc(review?.time || '')}" class="inp" placeholder="2 weeks ago"/></div>
          <div><label class="lbl">Տեքստ</label><textarea name="text" rows="4" required class="inp">${esc(review?.text || '')}</textarea></div>
          <div class="flex flex-wrap gap-6">
            <label class="cbx"><input type="checkbox" name="is_approved" ${!review || review.isApproved ? 'checked' : ''}/> Հաստատված</label>
            <label class="cbx"><input type="checkbox" name="show_on_main" ${review?.showOnMain ? 'checked' : ''}/> Գլխավոր էջում</label>
          </div>
        </form>`,
      footer: `
        <button data-close class="px-6 py-3 border border-gray-200 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50">Չեղարկել</button>
        <button id="r-save" class="px-8 py-3 bg-luxe-black text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-luxe-black transition-colors">Պահպանել</button>`,
    });
    m.el.querySelector('#r-save').addEventListener('click', async () => {
      const f = m.el.querySelector('#r-form');
      if (!f.reportValidity()) return;
      const body = {
        name: f.name.value,
        rating: f.rating.value,
        badge: f.badge.value,
        time: f.time.value,
        text: f.text.value,
        is_approved: f.is_approved.checked,
        show_on_main: f.show_on_main.checked,
      };
      try {
        const r = review ? await put(`/admin/reviews/${review.id}`, body) : await post('/admin/reviews', body);
        toast(r.message || 'Պահպանվեց');
        m.close();
        reviewsList(ctx, meta.page);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  };

  const syncModal = () => {
    const m = modal({
      title: 'Սինք Google Reviews-ից',
      body: `
        <div class="bg-blue-50 border border-blue-200 p-4 mb-6">
          <div class="flex gap-3">
            ${svg(P.info, { size: 20, sw: 2, cls: 'text-blue-600 flex-shrink-0 mt-0.5' })}
            <div><p class="text-sm text-blue-800 font-medium mb-1">Ինչպես օգտագործել</p><p class="text-sm text-blue-700">Ձեր Google Business էջից պատճենեք կարծիքները և ավելացրեք ստորև։ Յուրաքանչյուր կարծիք պետք է պարունակի անուն, տեքստ և վարկանիշ։</p></div>
          </div>
        </div>
        <label class="lbl">Կարծիքների տվյալները (JSON)</label>
        <textarea id="reviewsJson" rows="8" class="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-primary font-mono text-xs" placeholder='[
  {
    "name": "Անուն Ազգանուն",
    "text": "Կարծիքի տեքստը...",
    "rating": 5,
    "badge": "Local Guide · 10 reviews",
    "time": "2 weeks ago"
  }
]'></textarea>
        <div id="syncResult" class="hidden p-4 mt-4"></div>`,
      footer: `
        <button data-close class="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-widest">Փակել</button>
        <button id="syncBtn" class="px-5 py-3 bg-primary hover:bg-luxe-black text-luxe-black hover:text-primary text-[10px] font-bold uppercase tracking-widest inline-flex items-center justify-center gap-2"><span id="syncSpinner" class="hidden animate-spin">${svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', { size: 16, sw: 2 })}</span> Սինքրոնիզացնել</button>`,
    });
    const showResult = (ok, msg) => {
      const el = m.el.querySelector('#syncResult');
      el.classList.remove('hidden');
      el.className = `p-4 mt-4 ${ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`;
      el.innerHTML = `<div class="flex gap-3">${ok ? svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>', { size: 20, sw: 2, cls: 'text-green-600 flex-shrink-0 mt-0.5' }) : svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>', { size: 20, sw: 2, cls: 'text-red-600 flex-shrink-0 mt-0.5' })}<p class="text-sm ${ok ? 'text-green-800' : 'text-red-800'}">${esc(msg)}</p></div>`;
    };
    m.el.querySelector('#syncBtn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      let parsed;
      try {
        parsed = JSON.parse(m.el.querySelector('#reviewsJson').value);
      } catch {
        showResult(false, 'Սխալ՝ JSON ձևաչափը անվավեր է։ Խնդրում ենք ստուգել ձևաչափը։');
        return;
      }
      if (!Array.isArray(parsed)) {
        showResult(false, 'Սխալ՝ տվյալները պետք է լինեն զանգված (array)։');
        return;
      }
      btn.disabled = true;
      m.el.querySelector('#syncSpinner').classList.remove('hidden');
      try {
        const r = await post('/admin/reviews/sync', { reviews: parsed });
        if (r.success) {
          showResult(true, r.message);
          setTimeout(() => reviewsList(ctx, meta.page), 1500);
        } else {
          showResult(false, r.error || 'Սխալ տեղի ունեցավ։');
        }
      } catch (err) {
        showResult(false, 'Սխալ՝ ' + err.message);
      } finally {
        btn.disabled = false;
        m.el.querySelector('#syncSpinner').classList.add('hidden');
      }
    });
  };

  ctx.container().innerHTML = `
    <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
        <div class="flex-1 w-full">
          <form id="r-filter" class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-gray-400">${svg(P.search, { size: 20, sw: 2 })}</div>
              <input type="text" name="search" value="${esc(search)}" placeholder="Փնտրել անունով, կարծիքով..." class="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"/>
            </div>
            <select name="rating" class="px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm">
              <option value="">Բոլոր վարկանիշները</option>
              ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${rating === String(n) ? 'selected' : ''}>${n} աստղ</option>`).join('')}
            </select>
            <button type="submit" class="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-none transition-all text-sm">Ֆիլտրել</button>
          </form>
        </div>
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
          <button id="sync-open" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-none transition-all shadow-sm text-sm">${svg(P.refresh, { size: 18, sw: 2 })}<span class="hidden sm:inline">Սինք Google-ից</span><span class="sm:hidden">Սինք</span></button>
          <button id="review-new" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary hover:bg-luxe-black text-luxe-black hover:text-primary font-semibold rounded-none transition-all shadow-lg text-sm">${svg(P.plus, { size: 18, sw: 2 })} Ավելացնել կարծիք</button>
        </div>
      </div>
    </div>

    ${data.reviews.length ? `
      <div class="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        ${data.reviews.map((r) => `
          <div class="bg-white rounded-none border border-gray-200 shadow-sm hover:shadow-lg transition-all p-4 sm:p-6">
            <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div class="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 flex items-center justify-center"><span class="text-primary font-bold text-lg sm:text-xl">${initial(r.name)}</span></div>
                <div class="flex-1 min-w-0">
                  <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                    <h3 class="font-heading font-bold text-gray-900 truncate text-sm sm:text-base">${esc(r.name)}</h3>
                    <div class="flex items-center gap-1">${stars(r.rating, 14, '#EAB308')}</div>
                  </div>
                  <div class="mb-2">${r.isApproved
                    ? '<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">Հաստատված</span>'
                    : '<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">Սպասում է</span>'}</div>
                  ${r.badge ? `<p class="text-xs sm:text-sm text-gray-500 mb-2">${esc(r.badge)}</p>` : ''}
                  <p class="text-sm sm:text-base text-gray-700 leading-relaxed break-words">${esc(r.text)}</p>
                  ${r.time ? `<p class="text-xs text-gray-400 mt-2">${esc(r.time)}</p>` : ''}
                </div>
              </div>
              <div class="flex sm:flex-col gap-2 ml-auto sm:ml-0">
                <button data-redit="${r.id}" title="Խմբագրել" class="inline-flex items-center justify-center p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-none transition-all">${svg(P.pencil, { size: 16, sw: 2 })}</button>
                <button data-rdel="${r.id}" title="Ջնջել" class="inline-flex items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-none transition-all">${svg(P.trash, { size: 16, sw: 2 })}</button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-100 text-xs text-gray-500"><span>Ստեղծվել է։ ${fDayMonthYear(r.createdAt)}</span></div>
          </div>`).join('')}
      </div>` : `
      <div class="bg-white rounded-none border border-gray-200 p-8 sm:p-12 text-center">
        ${svg(P.star, { size: 56, sw: 2, cls: 'text-gray-300 mx-auto mb-4' })}
        <h3 class="text-lg sm:text-xl font-heading font-bold text-gray-900 mb-2">Կարծիքներ չեն գտնվել</h3>
        <p class="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Փորձեք փոխել ֆիլտրները կամ ավելացնել նոր կարծիք</p>
        <button data-rnew-empty class="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary hover:bg-luxe-black text-luxe-black hover:text-primary font-semibold rounded-none transition-all text-sm">${svg(P.plus, { size: 18, sw: 2 })} Ավելացնել առաջին կարծիքը</button>
      </div>`}

    ${meta.totalPages > 1 ? `
      <div class="bg-white rounded-none border border-gray-200 shadow-sm p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-xs sm:text-sm text-gray-500 font-medium">Ցուցադրված է ${(meta.page - 1) * 10 + 1}–${Math.min(meta.page * 10, meta.totalResults)} կարծիքները (${meta.totalResults}-ից)</p>
          ${pagerButtons(meta)}
        </div>
      </div>` : ''}`;

  const form = document.getElementById('r-filter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (form.search.value) qs.set('search', form.search.value);
    if (form.rating.value) qs.set('rating', form.rating.value);
    ctx.navigate(`#/reviews/page/1${qs.toString() ? '?' + qs : ''}`);
  });
  bindPages(ctx, (p) => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (rating) qs.set('rating', rating);
    ctx.navigate(`#/reviews/page/${p}${qs.toString() ? '?' + qs : ''}`);
  });
  document.getElementById('sync-open').addEventListener('click', syncModal);
  document.getElementById('review-new').addEventListener('click', () => reviewFormModal(null));
  const emptyBtn = ctx.container().querySelector('[data-rnew-empty]');
  if (emptyBtn) emptyBtn.addEventListener('click', () => reviewFormModal(null));
  ctx.container().querySelectorAll('[data-redit]').forEach((b) => b.addEventListener('click', () => reviewFormModal(data.reviews.find((x) => String(x.id) === b.dataset.redit))));
  ctx.container().querySelectorAll('[data-rdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirmDialog('Համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս կարծիքը։')) return;
    const r = await del(`/admin/reviews/${b.dataset.rdel}`);
    toast(r.message || 'Ջնջվեց');
    reviewsList(ctx, meta.page);
  }));
}

// ── Messages ──────────────────────────────────────────────────────────
export async function messagesList(ctx, page = 1) {
  ctx.title('Հաղորդագրություններ', 'Հաճախորդների կապի հաղորդագրություններ');
  const data = await get(`/admin/messages?page=${page}`);
  const meta = data.pagination;

  ctx.container().innerHTML = `
    <div class="space-y-6">
      ${data.messages.map((msg) => `
        <div class="bg-white rounded-none border border-gray-200 shadow-sm hover:shadow-xl transition-all p-6 sm:p-10 group">
          <div class="flex items-start gap-6 sm:gap-8">
            <div class="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 border border-gray-100 flex items-center justify-center text-primary font-heading text-2xl group-hover:bg-primary group-hover:text-luxe-black transition-colors">${initial(msg.name)}</div>
            <div class="flex-1 min-w-0">
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div class="min-w-0">
                  <h3 class="font-heading font-normal text-gray-900 text-xl sm:text-2xl uppercase tracking-wide break-words leading-none mb-3">${esc(msg.name)}</h3>
                  <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <span class="inline-flex items-center gap-1.5 break-all">${svg(P.mail, { size: 14, sw: 2.5, cls: 'text-primary flex-shrink-0' })} ${esc(msg.email)}</span>
                    ${msg.phone ? `<span class="hidden sm:inline text-gray-200">•</span><span class="inline-flex items-center gap-1.5 break-all">${svg(P.phone, { size: 14, sw: 2.5, cls: 'text-primary flex-shrink-0' })} ${esc(msg.phone)}</span>` : ''}
                  </div>
                </div>
                <div class="flex justify-between items-center gap-6">
                  <span class="text-[10px] font-bold text-gray-300 uppercase tracking-widest">${fDmyTime(msg.createdAt)}</span>
                  <button data-del="${msg.id}" class="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-[0.3em] transition-colors">Ջնջել</button>
                </div>
              </div>
              <div class="bg-gray-50 border-l-4 border-primary p-6 sm:p-8"><p class="text-gray-700 font-heading font-normal text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words">"${esc(msg.message)}"</p></div>
            </div>
          </div>
        </div>`).join('') || `
        <div class="bg-white rounded-none border border-gray-100 p-20 text-center">
          ${svg(P.message, { size: 64, sw: 1, cls: 'text-gray-100 mx-auto mb-8' })}
          <h3 class="text-xl font-heading font-normal text-gray-900 uppercase tracking-widest mb-2">Հաղորդագրություններ չկան</h3>
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em]">Դեռ հաղորդագրություններ չեն ստացվել</p>
        </div>`}
    </div>

    ${meta.totalPages > 1 ? `
      <div class="bg-white rounded-none border border-gray-200 shadow-sm p-8 mt-10">
        <div class="flex flex-col lg:flex-row items-center justify-between gap-6">
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ցուցադրվում է <span class="text-gray-900">${(meta.page - 1) * 15 + 1}</span> - <span class="text-gray-900">${Math.min(meta.page * 15, meta.totalResults)}</span>՝ ընդհանուր <span class="text-gray-900">${meta.totalResults}</span></p>
          ${pagerButtons(meta)}
        </div>
      </div>` : ''}`;

  bindPages(ctx, (p) => ctx.navigate(`#/messages/page/${p}`));
  ctx.container().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirmDialog('Համոզվա՞ծ եք:')) return;
    await del(`/admin/messages/${b.dataset.del}`);
    toast('Հաղորդագրությունը ջնջված է։');
    messagesList(ctx, meta.page);
  }));
}

// ── Users ─────────────────────────────────────────────────────────────
export async function usersList(ctx) {
  ctx.title('Օգտատերեր', 'Կառավարում');
  const { users } = await get('/admin/users');
  const roleChip = (role) => (role === 'admin'
    ? '<span class="inline-block px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-yellow-700">Ադմին</span>'
    : '<span class="inline-block px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">Հաճախորդ</span>');

  ctx.container().innerHTML = `
    <div class="flex justify-end mb-6">
      <button id="new-user" class="px-6 py-3 bg-luxe-black text-primary text-[11px] font-bold uppercase tracking-widest hover:bg-primary hover:text-luxe-black transition-colors">+ Նոր Օգտատեր</button>
    </div>
    <div class="bg-white border border-gray-100 overflow-x-auto">
      <table class="w-full text-sm"><thead><tr class="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
        <th class="p-4">#</th><th class="p-4">Մուտքանուն</th><th class="p-4">Էլ. փոստ</th><th class="p-4">Դեր</th><th class="p-4 text-right">Գործողություն</th>
      </tr></thead><tbody class="divide-y divide-gray-50">
        ${users.map((u) => `<tr>
          <td class="p-4 font-bold">${u.id}</td><td class="p-4">${esc(u.username)}</td><td class="p-4 text-gray-500">${esc(u.email)}</td>
          <td class="p-4">${roleChip(u.role)}</td>
          <td class="p-4 text-right whitespace-nowrap">
            <button data-role="${u.id}" data-val="${u.role === 'admin' ? 'customer' : 'admin'}" class="text-primary text-[10px] font-bold uppercase tracking-widest hover:underline mr-3">${u.role === 'admin' ? 'Դարձնել Հաճախորդ' : 'Դարձնել Ադմին'}</button>
            <button data-del="${u.id}" class="text-red-400 text-[10px] font-bold uppercase tracking-widest hover:underline">Ջնջել</button>
          </td></tr>`).join('')}
      </tbody></table>
    </div>`;

  document.getElementById('new-user').addEventListener('click', () => {
    const m = modal({
      title: 'Նոր Օգտատեր',
      body: `<form id="u-form" class="space-y-4">
        <input name="username" placeholder="Մուտքանուն" required class="inp"/>
        <input name="email" type="email" placeholder="Էլ. փոստ" required class="inp"/>
        <input name="password" type="password" placeholder="Գաղտնաբառ" required minlength="6" class="inp"/>
        <select name="role" class="inp"><option value="customer">Հաճախորդ</option><option value="admin">Ադմին</option></select>
        <button class="w-full py-3 bg-luxe-black text-primary text-[11px] font-bold uppercase tracking-widest">Ստեղծել</button>
      </form>`,
    });
    m.el.querySelector('#u-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const d = await post('/admin/users', Object.fromEntries(new FormData(e.target)));
        m.close();
        toast(d.message);
        usersList(ctx);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
  ctx.container().querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', async () => {
    await put(`/admin/users/${b.dataset.role}`, { role: b.dataset.val });
    toast('Թարմացվեց');
    usersList(ctx);
  }));
  ctx.container().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirmDialog('Ջնջե՞լ օգտատիրոջը')) return;
    try {
      await del(`/admin/users/${b.dataset.del}`);
      toast('Ջնջվեց');
      usersList(ctx);
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}
