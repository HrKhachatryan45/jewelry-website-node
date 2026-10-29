import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storage(subdir) {
  const diskStorage = multer.diskStorage({
    destination: (_req, file, cb) => {
      const directory = file.fieldname === 'model_3d_file' ? 'models' : subdir;
      cb(null, ensureDir(path.join(UPLOAD_ROOT, directory)));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
      cb(null, `${Date.now()}-${base}${ext}`);
    },
  });
  return {
    _handleFile(req, file, cb) {
      const maxSize = file.fieldname === 'model_3d_file'
        ? 80 * 1024 * 1024
        : 12 * 1024 * 1024;
      let size = 0;
      file.stream.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxSize) {
          const error = new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
          file.stream.destroy(error);
        }
      });
      diskStorage._handleFile(req, file, cb);
    },
    _removeFile: diskStorage._removeFile.bind(diskStorage),
  };
}

const imageFilter = (_req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else {
    const error = new Error('Only image uploads are allowed');
    error.status = 400;
    cb(error);
  }
};

const productFileFilter = (_req, file, cb) => {
  if (file.fieldname === 'model_3d_file') {
    const isGlb = path.extname(file.originalname).toLowerCase() === '.glb';
    const acceptedMimeTypes = new Set(['application/octet-stream', 'model/gltf-binary', 'application/gltf-buffer']);
    if (isGlb && acceptedMimeTypes.has(file.mimetype)) cb(null, true);
    else {
      const error = new Error('Only binary .glb 3D models are allowed');
      error.status = 400;
      cb(error);
    }
    return;
  }
  imageFilter(_req, file, cb);
};

export const uploadHero = multer({ storage: storage('hero'), fileFilter: imageFilter, limits: { fileSize: 12 * 1024 * 1024 } });
export const uploadMenu = multer({
  storage: storage('menu'),
  fileFilter: productFileFilter,
  limits: { fileSize: 80 * 1024 * 1024, files: 8 },
});
export const uploadBespoke = multer({ storage: storage('bespoke'), fileFilter: imageFilter, limits: { fileSize: 12 * 1024 * 1024 } });
export const uploadPortrait = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Relative path (stored in DB) for a multer file, e.g. "menu/1712-foo.webp".
export function relPath(file) {
  if (!file) return null;
  return path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
}
