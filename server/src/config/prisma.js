import { PrismaClient } from '@prisma/client';

export const prisma = globalThis.__luxePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__luxePrisma = prisma;
}

export default prisma;
