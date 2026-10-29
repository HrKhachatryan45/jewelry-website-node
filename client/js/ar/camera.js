import { setFacing } from './view.js';

export async function startCamera(video, onFrame, facingMode = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Camera access requires HTTPS or localhost.');
    error.name = 'InsecureContextError';
    throw error;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: { exact: facingMode },
    },
  });
  try {
    setFacing(video, stream, facingMode);
    video.classList.remove('hidden');
    video.style.display = 'block';
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw error;
  }

  let active = true;
  let callbackId = 0;
  let lastTime = -1;
  const hasVideoCallback = typeof video.requestVideoFrameCallback === 'function';

  const frame = (now, metadata) => {
    if (!active) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      try {
        onFrame(now, metadata);
      } catch (error) {
        console.error('Try-on video frame failed', error);
      }
    }
    callbackId = hasVideoCallback
      ? video.requestVideoFrameCallback(frame)
      : requestAnimationFrame((time) => frame(time, { mediaTime: video.currentTime }));
  };

  callbackId = hasVideoCallback
    ? video.requestVideoFrameCallback(frame)
    : requestAnimationFrame((time) => frame(time, { mediaTime: video.currentTime }));

  const cleanup = () => {
    active = false;
    if (hasVideoCallback && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callbackId);
    else cancelAnimationFrame(callbackId);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
  cleanup.lowerQuality = async () => {
    const track = stream.getVideoTracks()[0];
    await track?.applyConstraints({ width: { ideal: 960 }, height: { ideal: 540 } });
  };
  return cleanup;
}
