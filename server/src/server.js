import env from './config/env.js';
import prisma from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Luxe Jewelry API listening on ${env.hostUrl} (port ${env.port})`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
