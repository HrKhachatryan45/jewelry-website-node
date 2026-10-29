import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_ROOT } from '../middleware/upload.js';

const MODEL_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'models');

export function uploadedModelFilename(value) {
  if (typeof value !== 'string' || /^https?:\/\//i.test(value)) return null;
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//i, '');
  if (!normalized.startsWith('models/')) return null;
  const filename = normalized.slice('models/'.length);
  if (!filename || path.posix.basename(filename) !== filename || path.posix.extname(filename).toLowerCase() !== '.glb') {
    return null;
  }
  return filename;
}

async function referencedModelFilenames(prisma) {
  const products = await prisma.menuItem.findMany({ select: { model3d: true } });
  return new Set(products.map((product) => uploadedModelFilename(product.model3d)).filter(Boolean));
}

async function unlinkIfPresent(filePath, warnings) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    console.error(`Could not remove unused model upload "${path.basename(filePath)}".`, error);
    warnings.push(path.basename(filePath));
  }
}

export async function removeUnusedModelUpload(prisma, modelPath) {
  const filename = uploadedModelFilename(modelPath);
  if (!filename) return [];

  const references = await referencedModelFilenames(prisma);
  if (references.has(filename)) return [];

  const warnings = [];
  const glbPath = path.join(MODEL_UPLOAD_DIR, filename);
  const metadataPath = path.join(
    MODEL_UPLOAD_DIR,
    `${filename.slice(0, -path.posix.extname(filename).length)}.json`,
  );
  await unlinkIfPresent(glbPath, warnings);
  await unlinkIfPresent(metadataPath, warnings);
  return warnings;
}

export async function cleanupUnusedModelUploads(prisma, { apply = false } = {}) {
  const references = await referencedModelFilenames(prisma);
  const entries = await fs.readdir(MODEL_UPLOAD_DIR, { withFileTypes: true });
  const regularFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const unusedModels = regularFiles.filter(
    (filename) => path.posix.extname(filename).toLowerCase() === '.glb' && !references.has(filename),
  );
  const unusedMetadata = regularFiles.filter((filename) => {
    if (path.posix.extname(filename).toLowerCase() !== '.json') return false;
    const modelFilename = `${path.posix.basename(filename, path.posix.extname(filename))}.glb`;
    return !references.has(modelFilename);
  });
  const unusedFiles = [...unusedModels, ...unusedMetadata].sort();
  const warnings = [];

  if (apply) {
    for (const filename of unusedFiles) {
      // eslint-disable-next-line no-await-in-loop
      await unlinkIfPresent(path.join(MODEL_UPLOAD_DIR, filename), warnings);
    }
  }

  return { unusedFiles, warnings };
}
