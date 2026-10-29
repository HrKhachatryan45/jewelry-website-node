export const view = { mirror: true };

export function setFacing(video, stream, requested) {
  const facingMode = stream.getVideoTracks()[0]?.getSettings?.().facingMode || requested;
  view.mirror = facingMode === 'user';
  video.style.transform = view.mirror ? 'scaleX(-1)' : 'none';
}

export const mx = (x) => (view.mirror ? 1 - x : x);
