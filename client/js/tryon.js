// Live client-side virtual try-on using the category-specific MediaPipe tracker.

import { ArTryOnEngine } from '/js/ar/engine.js';
import { normalizeCategory, AR_CATEGORIES } from '/js/ar/categories.js';

const ERR_STATES = new Set(['denied', 'nocam', 'insecure', 'load', 'image']);
const FALLBACK_TEXT = {
  loading: 'Loading try-on...',
  ready: '',
  'no-face': 'Face not detected — show your face to the camera',
  'no-hand': 'Hand not detected — show your hand to the camera',
  denied: 'Camera access denied — allow it in your browser settings',
  nocam: 'No usable camera was found',
  insecure: 'Camera access requires HTTPS or localhost',
  load: 'MediaPipe could not be loaded — check your connection and try again',
  image: 'This product needs a transparent try-on PNG',
  close: 'Close',
  privacy: 'Live tracking runs in your browser. Camera frames are not uploaded.',
};

const FALLBACK_HINT = {
  necklaces: 'Face the camera with your neck and shoulders visible',
  earrings: 'Face the camera with both ears visible',
  rings: 'Show your hand with the ring finger visible',
  bracelets: 'Show your hand and wrist to the camera',
};

const FALLBACK_CATEGORY = {
  necklaces: 'Necklace',
  earrings: 'Earrings',
  rings: 'Ring',
  bracelets: 'Bracelet',
};

const FALLBACK_TARGET = { face: 'Face', hand: 'Hand/wrist' };
const STYLE_ID = 'tryon-live-ar-style';
const TEMPLATE = `
<div id="tryon-root" class="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6">
  <div class="absolute inset-0 bg-luxe-black/80 backdrop-blur-sm" data-close></div>
  <div class="relative bg-white w-full sm:max-w-3xl max-h-full sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
    <div class="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b border-border/10 shrink-0">
      <div class="min-w-0">
        <span id="ar-title" class="text-[9px] uppercase tracking-[0.4em] text-luxe-gold block mb-1"></span>
        <span id="ar-name" class="block text-xs text-foreground/50 truncate"></span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span id="ar-cat" class="hidden sm:inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-luxe-gold border border-luxe-gold/40 px-2.5 py-1.5"></span>
        <button type="button" data-close id="ar-close" class="shrink-0 border border-border/10 px-4 py-2 text-[9px] uppercase tracking-[0.2em] hover:border-luxe-gold"></button>
      </div>
    </div>
    <div class="relative bg-luxe-black min-h-[280px] flex items-center justify-center overflow-hidden">
      <video id="ar-video" class="hidden" autoplay muted playsinline></video>
      <div class="ar-canvas-stack relative inline-block max-w-full max-h-[60vh] mx-auto">
        <canvas id="ar-canvas" width="640" height="480" class="block w-auto h-auto max-w-full max-h-[60vh] mx-auto"></canvas>
      </div>
      <div id="ar-spinner" class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-luxe-black/60 pointer-events-none">
        <span class="w-10 h-10 border-2 border-white/20 border-t-luxe-gold rounded-full animate-spin"></span>
        <span id="ar-spinner-label" class="text-[10px] uppercase tracking-[0.3em] text-white/60"></span>
      </div>
      <div id="ar-status" class="hidden absolute left-1/2 -translate-x-1/2 bottom-4 max-w-[92%] text-center px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] bg-luxe-black/85 border pointer-events-none" role="status" aria-live="polite"></div>
    </div>
    <div class="flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-t border-border/10 shrink-0">
      <div class="min-w-0">
        <p id="ar-hint" class="text-[10px] uppercase tracking-[0.15em] text-foreground/45 leading-relaxed"></p>
        <p id="ar-privacy" class="mt-2 text-[9px] text-foreground/35"></p>
      </div>
      <button type="button" data-close id="ar-close-action" class="shrink-0 px-4 py-3 bg-luxe-black text-white text-[9px] uppercase tracking-[0.2em] hover:bg-luxe-gold"></button>
    </div>
  </div>
</div>`;

