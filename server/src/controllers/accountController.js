import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import prisma from '../config/prisma.js';

const PRIVATE_PORTRAIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../private/portraits');

function portraitUrl(user) {
  return user.portraitPath
    ? `/api/account/portrait/image?v=${encodeURIComponent(user.updatedAt.toISOString())}`
    : null;
}

export async function getPortrait(req, res) {
  res.json({ portraitUrl: portraitUrl(req.user) });
}

export async function sendPortrait(req, res) {
  if (!req.user.portraitPath) return res.status(404).json({ error: 'No portrait is saved.' });
  const filePath = path.resolve(PRIVATE_PORTRAIT_ROOT, req.user.portraitPath);
  if (!filePath.startsWith(`${PRIVATE_PORTRAIT_ROOT}${path.sep}`)) {
    return res.status(404).json({ error: 'Portrait not found.' });
  }
  const image = await fs.readFile(filePath);
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.type('image/jpeg').send(image);
}

export async function uploadPortraitImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });

  const metadata = await sharp(req.file.buffer, { limitInputPixels: 40000000 }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    return res.status(415).json({ error: 'Upload a JPEG, PNG, or WebP image.' });
  }

  const image = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer();
  await fs.mkdir(PRIVATE_PORTRAIT_ROOT, { recursive: true });
  const filename = `${req.user.id}-${randomUUID()}.jpg`;
  const filePath = path.join(PRIVATE_PORTRAIT_ROOT, filename);
  await fs.writeFile(filePath, image, { flag: 'wx' });

  let user;
  try {
    user = await prisma.user.update({
      where: { id: req.user.id },
      data: { portraitPath: filename },
    });
  } catch (error) {
    await fs.unlink(filePath);
    throw error;
  }

  if (req.user.portraitPath) {
    const oldPath = path.resolve(PRIVATE_PORTRAIT_ROOT, req.user.portraitPath);
    if (oldPath.startsWith(`${PRIVATE_PORTRAIT_ROOT}${path.sep}`)) {
      await fs.unlink(oldPath).catch((error) => {
        if (error.code !== 'ENOENT') {
          console.error('Could not remove replaced account portrait:', error);
        }
      });
    }
  }

  res.json({ portraitUrl: portraitUrl(user) });
}

export async function deletePortrait(req, res) {
  const portraitPath = req.user.portraitPath;
  await prisma.user.update({
    where: { id: req.user.id },
    data: { portraitPath: null },
  });

  if (portraitPath) {
    const filePath = path.resolve(PRIVATE_PORTRAIT_ROOT, portraitPath);
    if (filePath.startsWith(`${PRIVATE_PORTRAIT_ROOT}${path.sep}`)) {
      await fs.unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
  res.json({ success: true, portraitUrl: null });
}
