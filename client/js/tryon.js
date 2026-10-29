// Live client-side virtual try-on using the category-specific MediaPipe tracker.

import { ArTryOnEngine } from '/js/ar/engine.js';
import { normalizeCategory, AR_CATEGORIES } from '/js/ar/categories.js';
import { analyzeAsset } from '/js/ar/asset.js';
import {
  computeEarringModelPlacements,
  computePlacements,
} from '/js/ar/tracker.js';
import { drawFrame } from '/js/ar/renderer.js';
import { loadArSolver } from '/js/ar/loader.js';
import { EarringModelRenderer } from '/js/ar/earringModel3d.js';
import { HandModelRenderer } from '/js/ar/model3d.js';
import { view } from '/js/ar/view.js';

const ERR_STATES = new Set(['denied', 'nocam', 'insecure', 'load', 'image']);
const FALLBACK_TEXT = {
  loading: 'Փորձի պատրաստում...',
  ready: '',
  'no-target': 'Տեսախցիկին ցույց տվեք զարդի հատվածը։',
  'low-fps': 'Արագությունը ցածր է․ տեսախցիկի որակը նվազեցվում է։',
  'no-face': 'Դեմքը չի հայտնաբերվել․ ցույց տվեք դեմքը տեսախցիկին։',
  'no-hand': 'Ձեռքը չի հայտնաբերվել․ ցույց տվեք ձեռքը տեսախցիկին։',
  photo_size: 'Ընտրեք մինչև 15 ՄԲ չափի լուսանկար։',
  denied: 'Տեսախցիկի հասանելիությունը մերժվել է․ թույլատրեք այն բրաուզերի կարգավորումներում։',
  nocam: 'Հասանելի տեսախցիկ չի գտնվել։',
  insecure: 'Տեսախցիկն օգտագործելու համար անհրաժեշտ է HTTPS կամ localhost։',
  load: 'Փորձի գործիքը չհաջողվեց բեռնել։ Փորձեք կրկին։',
  image: 'Այս ապրանքի թափանցիկ փորձի պատկերը հասանելի չէ։',
  close: 'Փակել',
  privacy: 'Փորձի պատկերը մշակվում է ձեր բրաուզերում։',
};

const FALLBACK_HINT = {
  necklaces: 'Կանգնեք տեսախցիկի դիմաց՝ պարանոցն ու ուսերը տեսանելի պահելով։',
  earrings: 'Կանգնեք տեսախցիկի դիմաց՝ երկու ականջները տեսանելի պահելով։',
  rings: 'Ցույց տվեք ձեռքը՝ մատնեմատը տեսանելի պահելով։',
  bracelets: 'Ցույց տվեք ձեռքն ու դաստակը տեսախցիկին։',
  watches: 'Ցույց տվեք դաստակի արտաքին կողմն ու նախաբազուկը տեսախցիկին։',
};

const FALLBACK_CATEGORY = {
  necklaces: 'Վզնոց',
  earrings: 'Ականջօղեր',
  rings: 'Մատանի',
  bracelets: 'Ապարանջան',
  watches: 'Ժամացույց',
};

const FALLBACK_TARGET = { face: 'Դեմք', hand: 'Ձեռք/դաստակ' };
const STYLE_ID = 'tryon-live-ar-style';
const TEMPLATE = `
<div id="tryon-root" class="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6">
  <div class="absolute inset-0 bg-luxe-black/80 backdrop-blur-sm" data-close></div>
  <div class="tryon-modal relative bg-white w-full sm:max-w-3xl max-h-full sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
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
    <div id="ar-stage" class="tryon-stage relative bg-luxe-black min-h-[280px] flex items-center justify-center overflow-hidden">
      <video id="ar-video" class="hidden" autoplay muted playsinline></video>
      <div class="ar-canvas-stack relative inline-block max-w-full max-h-[60vh] mx-auto">
        <canvas id="ar-canvas" width="640" height="480" class="block w-auto h-auto max-w-full max-h-[60vh] mx-auto"></canvas>
        <canvas id="ar-debug-canvas" class="hidden absolute inset-0 w-full h-full pointer-events-none"></canvas>
        <span id="ar-basic-badge" class="hidden absolute left-3 top-3 z-10 bg-luxe-black/80 text-white px-2 py-1 text-[8px] uppercase tracking-widest">Պարզ նախադիտում</span>
      </div>
      <button type="button" id="ar-switch-camera" class="hidden absolute right-3 top-3 z-20 px-3 py-2 bg-luxe-black/80 text-white text-[9px] uppercase tracking-widest border border-white/25" aria-label="Փոխել տեսախցիկը">↻ <span id="ar-switch-camera-label"></span></button>
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
      <div class="flex items-center gap-2 shrink-0">
        <div id="ar-mode-controls" class="flex flex-wrap items-center gap-2">
          <button type="button" data-mode="live" class="px-3 py-2 border border-luxe-gold text-luxe-gold text-[9px] uppercase tracking-widest">Ուղիղ</button>
          <button type="button" data-mode="photo" class="px-3 py-2 border border-border/20 text-foreground/50 text-[9px] uppercase tracking-widest">Իմ դիմանկարը</button>
        </div>
        <button type="button" data-close id="ar-close-action" class="shrink-0 px-4 py-3 bg-luxe-black text-white text-[9px] uppercase tracking-[0.2em] hover:bg-luxe-gold"></button>
      </div>
    </div>
  </div>
</div>`;

