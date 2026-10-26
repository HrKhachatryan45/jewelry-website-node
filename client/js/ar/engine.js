// AR try-on engine: camera → MediaPipe tracking → canvas overlay.
//
// Responsibilities are split across small modules:
//   loader.js   – dynamic MediaPipe CDN loading (per solution, on demand)
//   asset.js    – transparent-PNG content analysis (trim, pendant, earring pair)
//   tracker.js  – landmark → placement maths
//   renderer.js – canvas compositing
//   categories.js – what a product is and which body part it needs
// This file only orchestrates: start/stop lifecycle, frame pumping, smoothing,
// detection hysteresis and status reporting.

import { loadArSolver } from './loader.js';
import { startCamera } from './camera.js';
import { analyzeAsset } from './asset.js';
import { computePlacements, computeRingModelPlacements } from './tracker.js';
import { drawFrame } from './renderer.js';
import { AR_CATEGORIES, normalizeCategory } from './categories.js';
import { HandModelRenderer } from './model3d.js';

const CANVAS_W = 640;
const LOST_MS = 400; // grace time before hiding the overlay / showing a warning
const SMOOTH_POS = 0.4;
const SMOOTH_SIZE = 0.35;
const SMOOTH_ROT = 0.3;
const MAX_SEND_ERRORS = 10;
const FIRST_RESULT_TIMEOUT_MS = 12000;
const FALLBACK_SOLVER_MS = 1500; // wait before adding the heavier fallback solver

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const err = new Error(`Failed to load product image: ${src}`);
      err.code = 'image';
      reject(err);
    };
    img.src = src;
  });
}

function classifyCameraError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'NotReadableError' || name === 'TrackStartError' || name === 'OverconstrainedError') return 'nocam';
  return 'load';
}

