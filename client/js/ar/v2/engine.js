import * as THREE from 'three';
import { OneEuroFilter } from './filters/OneEuroFilter.js';
import { startCamera } from '../camera.js';
import { captureComposite } from './capture.js';
import { createTrackers, detectTrackers, closeTrackers } from './trackers.js';
import { TryOnRenderer } from './renderer.js';

function cameraErrorCode(error) {
  if (error?.name === 'InsecureContextError') return 'insecure';
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError' || error?.name === 'SecurityError') return 'denied';
  if (error?.name === 'NotFoundError' || error?.name === 'NotReadableError' || error?.name === 'OverconstrainedError') return 'nocam';
  return 'load';
}

function smoothLandmarks(landmarks, filters, timestamp) {
  if (!landmarks) return null;
  return landmarks.map((point, index) => {
    const perPoint = filters[index] || (filters[index] = [new OneEuroFilter(), new OneEuroFilter(), new OneEuroFilter()]);
    return {
      ...point,
      x: perPoint[0].filter(point.x, timestamp),
      y: perPoint[1].filter(point.y, timestamp),
      z: perPoint[2].filter(point.z || 0, timestamp),
    };
  });
}

function resetFilterGroup(points) {
  points.forEach((axes) => axes.forEach((filter) => filter.reset()));
}

function projectedPoint(point, video, canvas) {
  const videoAspect = video.videoWidth / video.videoHeight;
  const viewAspect = canvas.clientWidth / canvas.clientHeight;
  if (videoAspect > viewAspect) {
    const visibleWidth = viewAspect / videoAspect;
    return { x: (point.x - (1 - visibleWidth) / 2) / visibleWidth * canvas.clientWidth, y: point.y * canvas.clientHeight };
  }
  const visibleHeight = videoAspect / viewAspect;
  return { x: point.x * canvas.clientWidth, y: (point.y - (1 - visibleHeight) / 2) / visibleHeight * canvas.clientHeight };
}

export class TryOnV2Engine {
  constructor({ video, canvas, debugCanvas, category, imageUrl, modelUrl, metadataUrl, onStatus, onQuality, onCapture }) {
    Object.assign(this, { video, canvas, debugCanvas, category, imageUrl, modelUrl, metadataUrl, onStatus, onQuality, onCapture });
    this.active = false;
    this.trackers = {};
    this.renderer = null;
    this.stopCamera = null;
    this.facingMode = 'user';
    this.latest = {};
    this.lastValid = {};
    this.lastSeen = 0;
    this.wasTracking = false;
    this.fadeInStart = 0;
    this.lastFrameTime = -1;
    this.facePositionFilters = [new OneEuroFilter(), new OneEuroFilter(), new OneEuroFilter()];
    this.faceLandmarkFilters = [];
    this.handFilters = new Map();
    this.worldHandFilters = new Map();
    this.depthFilters = new Map();
    this.frameTimes = [];
    this.lowFpsSince = 0;
    this.droppedQuality = false;
    this.lastFaceQuaternion = new THREE.Quaternion();
    this.hasFaceQuaternion = false;
    this.lastFaceTimestamp = 0;
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.onStatus('loading');
    try {
      this.trackers = await createTrackers(this.category);
      if (!this.active) {
        closeTrackers(this.trackers);
        this.trackers = {};
        return;
      }
      this.renderer = await TryOnRenderer.create(this.canvas, this.video, this.category, {
        imageUrl: this.imageUrl,
        modelUrl: this.modelUrl,
        metadataUrl: this.metadataUrl,
        debug: this.debug,
      });
      if (!this.active) {
        this.renderer.dispose();
        this.renderer = null;
        closeTrackers(this.trackers);
        this.trackers = {};
        return;
      }
      this.onQuality(this.renderer.quality);
      this.canvas.width = 1;
      this.canvas.height = 1;
      this.video.classList.remove('hidden');
      this.video.style.display = 'block';
      this.canvas.style.display = 'block';
      this.onStatus('loading');
      this.stopCamera = await startCamera(this.video, this.handleFrame, this.facingMode);
      if (!this.active) {
        this.stopCamera();
        this.stopCamera = null;
      } else {
        if (!this.lastSeen) this.onStatus(this.category === 'earrings' || this.category === 'necklaces' ? 'no-face' : 'no-hand');
      }
    } catch (error) {
      this.stop();
      console.error('Try-on v2 failed to start', error);
      this.onStatus(cameraErrorCode(error));
    }
  }

