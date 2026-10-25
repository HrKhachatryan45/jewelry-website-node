// Analyses a transparent product PNG once at engine start so the tracker knows
// which part of the image to draw and where to hang it.
//
// The catalogue photos are not cut-outs of a single product: a ring photo may
// show a pair of rings, an earring photo two earrings, a necklace photo a long
// chain with a small pendant at the end. The analysis therefore splits the
// alpha channel into connected "blobs" and then picks the piece that matches
// the category:
//
//  - earrings   → up to two blobs (one per earlobe), sorted left → right;
//  - rings      → the single biggest solid blob (one ring, not the pair);
//  - necklaces  → the pendant at the bottom of the chain (dense rows), not the
//                 whole chain, so the overlay is a pendant and not a rope;
//  - bracelets  → the whole band.
//
// Every piece carries an anchor point (ax, ay in 0..1 of the piece) which is
// the point that has to land on the body: the top of an earring goes on the
// earlobe, the top of a pendant goes on the throat, a ring is centred on the
// finger, a bangle is centred on the wrist.

const ANALYSIS_SIZE = 100;
const MIN_BLOB_AREA = ANALYSIS_SIZE * ANALYSIS_SIZE * 0.006; // ≥0.6% of pixels
const CORE_SIZE = 5; // erosion kernel that finds the "solid" metal parts
const MIN_CORE_AREA = 8;
const PADDING = 0.04; // 4% breathing room around detected content
const PENDANT_PADDING = 0.12; // extra chain kept above a pendant
const MIN_PENDANT_RATIO = 0.06; // a pendant smaller than this is unreliable

function fullRect(image) {
  return { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 4-connected components over a boolean mask. Returns every component (even
// the tiny ones) plus a label map so pixels can be traced back to a component.
function components(mask, size) {
  const label = new Int32Array(size * size).fill(-1);
  const all = [];

  for (let start = 0; start < size * size; start++) {
    if (label[start] !== -1 || !mask[start]) continue;
    const id = all.length;
    const stack = [start];
    label[start] = id;
    let area = 0;
    let minX = size, minY = size, maxX = -1, maxY = -1, sumX = 0, sumY = 0;
    let first = start;

    while (stack.length) {
      const idx = stack.pop();
      const x = idx % size;
      const y = (idx / size) | 0;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && label[idx - 1] === -1 && mask[idx - 1]) { label[idx - 1] = id; stack.push(idx - 1); }
      if (x < size - 1 && label[idx + 1] === -1 && mask[idx + 1]) { label[idx + 1] = id; stack.push(idx + 1); }
      if (y > 0 && label[idx - size] === -1 && mask[idx - size]) { label[idx - size] = id; stack.push(idx - size); }
      if (y < size - 1 && label[idx + size] === -1 && mask[idx + size]) { label[idx + size] = id; stack.push(idx + size); }
    }

    all.push({ id, area, minX, minY, maxX, maxY, cx: sumX / area, cy: sumY / area, first });
  }

  return { label, all };
}

// Morphological erosion: a pixel survives when its whole CORE_SIZE window is
// set. Thin chains vanish, solid metal (pendant, ring, band) survives.
function erode(mask, size, k) {
  const half = (k - 1) / 2;
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let solid = 1;
      for (let dy = -half; dy <= half && solid; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) { solid = 0; break; }
        for (let dx = -half; dx <= half; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= size || !mask[yy * size + xx]) { solid = 0; break; }
        }
      }
      out[y * size + x] = solid;
    }
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function unionBox(boxes) {
  return boxes.reduce(
    (acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX),
      maxY: Math.max(acc.maxY, b.maxY),
    }),
    { minX: ANALYSIS_SIZE, minY: ANALYSIS_SIZE, maxX: -1, maxY: -1 }
  );
}

