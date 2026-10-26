// Canvas compositor: camera frame + transparent product placements.
// Draws at most once per display frame (engine throttles via rAF).

// Draws the product so that its anchor point (ax, ay inside the source rect)
// lands exactly on the tracked body position.
export function drawFrame(ctx, video, image, w, h, placements, mirrored = true, backgroundImage = null) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, w, h);
  } else if (video && video.readyState >= 2) {
    // The preview may be mirrored for a selfie-style view.
    ctx.save();
    if (mirrored) ctx.setTransform(-1, 0, 0, 1, w, 0);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  }

  if (!image || !placements || !placements.length) return;

  for (const p of placements) {
    if (!p.w || !p.h) continue;
    const ax = p.ax == null ? 0.5 : p.ax;
    const ay = p.ay == null ? 0.5 : p.ay;
    const dx = -p.w * ax;
    const dy = -p.h * ay;

    ctx.save();
    ctx.translate(mirrored ? p.x : w - p.x, p.y);
    ctx.rotate(mirrored ? p.rot : -p.rot);

    // Soft contact shadow so the piece reads as "in front of" the body.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = Math.max(4, p.w * 0.08);
    ctx.shadowOffsetY = Math.max(1, p.h * 0.03);
    ctx.drawImage(image, p.sx, p.sy, p.sw, p.sh, dx, dy, p.w, p.h);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(image, p.sx, p.sy, p.sw, p.sh, dx, dy, p.w, p.h);
    ctx.restore();
  }
}
