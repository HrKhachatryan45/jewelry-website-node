// Copies the untouched Django `media/` tree into server/uploads so uploaded images
// (menu/, hero/, bespoke/) are available to the API without duplicating them in git.
// Run automatically via `npm run setup` (wired into postinstall).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../../media');
const DEST = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(SRC)) {
  console.warn(`[sync-uploads] source media/ not found at ${SRC}; skipping.`);
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(SRC, DEST, { recursive: true, force: false });
const count = fs.readdirSync(DEST).length;
console.log(`[sync-uploads] media/ -> uploads/ (top-level entries: ${count})`);