// Converts an analysis-space box to natural image pixels, padded and clamped.
function toSourceRect(box, image, pad = PADDING) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const scaleX = w / ANALYSIS_SIZE;
  const scaleY = h / ANALYSIS_SIZE;
  const bw = (box.maxX - box.minX + 1) * scaleX;
  const bh = (box.maxY - box.minY + 1) * scaleY;
  const padX = bw * pad;
  const padY = bh * pad;
  const sx = Math.max(0, box.minX * scaleX - padX);
  const sy = Math.max(0, box.minY * scaleY - padY);
  return {
    sx,
    sy,
    sw: Math.min(w - sx, bw + padX * 2),
    sh: Math.min(h - sy, bh + padY * 2),
  };
}

// Builds a drawable piece plus the anchor point (normalised inside the piece).
// The anchor is measured against the final (padded, clamped) source rect so it
// still points at the right pixel when the content touches the image border.
function makePiece(box, image, anchor, pad = PADDING) {
  const rect = toSourceRect(box, image, pad);
  const scaleX = image.naturalWidth / ANALYSIS_SIZE;
  const scaleY = image.naturalHeight / ANALYSIS_SIZE;
  const left = rect.sx / scaleX;
  const top = rect.sy / scaleY;
  const width = rect.sw / scaleX;
  const height = rect.sh / scaleY;
  return {
    ...rect,
    ax: clamp01((anchor.cx - left) / width),
    ay: clamp01((anchor.minY - top) / height),
  };
}

