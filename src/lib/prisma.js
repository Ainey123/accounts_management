import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log: ['error', 'warn'],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { prisma };