  handleFrame = (now, metadata) => {
    if (!this.active || !this.renderer) return;
    const timestamp = Math.max(0, Math.round((metadata?.mediaTime ?? this.video.currentTime) * 1000));
    if (timestamp === this.lastFrameTime) return;
    this.lastFrameTime = timestamp;
    const timeSeconds = timestamp / 1000;
    const result = detectTrackers(this.trackers, this.video, timestamp);
    this.latest = result;

    if (result.face?.faceLandmarks?.[0]) {
      result.face.faceLandmarks[0] = smoothLandmarks(result.face.faceLandmarks[0], this.faceLandmarkFilters, timeSeconds);
      const faceMatrix = result.face.facialTransformationMatrixes?.[0];
      if (faceMatrix?.data?.length === 16) {
        const matrix = new THREE.Matrix4().fromArray(faceMatrix.data);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);
        position.set(
          this.facePositionFilters[0].filter(position.x, timeSeconds),
          this.facePositionFilters[1].filter(position.y, timeSeconds),
          this.facePositionFilters[2].filter(position.z, timeSeconds)
        );
        if (this.hasFaceQuaternion) {
          const angularSpeed = this.lastFaceQuaternion.angleTo(quaternion) / Math.max(1 / 60, (timestamp - this.lastFaceTimestamp) / 1000);
          const alpha = THREE.MathUtils.clamp(0.12 + angularSpeed * 0.025, 0.12, 0.65);
          this.lastFaceQuaternion.slerp(quaternion, alpha);
        } else {
          this.lastFaceQuaternion.copy(quaternion);
          this.hasFaceQuaternion = true;
        }
        this.lastFaceTimestamp = timestamp;
        matrix.compose(position, this.lastFaceQuaternion, scale);
        faceMatrix.data = matrix.toArray();
      }
    }
    if (result.hand?.landmarks) {
      const order = result.hand.landmarks
        .map((_, index) => index)
        .sort((a, b) => (result.hand.handedness?.[b]?.[0]?.score ?? 0) - (result.hand.handedness?.[a]?.[0]?.score ?? 0));
      const handKey = (index) => result.hand.handedness?.[index]?.[0]?.categoryName || `hand-${index}`;
      const orderedHandKeys = order.map(handKey);
      result.hand.landmarks = order.map((sourceIndex) => {
        const key = handKey(sourceIndex);
        const filters = this.handFilters.get(key) || [];
        this.handFilters.set(key, filters);
        return smoothLandmarks(result.hand.landmarks[sourceIndex], filters, timeSeconds);
      });
      result.hand.worldLandmarks = result.hand.worldLandmarks?.length
        ? order.map((sourceIndex) => {
          const key = handKey(sourceIndex);
          const filters = this.worldHandFilters.get(key) || [];
          this.worldHandFilters.set(key, filters);
          return smoothLandmarks(result.hand.worldLandmarks[sourceIndex], filters, timeSeconds);
        })
        : [];
      result.hand.handedness = order.map((sourceIndex) => result.hand.handedness?.[sourceIndex]);
      result.hand.depths = result.hand.landmarks.map((hand, index) => {
        const palmWidth = Math.hypot(hand[5].x - hand[17].x, hand[5].y - hand[17].y);
        const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
        const rawDepth = THREE.MathUtils.clamp(
          0.085 / Math.max(0.01, palmWidth * 2 * Math.tan(THREE.MathUtils.degToRad(30)) * aspect),
          0.2,
          1.2
        );
        const key = orderedHandKeys[index];
        const filter = this.depthFilters.get(key) || new OneEuroFilter();
        this.depthFilters.set(key, filter);
        return filter.filter(rawDepth, timeSeconds);
      });
    }

