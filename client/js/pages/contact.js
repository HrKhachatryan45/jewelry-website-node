import { get } from '/js/api.js';

async function init() {
  try {
    const cfg = await get('/config');
    const c = cfg.contact || {};
    const phoneEl = document.getElementById('contact-phone');
    const addrEl = document.getElementById('contact-address');
    if (phoneEl && c.phone) phoneEl.textContent = c.phone;
    if (addrEl && (c.addressFull || c.address)) addrEl.textContent = c.addressFull || c.address;
  } catch (e) {
    console.error('contact config failed', e);
  }

  const form = document.getElementById('contact-form');
  const msg = document.getElementById('msg');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const raw = Object.fromEntries(fd.entries());
    const body = {
      name: raw.full_name || raw.name || '',
      email: raw.email || '',
      phone: raw.phone || '',
      message: raw.subject ? `${raw.subject}\n\n${raw.message || ''}` : raw.message || '',
    };
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '...'; }
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        if (msg) { msg.textContent = data.message || 'Հաղորդագրությունը ուղարկվեց։'; msg.classList.remove('hidden'); }
        form.reset();
      } else {
        if (msg) { msg.textContent = data.error || (data.errors && Object.values(data.errors)[0]) || 'Սխալ'; msg.classList.remove('hidden'); }
      }
    } catch (err) {
      if (msg) { msg.textContent = 'Կապի խափանում'; msg.classList.remove('hidden'); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    }
  };

  if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
  if (typeof window.__observeScroll === 'function') window.__observeScroll();
}
init();