let root = null;
let engine = null;
let dict = null;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #tryon-root video { display: none !important; }
    #tryon-root #ar-canvas { background: #111827; }
    #tryon-root .ar-canvas-stack { line-height: 0; }
  `;
  document.head.appendChild(style);
}

async function loadDict() {
  const i18n = window.I18N;
  if (!i18n || typeof i18n.load !== 'function') return null;
  try {
    return await i18n.load(i18n.current || 'hy');
  } catch {
    return null;
  }
}

function t(key, fallback) {
  let value = dict;
  for (const part of key.split('.')) {
    value = value?.[part];
    if (value === undefined) break;
  }
  return value || fallback;
}

function statusText(status) {
  return t(`ar.status.${status.replace('-', '_')}`, FALLBACK_TEXT[status] || FALLBACK_TEXT.load);
}

function applyStatus(status) {
  if (!root?.isConnected) return;
  const spinner = root.querySelector('#ar-spinner');
  const spinnerLabel = root.querySelector('#ar-spinner-label');
  const statusElement = root.querySelector('#ar-status');
  if (!spinner || !statusElement) return;

  spinner.classList.toggle('hidden', status !== 'loading');
  spinnerLabel.textContent = status === 'loading' ? statusText(status) : '';
  if (status === 'ready') {
    statusElement.textContent = '';
    statusElement.classList.add('hidden');
    return;
  }

  statusElement.textContent = statusText(status);
  statusElement.classList.remove('hidden', 'border-luxe-gold/50', 'text-luxe-gold', 'border-red-400/70', 'text-red-300');
  statusElement.classList.add(ERR_STATES.has(status) ? 'border-red-400/70' : 'border-luxe-gold/50');
  statusElement.classList.add(ERR_STATES.has(status) ? 'text-red-300' : 'text-luxe-gold');
}

function onEsc(event) {
  if (event.key === 'Escape') closeTryOn();
}

export function openTryOn(product = {}) {
  const category = normalizeCategory(product.productCategory);
  if (!category) return;

  closeTryOn();
  dict = null;
  ensureStyle();
  root = document.createElement('div');
  root.innerHTML = TEMPLATE;
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onEsc);

  const definition = AR_CATEGORIES[category];
  root.querySelector('#ar-title').textContent = t('ar.title', 'Virtual Try-On');
  root.querySelector('#ar-name').textContent = product.productName || '';
  root.querySelector('#ar-cat').textContent =
    `${t(definition.labelKey, FALLBACK_CATEGORY[category])} · ${t(`ar.target.${definition.target}`, FALLBACK_TARGET[definition.target])}`;
  root.querySelector('#ar-hint').textContent = t(definition.hintKey, FALLBACK_HINT[category]);
  root.querySelector('#ar-privacy').textContent = t('ar.privacy_note', FALLBACK_TEXT.privacy);
  root.querySelector('#ar-close').textContent = t('ar.close', FALLBACK_TEXT.close);
  root.querySelector('#ar-close-action').textContent = t('ar.close', FALLBACK_TEXT.close);
  root.querySelectorAll('[data-close]').forEach((element) => element.addEventListener('click', closeTryOn));

  const currentRoot = root;
  loadDict().then((loaded) => {
    if (!loaded || root !== currentRoot || !currentRoot.isConnected) return;
    dict = loaded;
    currentRoot.querySelector('#ar-title').textContent = t('ar.title', 'Virtual Try-On');
    currentRoot.querySelector('#ar-cat').textContent =
      `${t(definition.labelKey, FALLBACK_CATEGORY[category])} · ${t(`ar.target.${definition.target}`, FALLBACK_TARGET[definition.target])}`;
    currentRoot.querySelector('#ar-hint').textContent = t(definition.hintKey, FALLBACK_HINT[category]);
    currentRoot.querySelector('#ar-privacy').textContent = t('ar.privacy_note', FALLBACK_TEXT.privacy);
    currentRoot.querySelector('#ar-close').textContent = t('ar.close', FALLBACK_TEXT.close);
    currentRoot.querySelector('#ar-close-action').textContent = t('ar.close', FALLBACK_TEXT.close);
    if (engine?._status) applyStatus(engine._status);
  });

  engine = new ArTryOnEngine({
    video: root.querySelector('#ar-video'),
    canvas: root.querySelector('#ar-canvas'),
    productCategory: category,
    productImageUrl: product.productImageUrl,
    onStatus: applyStatus,
  });
  engine.start();
}

export function closeTryOn() {
  document.removeEventListener('keydown', onEsc);
  if (engine) {
    engine.stop();
    engine = null;
  }
  if (root) {
    root.remove();
    root = null;
  }
  if (document.body) document.body.style.overflow = '';
}

window.openTryOn = openTryOn;
window.closeTryOn = closeTryOn;
