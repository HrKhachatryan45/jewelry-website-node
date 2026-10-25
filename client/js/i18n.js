// Lightweight i18n for client-side pages (hy/ru/en)
// Supports data-i18n for textContent, data-i18n-attr="attr:key;attr2:key", data-i18n-<attr>
const I18N = {
  supported: ['hy','ru','en'],
  current: 'hy',
  cache: {},
  async load(lang) {
    if (this.cache[lang]) return this.cache[lang];
    try {
      const res = await fetch(`/locales/${lang}.json`);
      const data = await res.json();
      this.cache[lang] = data;
      return data;
    } catch (e) {
      this.cache[lang] = {};
      return {};
    }
  },
  t(dict, key, fallback) {
    if (!key) return fallback || '';
    const parts = key.split('.');
    let cur = dict;
    for (const p of parts) {
      cur = cur?.[p];
      if (cur === undefined) break;
    }
    return cur ?? fallback ?? key;
  },
  apply(dict) {
    // text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(dict, key, el.textContent);
    });
    // attr spec: "placeholder:nav.search;title:..."
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(';').forEach(s => {
        const m = s.trim();
        if (!m) return;
        const [attr, key] = m.split(':').map(x=>x.trim());
        if (attr && key) el.setAttribute(attr, this.t(dict, key));
      });
    });
    // data-i18n-placeholder etc
    document.querySelectorAll('[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-alt]').forEach(el => {
      const attrs = ['placeholder','title','aria-label','alt'];
      for (const a of attrs) {
        const k = el.getAttribute('data-i18n-' + a);
        if (k) el.setAttribute(a, this.t(dict, k));
      }
    });
  },
  setLang(lang) {
    lang = this.supported.includes(lang) ? lang : 'hy';
    this.current = lang;
    localStorage.setItem('luxe_lang', lang);
    document.documentElement.setAttribute('lang', lang);
    this.load(lang).then(dict => {
      this.apply(dict);
      document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('text-luxe-gold', b.dataset.lang === lang);
        b.classList.toggle('opacity-50', b.dataset.lang !== lang);
      });
    });
  },
  init() {
    const saved = localStorage.getItem('luxe_lang') || document.documentElement.getAttribute('lang') || 'hy';
    this.setLang(saved);
    // wire buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-btn');
      if (btn && btn.dataset.lang) {
        e.preventDefault();
        this.setLang(btn.dataset.lang);
      }
    });
  }
};
window.I18N = I18N;
document.addEventListener('DOMContentLoaded', () => I18N.init());