// Finds the pendant: the dense rows at the bottom of a necklace cut-out.
// The chain is a thin line (low row density), the pendant is a solid shape
// (high row density), so the bottom-most run of dense rows is the pendant.
// The run is trimmed to the rows that are nearly as dense as the peak, so the
// crop holds the pendant and not the converging chain above it.
function pendantBox(blob, mask, size) {
  const height = blob.maxY - blob.minY + 1;
  if (height < 8) return null;

  const densities = [];
  for (let y = blob.minY; y <= blob.maxY; y++) {
    let count = 0;
    for (let x = blob.minX; x <= blob.maxX; x++) {
      if (mask[y * size + x]) count += 1;
    }
    densities.push(count);
  }

  const filled = densities.filter((c) => c > 0);
  if (filled.length < 4) return null;

  const base = median(filled);
  const threshold = Math.max(base * 1.4, base + 2);

  let bottom = -1;
  for (let i = densities.length - 1; i >= 0; i -= 1) {
    if (densities[i] >= threshold) { bottom = i; break; }
  }
  if (bottom < 0) return null;

  // Pendant body: the rows that are nearly as wide as the widest row.
  const peak = Math.max(...densities.slice(0, bottom + 1));
  let top = bottom;
  while (top > 0 && densities[top - 1] >= peak * 0.75) top -= 1;
  if (top > 0) top -= 1; // keep one row of chain above the pendant

  const pendantHeight = bottom - top + 1;
  if (pendantHeight < 2) return null;

  let minX = size, maxX = -1;
  for (let y = blob.minY + top; y <= blob.minY + bottom; y += 1) {
    for (let x = blob.minX; x <= blob.maxX; x += 1) {
      if (!mask[y * size + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0 || maxX - minX + 1 < 4) return null;

  return { minX, minY: blob.minY + top, maxX, maxY: blob.minY + bottom };
}

// Distance between the two hanging strands of a chain, in source pixels.
// A necklace photo shows the chain spread open; worn on a person that spread
// is roughly the width of the neck, which makes it the most reliable size
// reference for the whole necklace.
function chainSpread(blob, mask, size, image) {
  const blobHeight = blob.maxY - blob.minY + 1;
  const rows = Math.max(3, Math.round(blobHeight * 0.25));
  let minX = size, maxX = -1;
  for (let y = blob.minY; y < blob.minY + rows; y += 1) {
    for (let x = blob.minX; x <= blob.maxX; x += 1) {
      if (!mask[y * size + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX <= minX) return 0;
  return (maxX - minX + 1) * (image.naturalWidth / size);
}

// Background areas that are fully enclosed by the product. The opening of a
// ring or a bangle is such a hole and is the most reliable way to find the
// jewellery itself: a photo often shows the ring on a stand or next to a
// second ring, and only the band around the hole is the product.
function findHoles(mask, size) {
  const bg = new Uint8Array(size * size);
  for (let i = 0; i < bg.length; i += 1) bg[i] = mask[i] ? 0 : 1;

  // Flood the background that touches the image border.
  const outside = new Uint8Array(size * size);
  const stack = [];
  const push = (idx) => {
    if (idx < 0 || idx >= bg.length || bg[idx] === 0 || outside[idx]) return;
    outside[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < size; x += 1) {
    push(x);
    push((size - 1) * size + x);
  }
  for (let y = 0; y < size; y += 1) {
    push(y * size);
    push(y * size + size - 1);
  }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % size;
    const y = (idx / size) | 0;
    if (x > 0) push(idx - 1);
    if (x < size - 1) push(idx + 1);
    if (y > 0) push(idx - size);
    if (y < size - 1) push(idx + size);
  }

  // Whatever background is left is enclosed.
  const holes = [];
  const seen = new Uint8Array(size * size);
  for (let start = 0; start < bg.length; start += 1) {
    if (!bg[start] || outside[start] || seen[start]) continue;
    const id = holes.length;
    const cells = [start];
    seen[start] = 1;
    let area = 0, minX = size, minY = size, maxX = -1, maxY = -1;
    while (cells.length) {
      const idx = cells.pop();
      const x = idx % size;
      const y = (idx / size) | 0;
      area += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (bg[ni] && !seen[ni]) {
          seen[ni] = 1;
          cells.push(ni);
        }
      }
    }
    holes.push({ id, area, minX, minY, maxX, maxY });
  }
  return holes;
}

// The band of metal around a hole = the jewellery itself.
function bandBox(hole, mask, size) {
  const pad = 3; // analysis cells — a band is a few cells thick
  const minX = Math.max(0, hole.minX - pad);
  const maxX = Math.min(size - 1, hole.maxX + pad);
  const minY = Math.max(0, hole.minY - pad);
  const maxY = Math.min(size - 1, hole.maxY + pad);
  let bx0 = size, by0 = size, bx1 = -1, by1 = -1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!mask[y * size + x]) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0 || bx1 - bx0 < 2 || by1 - by0 < 2) return null;
  return { minX: bx0, minY: by0, maxX: bx1, maxY: by1 };
}

// Returns { mode: 'single'|'pair', pieces: [{sx,sy,sw,sh,ax,ay}] }.
// Falls back to the full image when the canvas is tainted (cross-origin asset)
// or the image has no visible content.
export function analyzeAsset(image, category) {
  if (!image || !image.naturalWidth) {
    const rect = { sx: 0, sy: 0, sw: image?.naturalWidth || 1, sh: image?.naturalHeight || 1 };
    return { mode: 'single', pieces: [{ ...rect, ax: 0.5, ay: 0.5 }] };
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = ANALYSIS_SIZE;
    canvas.height = ANALYSIS_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const { data } = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

    const mask = new Uint8Array(ANALYSIS_SIZE * ANALYSIS_SIZE);
    for (let i = 0; i < mask.length; i += 1) mask[i] = data[i * 4 + 3] > 32 ? 1 : 0;

    const { label, all } = components(mask, ANALYSIS_SIZE);
    const blobs = all.filter((b) => b.area >= MIN_BLOB_AREA);
    if (!blobs.length) {
      const rect = fullRect(image);
      return { mode: 'single', pieces: [{ ...rect, ax: 0.5, ay: 0.5 }] };
    }

    // "Solid" parts: a ring, a pendant, a bangle body. Used to pick the piece
    // that actually is the product when a photo contains several objects.
    const coreMask = erode(mask, ANALYSIS_SIZE, CORE_SIZE);
    const cores = components(coreMask, ANALYSIS_SIZE).all.filter((c) => c.area >= MIN_CORE_AREA);
    const coreAreaByBlob = new Map();
    for (const core of cores) {
      const blobId = label[core.first];
      if (blobId < 0) continue;
      core.blobId = blobId;
      coreAreaByBlob.set(blobId, (coreAreaByBlob.get(blobId) || 0) + core.area);
    }

    const solidBlobs = blobs.filter((b) => coreAreaByBlob.has(b.id));
    const ranked = (solidBlobs.length ? solidBlobs : blobs).slice().sort((a, b) => {
      const ca = coreAreaByBlob.get(a.id) || 0;
      const cb = coreAreaByBlob.get(b.id) || 0;
      if (cb !== ca) return cb - ca;
      return b.area - a.area;
    });

    if (category === 'earrings') {
      // Two separate earrings in one photo → one per earlobe.
      const pair = ranked.slice(0, 2).sort((a, b) => a.cx - b.cx);
      if (pair.length === 2) {
        const topAnchor = (box) => ({ cx: (box.minX + box.maxX) / 2, minY: box.minY });
        return {
          mode: 'pair',
          pieces: [makePiece(pair[0], image, topAnchor(pair[0])), makePiece(pair[1], image, topAnchor(pair[1]))],
        };
      }
      const only = ranked[0];
      return {
        mode: 'single',
        pieces: [makePiece(only, image, { cx: (only.minX + only.maxX) / 2, minY: only.minY })],
      };
    }

    if (category === 'necklaces') {
      // The chain is only a prop — show the pendant that hangs from it, plus a
      // short stub of chain so the overlay reads as a necklace.
      const blob = ranked[0];
      const pendant = pendantBox(blob, mask, ANALYSIS_SIZE);
      const box = pendant || blob;
      const anchor = pendant
        ? { cx: (pendant.minX + pendant.maxX) / 2, minY: pendant.minY }
        : { cx: (blob.minX + blob.maxX) / 2, minY: blob.minY };

      // Keep a bit of the chain above the pendant, wide enough for the strands.
      const chainRows = pendant
        ? Math.max(0, Math.round((blob.maxY - blob.minY + 1) * 0.12))
        : 0;
      const crop = {
        minX: Math.min(box.minX, blob.minX),
        maxX: Math.max(box.maxX, blob.maxX),
        minY: Math.max(blob.minY, box.minY - chainRows),
        maxY: box.maxY,
      };

      const piece = makePiece(crop, image, anchor, PENDANT_PADDING);
      // Widths (source pixels) the tracker scales against the wearer's body:
      // the spread of the chain (≈ the neck) and the pendant itself.
      piece.spreadW = chainSpread(blob, mask, ANALYSIS_SIZE, image);
      piece.pendantW = ((box.maxX - box.minX + 1) * image.naturalWidth) / ANALYSIS_SIZE;

      return { mode: 'single', pieces: [piece] };
    }

    // Rings and bracelets: the metal around the opening is the product.
    const blob = ranked[0];
    const holes = findHoles(mask, ANALYSIS_SIZE)
      .filter((hole) => hole.area >= 6)
      .sort((a, b) => b.area - a.area);
    let box = null;
    for (const hole of holes) {
      box = bandBox(hole, mask, ANALYSIS_SIZE);
      if (box) break;
    }
    if (!box) box = blob;
    const anchor = { cx: (box.minX + box.maxX) / 2, minY: (box.minY + box.maxY) / 2 };
    return { mode: 'single', pieces: [makePiece(box, image, anchor)] };
  } catch {
    const rect = fullRect(image);
    return { mode: 'single', pieces: [{ ...rect, ax: 0.5, ay: 0.5 }] };
  }
}