    const found = this.category === 'earrings' || this.category === 'necklaces'
      ? Boolean(result.face?.facialTransformationMatrixes?.length)
      : Boolean(result.hand?.landmarks?.length && (result.hand.handedness?.[0]?.[0]?.score ?? 0) >= 0.6);
    if (found) {
      if (!this.wasTracking) this.fadeInStart = now;
      this.lastValid = result;
      this.lastSeen = now;
      this.onStatus(this.droppedQuality ? 'low-fps' : 'ready');
    }
    const elapsedSinceFound = this.lastSeen ? now - this.lastSeen : Infinity;
    if (elapsedSinceFound > 300) {
      this.facePositionFilters.forEach((filter) => filter.reset());
      this.handFilters.forEach(resetFilterGroup);
      this.worldHandFilters.forEach(resetFilterGroup);
      resetFilterGroup(this.faceLandmarkFilters);
      this.depthFilters.forEach((filter) => filter.reset());
      this.hasFaceQuaternion = false;
    }
    const renderResult = found ? result : elapsedSinceFound <= 150 ? this.lastValid : {};
    const opacity = found
      ? Math.min(1, Math.max(0, (now - this.fadeInStart) / 200))
      : elapsedSinceFound <= 150 ? 1 : Math.max(0, 1 - (elapsedSinceFound - 150) / 200);
    this.renderer.render(renderResult, opacity, now);
    this.drawDebug(renderResult, now);
    this.updateFps(now);
    if (!found && opacity === 0) this.onStatus(this.category === 'earrings' || this.category === 'necklaces' ? 'no-face' : 'no-hand');
    this.wasTracking = found;
  };

  updateFps(now) {
    this.frameTimes.push(now);
    while (this.frameTimes.length && this.frameTimes[0] < now - 2000) this.frameTimes.shift();
    const fps = this.frameTimes.length / 2;
    if (fps < 20) {
      if (!this.lowFpsSince) this.lowFpsSince = now;
      if (now - this.lowFpsSince >= 2000 && !this.droppedQuality) {
        this.droppedQuality = true;
        this.renderer.setLowQuality(true);
        this.stopCamera?.lowerQuality?.().catch((error) => console.warn('Could not lower camera resolution', error));
        this.onStatus('low-fps');
      }
    } else {
      this.lowFpsSince = 0;
    }
    this.onFps?.(Math.round(fps));
  }

  drawDebug(results, fps) {
    if (!this.debug || !this.debugCanvas) return;
    const canvas = this.debugCanvas;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.save();
    ctx.translate(rect.width, 0);
    ctx.scale(-1, 1);
    ctx.fillText(`FPS ${Math.round(this.frameTimes.length / 2)} · ${performance.now() - this.lastSeen < 350 ? 'tracking' : 'searching'}`, 12, 20);
    ctx.restore();
    const points = results.face?.faceLandmarks?.[0] || results.hand?.landmarks?.[0] || [];
    ctx.fillStyle = '#00ff9d';
    points.forEach((point) => {
      const projected = projectedPoint(point, this.video, canvas);
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    void fps;
  }

  async takePhoto() {
    return captureComposite(this.video, this.canvas, this.onCapture);
  }

  async switchCamera() {
    if (!this.active || !this.stopCamera) return;
    const previousFacingMode = this.facingMode;
    const nextFacingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.stopCamera();
    this.stopCamera = null;
    this.facingMode = nextFacingMode;
    this.onStatus('loading');
    try {
      this.stopCamera = await startCamera(this.video, this.handleFrame, this.facingMode);
    } catch (error) {
      this.facingMode = previousFacingMode;
      try {
        this.stopCamera = await startCamera(this.video, this.handleFrame, previousFacingMode);
      } catch (restoreError) {
        this.onStatus(cameraErrorCode(restoreError));
        throw restoreError;
      }
      this.onStatus(cameraErrorCode(error));
      throw error;
    }
  }

  stop() {
    this.active = false;
    this.stopCamera?.();
    this.stopCamera = null;
    closeTrackers(this.trackers);
    this.trackers = {};
    this.wasTracking = false;
    this.renderer?.dispose();
    this.renderer = null;
  }
}
