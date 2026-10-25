// Shared UI helpers for the admin SPA (no framework).

export function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toast(message, type = 'success') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'fixed top-6 right-6 z-[100] space-y-3';
    document.body.appendChild(host);
  }
  const colors = {
    success: 'border-primary text-primary',
    error: 'border-red-500 text-red-400',
  };
  const el = document.createElement('div');
  el.className = `flex items-center gap-3 px-6 py-4 bg-gray-900 ${colors[type] || colors.success} text-[10px] font-bold uppercase tracking-widest border-l-4 shadow-xl transition-all duration-300 opacity-0 translate-x-4`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.remove('opacity-0', 'translate-x-4'));
  setTimeout(() => {
    el.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

export function confirmDialog(message) {
  return window.confirm(message);
}

// Minimal modal: caller supplies the inner HTML; returns the element + a close().
export function modal({ title, body, footer = '', width = 'max-w-2xl' }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[90] bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-8';
  overlay.innerHTML = `
    <div class="bg-white w-full ${width} shadow-2xl my-8">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h3 class="font-heading text-lg uppercase tracking-tight">${esc(title)}</h3>
        <button data-close class="text-gray-400 hover:text-gray-900 w-8 h-8 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div data-body class="p-6">${body}</div>
      ${footer ? `<div data-footer class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">${footer}</div>` : ''}
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) close();
  });
  document.body.appendChild(overlay);
  return { el: overlay, close, body: overlay.querySelector('[data-body]') };
}

export function badge(text, tone = 'gray') {
  const tones = {
    gray: 'bg-gray-100 text-gray-500',
    gold: 'bg-primary/15 text-yellow-700',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-600',
  };
  return `<span class="inline-block px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${tones[tone] || tones.gray}">${esc(text)}</span>`;
}

export function emptyState(text) {
  return `<div class="py-20 text-center text-gray-300 font-heading text-xl uppercase tracking-widest">${esc(text)}</div>`;
}

export function pagination(meta, onPage) {
  const wrap = document.createElement('div');
  wrap.className = 'flex items-center justify-center gap-2 mt-8';
  const btn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = `min-w-[2.5rem] h-10 px-3 text-[11px] font-bold uppercase tracking-widest border transition-all ${
      active ? 'bg-luxe-black text-primary border-luxe-black' : 'bg-white text-gray-500 border-gray-100 hover:border-primary'
    } ${disabled ? 'opacity-30 pointer-events-none' : ''}`;
    b.addEventListener('click', () => onPage(page));
    return b;
  };
  wrap.appendChild(btn('‹', meta.page - 1, !meta.hasPrevious, false));
  for (let p = 1; p <= meta.totalPages; p += 1) {
    if (p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1) {
      wrap.appendChild(btn(String(p), p, false, p === meta.page));
    } else if (Math.abs(p - meta.page) === 2) {
      const s = document.createElement('span');
      s.textContent = '…';
      s.className = 'px-1 text-gray-300';
      wrap.appendChild(s);
    }
  }
  wrap.appendChild(btn('›', meta.page + 1, !meta.hasNext, false));
  return wrap;
}
