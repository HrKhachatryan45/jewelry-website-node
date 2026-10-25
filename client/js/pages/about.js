import { get } from '/js/api.js';

async function init() {
  try {
    const cfg = await get('/config');
    const addr = (cfg.contact && (cfg.contact.addressFull || cfg.contact.address)) || '';
    const addrEl = document.getElementById('about-address');
    if (addrEl && addr) addrEl.textContent = addr;
    const map = document.getElementById('about-map-link');
    if (map && addr) {
      map.href = 'https://maps.google.com/?q=' + encodeURIComponent(addr);
    }
  } catch (e) {
    console.error('about init failed', e);
  }
  if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
  if (typeof window.__observeScroll === 'function') window.__observeScroll();
}
init();
