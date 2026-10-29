import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { cleanupUnusedModelUploads } from '../src/services/modelUploads.js';

const apply = process.argv.includes('--apply');

try {
  const { unusedFiles, warnings } = await cleanupUnusedModelUploads(prisma, { apply });
  if (unusedFiles.length) {
    console.log(`${apply ? 'Unused model uploads' : 'Would remove'} (${unusedFiles.length}):`);
    unusedFiles.forEach((filename) => console.log(`- ${filename}`));
  } else {
    console.log('No unused model uploads found.');
  }
  if (warnings.length) {
    console.error(`Failed to remove ${warnings.length} file(s): ${warnings.join(', ')}`);
    process.exitCode = 1;
  } else if (!apply && unusedFiles.length) {
    console.log('Run "npm run models:cleanup -- --apply" to delete these files.');
  }
} finally {
  await prisma.$disconnect();
}