let root = null;
let engine = null;
let dict = null;
let modalResizeHandler = null;
let photoSolver = null;
let photoUrl = null;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #tryon-root { height: 100vh; height: 100dvh; }
    #tryon-root video { display: block !important; position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #tryon-root #ar-canvas { background: transparent; }
    #tryon-root .ar-canvas-stack { line-height: 0; position: relative; z-index: 1; background: transparent; }
    #tryon-root.tryon-v2 .ar-canvas-stack { display: block; max-width: 100%; max-height: 60vh; }
    #tryon-root.tryon-photo video { display: none !important; }
    #tryon-root.tryon-v2 #ar-canvas { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; background: transparent !important; }
    @media (min-width: 640px) {
      #tryon-root .tryon-modal { height: 78vh; }
      #tryon-root .tryon-stage { flex: 1 1 auto; min-height: 0; }
      #tryon-root .tryon-stage .ar-canvas-stack {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
      }
      #tryon-root .tryon-stage #ar-canvas {
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        object-fit: cover;
      }
    }
    @media (max-width: 639px) {
      #tryon-root { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
      #tryon-root .tryon-modal { width: 100%; height: 100%; max-height: none; }
      #tryon-root .tryon-modal > :first-child,
      #tryon-root .tryon-modal > :last-child { padding: 12px 16px; }
      #tryon-root .tryon-modal > :last-child { align-items: stretch; flex-direction: column; }
      #tryon-root .tryon-modal > :last-child > :last-child { width: 100%; justify-content: space-between; }
      #tryon-root #ar-mode-controls { width: auto; }
      #tryon-root .tryon-stage { flex: 1 1 auto; min-height: 0; touch-action: pan-y; }
      #tryon-root #ar-privacy { display: none; }
      #tryon-root .tryon-stage .ar-canvas-stack { max-width: none; max-height: none; }
      #tryon-root .tryon-stage #ar-switch-camera { display: block; }
      #tryon-root #ar-canvas { width: 100%; height: 100%; max-width: none; max-height: none; }
      #tryon-root.tryon-v2 .tryon-stage .ar-canvas-stack { max-width: none; max-height: none; }
      #tryon-root #ar-status { bottom: 12px; }
    }
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
  const modalRoot = root.querySelector('#tryon-root');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onEsc);

  const definition = AR_CATEGORIES[category];
  root.querySelector('#ar-title').textContent = t('ar.title', 'Վիրտուալ փորձարկում');
  root.querySelector('#ar-name').textContent = product.productName || '';
  root.querySelector('#ar-cat').textContent =
    `${t(definition.labelKey, FALLBACK_CATEGORY[category])} · ${t(`ar.target.${definition.target}`, FALLBACK_TARGET[definition.target])}`;
  root.querySelector('#ar-hint').textContent = t(definition.hintKey, FALLBACK_HINT[category]);
  root.querySelector('#ar-privacy').textContent = t('ar.privacy_note', FALLBACK_TEXT.privacy);
  root.querySelector('#ar-close').textContent = t('ar.close', FALLBACK_TEXT.close);
  root.querySelector('#ar-close-action').textContent = t('ar.close', FALLBACK_TEXT.close);
  const switchCameraButton = root.querySelector('#ar-switch-camera');
  const switchCameraLabel = t('ar.switch_camera', 'Փոխել տեսախցիկը');
  switchCameraButton.querySelector('#ar-switch-camera-label').textContent = switchCameraLabel;
  switchCameraButton.setAttribute('aria-label', switchCameraLabel);
  root.querySelector('[data-mode="live"]').textContent = t('ar.live', 'Ուղիղ փորձարկում');
  root.querySelector('[data-mode="photo"]').textContent = product.portraitUrl
    ? t('ar.saved_portrait', 'Իմ դիմանկարը')
    : t('ar.add_portrait', 'Ավելացնել իմ դիմանկարը');
  root.querySelectorAll('[data-close]').forEach((element) => element.addEventListener('click', closeTryOn));

  const currentRoot = root;
  const video = root.querySelector('#ar-video');
  const stack = root.querySelector('.ar-canvas-stack');
  const modeButtons = [...root.querySelectorAll('[data-mode]')];
  const useV2 = new URLSearchParams(location.search).get('tryon') === 'v2';
  let mode = 'live';
  let photoImage = null;
  let photoAssetImage = null;
  let photoAsset = null;
  let photoEarringModelRenderer = null;
  let photoHandModelRenderer = null;
  let modeRequest = 0;
  let currentPhotoLandmarks = null;
  let canvas = root.querySelector('#ar-canvas');

  const clearPhoto = () => {
    if (photoSolver) {
      photoSolver.close();
      photoSolver = null;
    }
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      photoUrl = null;
    }
    photoImage = null;
    photoAsset = null;
    photoAssetImage = null;
    currentPhotoLandmarks = null;
    if (photoEarringModelRenderer) {
      photoEarringModelRenderer.dispose();
      photoEarringModelRenderer = null;
    }
    if (photoHandModelRenderer) {
      photoHandModelRenderer.dispose();
      photoHandModelRenderer = null;
    }
  };
  const replaceCanvas = () => {
    const freshCanvas = canvas.cloneNode(false);
    canvas.replaceWith(freshCanvas);
    canvas = freshCanvas;
    return canvas;
  };
  const syncVideoBox = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const bounds = stack.parentElement.getBoundingClientRect();
    const aspect = video.videoWidth / video.videoHeight;
    const width = Math.max(bounds.width, bounds.height * aspect);
    stack.style.width = `${width}px`;
    stack.style.height = `${width / aspect}px`;
    stack.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  };
  video.addEventListener('loadedmetadata', syncVideoBox);
  modalResizeHandler = () => {
    if (mode === 'photo' && currentPhotoLandmarks) drawPhoto(currentPhotoLandmarks, modeRequest);
    else syncVideoBox();
  };
  window.addEventListener('resize', modalResizeHandler);
  window.addEventListener('orientationchange', modalResizeHandler);

  let cameraSwitching = false;
  switchCameraButton.addEventListener('click', async () => {
    if (!engine || cameraSwitching) return;
    cameraSwitching = true;
    switchCameraButton.disabled = true;
    try {
      await engine.switchCamera();
      syncVideoBox();
    } catch (error) {
      console.warn('Could not switch the try-on camera', error);
      applyStatus('nocam');
    } finally {
      cameraSwitching = false;
      switchCameraButton.disabled = false;
    }
  });

  const stage = root.querySelector('#ar-stage');
  const setMode = (nextMode) => {
    mode = nextMode;
    root.querySelector('#ar-hint').textContent = mode === 'photo'
      ? ''
      : t(definition.hintKey, FALLBACK_HINT[category]);
    root.querySelector('#ar-hint').classList.toggle('hidden', mode === 'photo');
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('border-luxe-gold', selected);
      button.classList.toggle('text-luxe-gold', selected);
      button.classList.toggle('border-border/20', !selected);
      button.classList.toggle('text-foreground/50', !selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    root.querySelector('#ar-switch-camera').classList.toggle('hidden', mode !== 'live');
  };
  const drawPhoto = (landmarks, requestId) => {
    if (requestId !== modeRequest || mode !== 'photo' || !photoImage) return;
    const width = 640;
    const height = Math.max(1, Math.round(width * photoImage.naturalHeight / photoImage.naturalWidth));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aspect = photoImage.naturalWidth / photoImage.naturalHeight;
    const bounds = stage.getBoundingClientRect();
    const displayWidth = Math.min(bounds.width, bounds.height * aspect);
    stack.style.width = `${displayWidth}px`;
    stack.style.height = `${displayWidth / aspect}px`;
    stack.style.aspectRatio = `${photoImage.naturalWidth} / ${photoImage.naturalHeight}`;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const landmarkData = {
      face: landmarks.face || null,
      pose: null,
      hands: landmarks.hands || [],
    };
    const points = photoEarringModelRenderer
      ? computeEarringModelPlacements(landmarkData, width, height)
      : photoHandModelRenderer
        ? computePlacements(category, landmarkData, width, height, { type: 'model3d' })
        : computePlacements(category, landmarkData, width, height, photoAsset);
    currentPhotoLandmarks = landmarks;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo try-on canvas is unavailable.');
    if (photoEarringModelRenderer || photoHandModelRenderer) {
      drawFrame(ctx, null, null, width, height, [], false, photoImage);
      const modelRenderer = photoEarringModelRenderer || photoHandModelRenderer;
      if (modelRenderer.width !== width || modelRenderer.height !== height) {
        modelRenderer.resize(width, height);
      }
      const modelPlacements = points.map((placement) => placement && ({
        ...placement,
      }));
      modelRenderer.render(modelPlacements);
      ctx.drawImage(modelRenderer.canvas, 0, 0, width, height);
    } else {
      drawFrame(ctx, null, photoAssetImage, width, height, points, false, photoImage);
    }
    applyStatus(points.some(Boolean) ? 'ready' : (definition.target === 'face' ? 'no-face' : 'no-hand'));
  };
  const startPhotoMode = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      applyStatus('image');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      applyStatus('load');
      root.querySelector('#ar-status').textContent = t('ar.status.photo_size', FALLBACK_TEXT.photo_size);
      return;
    }
    const requestId = ++modeRequest;
    engine?.stop();
    engine = null;
    clearPhoto();
    setMode('photo');
    modalRoot.classList.add('tryon-photo');
    view.mirror = false;
    replaceCanvas();
    video.classList.add('hidden');
    video.style.display = 'none';
    applyStatus('loading');
    photoUrl = URL.createObjectURL(file);
    try {
      photoImage = new Image();
      photoImage.src = photoUrl;
      await photoImage.decode();
      if (requestId !== modeRequest || mode !== 'photo') return;
      const hasPhotoModel = product.productModelUrl && (category === 'earrings' || category === 'rings' || category === 'bracelets' || category === 'watches');
      if (product.productImageUrl && !hasPhotoModel) {
        photoAssetImage = new Image();
        photoAssetImage.crossOrigin = 'anonymous';
        photoAssetImage.src = product.productImageUrl;
        await photoAssetImage.decode();
        if (requestId !== modeRequest || mode !== 'photo') return;
        photoAsset = analyzeAsset(photoAssetImage, category);
      } else if (!hasPhotoModel) {
        throw new Error('A transparent try-on PNG is required.');
      }
      if (hasPhotoModel) {
        const width = 640;
        const height = Math.max(1, Math.round(width * photoImage.naturalHeight / photoImage.naturalWidth));
        try {
          const renderer = category === 'earrings'
            ? await EarringModelRenderer.create(
              product.productModelUrl,
              width,
              height,
              product.productMetadataUrl,
            )
            : await HandModelRenderer.create(
              document.createElement('canvas'),
              product.productModelUrl,
              width,
              height,
              category,
              product.productMetadataUrl,
            );
          if (requestId !== modeRequest || mode !== 'photo') {
            renderer.dispose();
            return;
          }
          if (category === 'earrings') photoEarringModelRenderer = renderer;
          else photoHandModelRenderer = renderer;
        } catch (error) {
          if (requestId !== modeRequest || mode !== 'photo') return;
          console.error('Uploaded 3D try-on model failed to load', error);
          throw error;
        }
      }
      if (!photoAssetImage && !photoEarringModelRenderer && !photoHandModelRenderer) {
        throw new Error('A transparent try-on PNG is required.');
      }
      const solverEntry = await loadArSolver(definition.solvers[0]);
      if (requestId !== modeRequest || mode !== 'photo') return;
      photoSolver = new solverEntry.Ctor({ locateFile: solverEntry.locateFile });
      if (definition.solvers[0] === 'faceMesh') {
        photoSolver.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } else {
        photoSolver.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
      }
      photoSolver.onResults((results) => {
        drawPhoto({
          face: results.multiFaceLandmarks?.[0],
          hands: results.multiHandLandmarks || [],
        }, requestId);
      });
      await photoSolver.send({ image: photoImage });
    } catch (error) {
      if (requestId !== modeRequest) return;
      console.error('Photo try-on failed', error);
      clearPhoto();
      applyStatus(String(error?.message || '').includes('transparent try-on PNG') ? 'image' : 'load');
    }
  };

  const startSavedPortraitMode = async () => {
    try {
      const response = await fetch(product.portraitUrl, { credentials: 'include' });
      if (!response.ok) throw new Error(`Could not load saved portrait (${response.status}).`);
      const blob = await response.blob();
      const file = new File([blob], 'account-portrait.jpg', { type: blob.type || 'image/jpeg' });
      await startPhotoMode(file);
    } catch (error) {
      console.error('Could not load saved account portrait for try-on', error);
      applyStatus('load');
    }
  };

  const startLiveMode = async () => {
    const requestId = ++modeRequest;
    clearPhoto();
    setMode('live');
    modalRoot.classList.remove('tryon-photo');
    video.classList.remove('hidden');
    video.style.display = 'block';
    replaceCanvas();
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    if (useV2) {
      modalRoot.classList.add('tryon-v2');
      try {
        const { TryOnV2Engine } = await import('/js/ar/v2/engine.js');
        if (requestId !== modeRequest || mode !== 'live' || !currentRoot.isConnected) return;
        const badge = root.querySelector('#ar-basic-badge');
        const debugCanvas = root.querySelector('#ar-debug-canvas');
        debugCanvas.classList.toggle('hidden', new URLSearchParams(location.search).get('debug') !== '1');
        engine = new TryOnV2Engine({
          video,
          canvas,
          debugCanvas,
          category,
          imageUrl: product.productImageUrl,
          modelUrl: product.productModelUrl,
          metadataUrl: product.productMetadataUrl,
          onStatus: applyStatus,
          onQuality: (quality) => badge.classList.toggle('hidden', quality !== 'basic'),
        });
        void engine.start();
        syncVideoBox();
      } catch (error) {
        if (requestId !== modeRequest) return;
        console.error('Try-on v2 modules failed to load', error);
        applyStatus('load');
      }
      return;
    }
    modalRoot.classList.remove('tryon-v2');
    engine = new ArTryOnEngine({
      video,
      canvas,
      productCategory: category,
      productImageUrl: product.productImageUrl,
      productModelUrl: product.productModelUrl,
      productMetadataUrl: product.productMetadataUrl,
      onStatus: applyStatus,
    });
    void engine.start();
  };

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.mode === 'photo') {
      if (product.portraitUrl) {
        void startSavedPortraitMode();
      } else {
        location.href = '/account';
      }
    } else if (mode !== 'live') {
      void startLiveMode();
    }
  }));
  let swipeStart = null;
  stage.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      swipeStart = null;
      return;
    }
    swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (mode !== 'live' || !swipeStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - swipeStart.x;
    const dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      switchCameraButton.click();
    }
  }, { passive: true });

  loadDict().then((loaded) => {
    if (!loaded || root !== currentRoot || !currentRoot.isConnected) return;
    dict = loaded;
    currentRoot.querySelector('#ar-title').textContent = t('ar.title', 'Վիրտուալ փորձարկում');
    currentRoot.querySelector('#ar-cat').textContent =
      `${t(definition.labelKey, FALLBACK_CATEGORY[category])} · ${t(`ar.target.${definition.target}`, FALLBACK_TARGET[definition.target])}`;
    currentRoot.querySelector('#ar-hint').textContent = mode === 'photo'
      ? ''
      : t(definition.hintKey, FALLBACK_HINT[category]);
    currentRoot.querySelector('#ar-hint').classList.toggle('hidden', mode === 'photo');
    currentRoot.querySelector('#ar-privacy').textContent = t('ar.privacy_note', FALLBACK_TEXT.privacy);
    currentRoot.querySelector('#ar-close').textContent = t('ar.close', FALLBACK_TEXT.close);
    currentRoot.querySelector('#ar-close-action').textContent = t('ar.close', FALLBACK_TEXT.close);
    const switchCameraLabel = t('ar.switch_camera', 'Փոխել տեսախցիկը');
    currentRoot.querySelector('#ar-switch-camera-label').textContent = switchCameraLabel;
    currentRoot.querySelector('#ar-switch-camera').setAttribute('aria-label', switchCameraLabel);
    currentRoot.querySelector('[data-mode="live"]').textContent = t('ar.live', 'Ուղիղ փորձարկում');
    currentRoot.querySelector('[data-mode="photo"]').textContent = product.portraitUrl
      ? t('ar.saved_portrait', 'Իմ դիմանկարը')
      : t('ar.add_portrait', 'Ավելացնել իմ դիմանկարը');
    if (engine?._status) applyStatus(engine._status);
  });

  void startLiveMode();
}

export function closeTryOn() {
  document.removeEventListener('keydown', onEsc);
  if (modalResizeHandler) {
    window.removeEventListener('resize', modalResizeHandler);
    window.removeEventListener('orientationchange', modalResizeHandler);
    modalResizeHandler = null;
  }
  if (engine) {
    engine.stop();
    engine = null;
  }
  if (photoSolver) {
    photoSolver.close();
    photoSolver = null;
  }
  if (photoUrl) {
    URL.revokeObjectURL(photoUrl);
    photoUrl = null;
  }
  if (root) {
    root.remove();
    root = null;
  }
  if (document.body) document.body.style.overflow = '';
}

window.openTryOn = openTryOn;
window.closeTryOn = closeTryOn;
