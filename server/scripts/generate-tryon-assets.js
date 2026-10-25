// One-off/backfill: build transparent-PNG try-on assets for every product
// that has a main photo. Usage:
//   node scripts/generate-tryon-assets.js           # only missing assets
//   node scripts/generate-tryon-assets.js --force   # regenerate all
import prisma from '../src/config/prisma.js';
import { generateTryOnAsset } from '../src/services/tryonAsset.js';

const force = process.argv.includes('--force');

const items = await prisma.menuItem.findMany({
  where: { isActive: true, image: { not: null } },
  orderBy: { id: 'asc' },
});

console.log(`Processing ${items.length} products (force=${force})…`);
let ok = 0;
let skipped = 0;
let failed = 0;

for (const item of items) {
  try {
    const rel = await generateTryOnAsset(item, { force });
    if (rel === item.tryOnAsset && !force) {
      skipped += 1;
      console.log(`  = ${item.id} ${item.slug} (already has asset)`);
    } else {
      ok += 1;
      console.log(`  ✓ ${item.id} ${item.slug} -> ${rel}`);
    }
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${item.id} ${item.slug}: ${err.message}`);
  }
}

console.log(`Done. generated=${ok} skipped=${skipped} failed=${failed}`);
await prisma.$disconnect();