function shortestAngle(delta) {
  let a = delta;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class ArTryOnEngine {
  constructor({ video, canvas, modelCanvas, productCategory, productImageUrl, productModelUrl, onStatus = () => {} }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.category = normalizeCategory(productCategory);
    this.def = this.category ? AR_CATEGORIES[this.category] : null;
    this.imageUrl = productImageUrl;
    this.modelUrl = productModelUrl;
    this.modelCanvas = modelCanvas;
    this.onStatus = onStatus;

    this._running = false;
    this._status = 'loading';
    this._camera = null;
    this._facingMode = 'user';
    this._solvers = [];
    this._solverKeys = new Set();
    this._lm = { face: null, pose: null, hands: [] };
    this._image = null;
    this._asset = null;
    this._modelRenderer = null;
    this._raf = 0;
    this._lostAt = 0;
    this._slots = new Map();
    this._lastPlacements = null;
    this._sendErrors = 0;
    this._gotResults = false;
    this._watchdog = 0;
    this._fallbackTimer = 0;
    this._w = CANVAS_W;
    this._h = Math.round(CANVAS_W * 0.75);
  }

  async start() {
    if (this._running) return;
    if (!this.def) {
      const err = new Error('Unsupported try-on category');
      err.code = 'load';
      this._setStatus('load');
      return;
    }
    this._running = true;
    this._setStatus('loading');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const err = new Error('Insecure context');
        err.code = 'insecure';
        throw err;
      }
      if (!this.modelUrl && !this.imageUrl) {
        const err = new Error('A transparent try-on PNG is required');
        err.code = 'image';
        throw err;
      }
      if (!this.ctx) {
        const err = new Error('Canvas unavailable');
        err.code = 'load';
        throw err;
      }

      if (this.modelUrl) {
        this._modelRenderer = await HandModelRenderer.create(this.modelCanvas, this.modelUrl, this._w, this._h);
      } else {
        this._image = await loadImage(this.imageUrl);
        this._asset = analyzeAsset(this._image, this.category);
      }
      if (!this._running) return this._dispose();

      // Only the primary tracker is loaded up front; the fallback (pose for
      // necklaces) is added later, and only if the target is not found.
      await this._ensureSolver(this.def.solvers[0]);
      if (!this._running) return this._dispose();

      try {
        this._camera = await startCamera(this.video, () => this._pump(), this._facingMode);
      } catch (err) {
        const code = classifyCameraError(err);
        const e = new Error(err && err.message ? err.message : code);
        e.code = code;
        throw e;
      }
      if (!this._running) return this._dispose();

      this._syncCanvasSize();

      this._watchdog = window.setTimeout(() => {
        if (this._running && !this._gotResults) this._fail('load');
      }, FIRST_RESULT_TIMEOUT_MS);

      if (this.def.solvers.length > 1) {
        this._fallbackTimer = window.setTimeout(() => {
          this._fallbackTimer = 0;
          if (this._running && !this._targetFound()) {
            this._ensureSolver(this.def.solvers[1]).catch(() => { /* fallback is optional */ });
          }
        }, FALLBACK_SOLVER_MS);
      }

      this._setStatus('ready');
      this._draw();
    } catch (err) {
      const code = (err && err.code) || classifyCameraError(err);
      this.stop();
      this._setStatus(code);
    }
  }

  stop() {
    this._running = false;
    this._dispose();
  }

  async switchCamera() {
    if (!this._running || !this._camera) return;
    const previousFacingMode = this._facingMode;
    const nextFacingMode = this._facingMode === 'user' ? 'environment' : 'user';
    this._camera();
    this._camera = null;
    this._facingMode = nextFacingMode;
    this._setStatus('loading');
    try {
      this._camera = await startCamera(this.video, () => this._pump(), this._facingMode);
      this._syncCanvasSize();
    } catch (err) {
      this._facingMode = previousFacingMode;
      try {
        this._camera = await startCamera(this.video, () => this._pump(), previousFacingMode);
        this._syncCanvasSize();
      } catch (restoreError) {
        this._setStatus(classifyCameraError(restoreError));
        throw restoreError;
      }
      this._setStatus(classifyCameraError(err));
      throw err;
    }
  }

  // Idempotent: safe to call repeatedly (also used when start() is aborted).
  _dispose() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    if (this._watchdog) {
      clearTimeout(this._watchdog);
      this._watchdog = 0;
    }
    if (this._fallbackTimer) {
      clearTimeout(this._fallbackTimer);
      this._fallbackTimer = 0;
    }
    if (this._camera) {
      try { this._camera(); } catch { /* already stopped */ }
      this._camera = null;
    }
    for (const solver of this._solvers) {
      try { solver.instance.close(); } catch { /* already closed */ }
    }
    this._solvers = [];
    this._solverKeys.clear();
    this._lm = { face: null, pose: null, hands: [] };
    this._slots.clear();
    this._lastPlacements = null;
    this._lostAt = 0;
    this._image = null;
    this._asset = null;
    if (this._modelRenderer) {
      this._modelRenderer.dispose();
      this._modelRenderer = null;
    }
    this._sendErrors = 0;
    this._gotResults = false;
  }

  async _ensureSolver(key) {
    if (!key || this._solverKeys.has(key)) return;
    this._solverKeys.add(key);
    let entry;
    try {
      entry = await loadArSolver(key);
    } catch (err) {
      this._solverKeys.delete(key);
      throw err;
    }
    if (!this._running) return;
    this._solvers.push(this._createSolver(entry));
  }

  _createSolver({ key, Ctor, locateFile }) {
    const instance = new Ctor(locateFile ? { locateFile } : undefined);
    instance.setOptions(this._optionsFor(key));
    instance.onResults((results) => this._onResults(key, results));
    return { key, instance, busy: false };
  }

  _optionsFor(key) {
    if (key === 'faceMesh') {
      return {
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
    }
    if (key === 'pose') {
      return {
        modelComplexity: 0, // lightest model; pose is only the necklace fallback
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
    }
    return {
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    };
  }

  // The body part this category needs is in frame?
  _targetFound() {
    if (!this.def) return false;
    if (this.def.target === 'hand') return (this._lm.hands || []).length > 0;
    return !!this._lm.face;
  }

  // Keeps the canvas at the camera's aspect ratio so the feed is never
  // stretched (landmarks are normalised to the video frame).
  _syncCanvasSize() {
    if (!this.canvas || !this.video) return;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return;
    const height = Math.round(CANVAS_W * (vh / vw));
    if (this.canvas.width !== CANVAS_W || this.canvas.height !== height) {
      this.canvas.width = CANVAS_W;
      this.canvas.height = height;
    }
    this._w = CANVAS_W;
    this._h = height;
    if (this._modelRenderer) this._modelRenderer.resize(CANVAS_W, height);
  }

  // One camera frame → every active solution. Per-solver busy guards skip a
  // frame under load instead of queueing (keeps the feed at 30+ FPS).
  _pump = async () => {
    if (!this._running) return;
    try {
      await Promise.all(
        this._solvers.map(async (solver) => {
          if (solver.busy) return;
          solver.busy = true;
          try {
            await solver.instance.send({ image: this.video });
          } finally {
            solver.busy = false;
          }
        })
      );
      this._sendErrors = 0;
    } catch (err) {
      if (!this._running) return;
      this._sendErrors += 1;
      if (this._sendErrors > MAX_SEND_ERRORS) this._fail('load');
    }
  };

  _onResults = (key, results) => {
    if (!this._running) return;
    this._gotResults = true;
    if (this._watchdog) {
      clearTimeout(this._watchdog);
      this._watchdog = 0;
    }
    if (key === 'faceMesh') {
      this._lm.face = (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) || null;
    } else if (key === 'pose') {
      this._lm.pose = results.poseLandmarks || null;
    } else {
      this._lm.hands = results.multiHandLandmarks || [];
    }
    // The primary tracker found the target — the fallback is not needed.
    if (this._fallbackTimer && this._targetFound()) {
      clearTimeout(this._fallbackTimer);
      this._fallbackTimer = 0;
    }
    this._scheduleDraw();
  };

  _scheduleDraw() {
    if (this._raf || !this._running) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._draw();
    });
  }

  _draw() {
    this._raf = 0;
    if (!this._running || !this.ctx) return;
    const w = this._w;
    const h = this._h;

    let placements = [];
    if (this._modelRenderer) {
      placements = computeRingModelPlacements(this._lm, w, h);
    } else if (this._image && this._asset) {
      try {
        placements = computePlacements(this.category, this._lm, w, h, this._asset);
      } catch {
        placements = [];
      }
    }

    if (placements.length) {
      this._lostAt = 0;
      const smoothed = placements.map((p) => this._smooth(p));
      this._lastPlacements = smoothed;
      if (this._status !== 'ready') this._setStatus('ready');
      if (this._modelRenderer) {
        drawFrame(this.ctx, this.video, null, w, h, [], false);
        this._modelRenderer.render(smoothed.map((placement) => ({
          ...placement,
          x: w - placement.x,
          rot: -placement.rot,
        })));
      } else {
        drawFrame(this.ctx, this.video, this._image, w, h, smoothed, false);
      }
      return;
    }

    // Nothing tracked this frame.
    if (!this._lostAt) this._lostAt = performance.now();
    const elapsed = performance.now() - this._lostAt;

    if (elapsed < LOST_MS && this._lastPlacements) {
      // Brief dropout: freeze the last overlay instead of flickering off.
      if (this._modelRenderer) {
        drawFrame(this.ctx, this.video, null, w, h, [], false);
        this._modelRenderer.render(this._lastPlacements.map((placement) => ({
          ...placement,
          x: w - placement.x,
          rot: -placement.rot,
        })));
      } else {
        drawFrame(this.ctx, this.video, this._image, w, h, this._lastPlacements, false);
      }
      return;
    }

    this._lastPlacements = null;
    this._slots.clear();
    if (this._modelRenderer) {
      drawFrame(this.ctx, this.video, null, w, h, [], false);
      this._modelRenderer.render([]);
    } else {
      drawFrame(this.ctx, this.video, this._image, w, h, [], false);
    }

    if (elapsed >= LOST_MS) {
      const lostStatus = this.def && this.def.target === 'hand' ? 'no-hand' : 'no-face';
      if (this._status !== lostStatus) this._setStatus(lostStatus);
    }
  }

  // Exponential smoothing per overlay slot so the product glides instead of jittering.
  _smooth(p) {
    const prev = this._slots.get(p.key);
    if (!prev) {
      const fresh = { ...p };
      this._slots.set(p.key, fresh);
      return fresh;
    }
    const next = {
      key: p.key,
      sx: p.sx,
      sy: p.sy,
      sw: p.sw,
      sh: p.sh,
      ax: p.ax,
      ay: p.ay,
      x: prev.x + (p.x - prev.x) * SMOOTH_POS,
      y: prev.y + (p.y - prev.y) * SMOOTH_POS,
      w: prev.w + (p.w - prev.w) * SMOOTH_SIZE,
      h: prev.h + (p.h - prev.h) * SMOOTH_SIZE,
      rot: prev.rot + shortestAngle(p.rot - prev.rot) * SMOOTH_ROT,
    };
    this._slots.set(p.key, next);
    return next;
  }

  _fail(code) {
    if (!this._running) return;
    this.stop();
    this._setStatus(code);
  }

  _setStatus(status) {
    this._status = status;
    try {
      this.onStatus(status);
    } catch {
      /* UI already torn down */
    }
  }
}
