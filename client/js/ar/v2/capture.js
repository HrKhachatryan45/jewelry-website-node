import { view } from '../view.js';

export function captureComposite(video, overlayCanvas, onCapture) {
  if (!video.videoWidth || !video.videoHeight) throw new Error('Camera frame is not ready.');
  const output = document.createElement('canvas');
  output.width = video.videoWidth;
  output.height = video.videoHeight;
  const context = output.getContext('2d');
  if (!context) throw new Error('Photo capture is unavailable.');

  const videoAspect = video.videoWidth / video.videoHeight;
  const overlayAspect = overlayCanvas.clientWidth / overlayCanvas.clientHeight;
  let sourceX = 0, sourceY = 0, sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
  if (videoAspect > overlayAspect) {
    sourceWidth = video.videoHeight * overlayAspect;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / overlayAspect;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  context.save();
  if (view.mirror) {
    context.translate(output.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
  context.restore();
  context.drawImage(overlayCanvas, 0, 0, overlayCanvas.width, overlayCanvas.height, 0, 0, output.width, output.height);

  return new Promise((resolve, reject) => {
    output.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create the photo.'));
        return;
      }
      Promise.resolve()
        .then(() => onCapture?.(blob))
        .then(() => resolve(blob), reject);
    }, 'image/png');
  });
}
