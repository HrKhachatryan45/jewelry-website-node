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
  const dest = ensureDir(path.join(UPLOAD_ROOT, subdir));
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
      cb(null, `${Date.now()}-${base}${ext}`);
    },
  });
}

const imageFilter = (_req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image uploads are allowed'));
};

export const uploadHero = multer({ storage: storage('hero'), fileFilter: imageFilter, limits: { fileSize: 12 * 1024 * 1024 } });
export const uploadMenu = multer({ storage: storage('menu'), fileFilter: imageFilter, limits: { fileSize: 12 * 1024 * 1024 } });
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
