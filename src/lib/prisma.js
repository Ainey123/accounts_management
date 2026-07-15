import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis;

if (typeof BigInt.prototype.toJSON !== 'function') {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || '';
  // Add connection pool params for Vercel serverless if not already present
  const separator = databaseUrl.includes('?') ? '&' : '?';
  const pooledUrl = databaseUrl.includes('connect_timeout')
    ? databaseUrl
    : `${databaseUrl}${separator}connect_timeout=15&pool_timeout=15&connection_limit=5`;

  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: { url: pooledUrl },
    },
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache in both dev AND production to prevent connection storms on Vercel
globalForPrisma.prisma = prisma;

export { prisma };