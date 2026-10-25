// Generates a transparent-PNG "try-on asset" from a product's main photo.
// The cut-out is what the AR try-on engine draws over the live camera feed,
// so it must keep a real alpha channel.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import prisma from '../config/prisma.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';

const OUT_DIR = path.join(UPLOAD_ROOT, 'tryon');
const MAX_DIM = 1400; // keep cut-outs lightweight for the browser

function resolveSource(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  const clean = String(imagePath).replace(/^\/+/, '');
  const abs = clean.startsWith('uploads/') ? path.resolve(UPLOAD_ROOT, '..', clean) : path.join(UPLOAD_ROOT, clean);
  return fs.existsSync(abs) ? abs : null;
}

async function readSource(source) {
  if (source.startsWith('http')) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch source image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.promises.readFile(source);
}

// Cuts the product out of its photo and writes uploads/tryon/<id>.png.
// Source can be any format (our catalogue is mostly WebP); we normalise to a
// downscaled PNG first, because the background-removal model only reads PNG/JPEG.
// Returns the DB-relative path ("tryon/<id>.png") or null when nothing can be done.
export async function generateTryOnAsset(item, { force = false } = {}) {
  if (!item || !item.image) return null;
  if (item.tryOnAsset && !force) return item.tryOnAsset;

  const source = resolveSource(item.image);
  if (!source) return null;

  const input = await readSource(source);
  const png = await sharp(input)
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  // The decoder sniffs the MIME off the Blob, so pass a typed Blob, not a raw Buffer.
  const blob = await removeBackground(new Blob([png], { type: 'image/png' }), {
    device: 'cpu',
  });
  const buffer = Buffer.from(await blob.arrayBuffer());

  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const rel = `tryon/${item.id}.png`;
  await fs.promises.writeFile(path.join(UPLOAD_ROOT, rel), buffer);

  await prisma.menuItem.update({ where: { id: item.id }, data: { tryOnAsset: rel } });
  return rel;
}

// Fire-and-forget helper for the admin product create/update flow.
export function scheduleTryOnAsset(itemId) {
  prisma.menuItem
    .findUnique({ where: { id: itemId } })
    .then((item) => generateTryOnAsset(item, { force: true }))
    .catch((err) => {
      console.warn(`[tryon] asset generation failed for product ${itemId}:`, err.message);
    });
}
