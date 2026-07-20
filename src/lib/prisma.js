import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis;

if (typeof BigInt.prototype.toJSON !== 'function') {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || '';
  // Connection-pool hardening for Vercel serverless + session-mode Postgres.
  // Many concurrent lambda instances each open a handful of connections, which
  // quickly exceeds the DB's pool_size (e.g. 15) and throws EMAXCONNSESSION.
  // We keep each instance's connection_limit small so the global pool can serve
  // more concurrent functions without exhausting sessions.
  let pooledUrl = databaseUrl;

  // Extract existing query string (if any) without our managed params.
  const baseUrl = databaseUrl.split('?')[0];
  const existingParams = databaseUrl.includes('?')
    ? new URLSearchParams(databaseUrl.split('?')[1])
    : new URLSearchParams();

  const params = new URLSearchParams(existingParams);
  if (!params.has('connect_timeout')) params.set('connect_timeout', '15');
  if (!params.has('pool_timeout')) params.set('pool_timeout', '10');
  // Keep each serverless instance's footprint tiny so we never blow the DB pool.
  if (!params.has('connection_limit')) params.set('connection_limit', '2');
  if (!params.has('max_wait')) params.set('max_wait', '10');

  pooledUrl = `${baseUrl}?${params.toString()}`;

  const connLimit = params.get('connection_limit');
  console.log(`[prisma] Using connection_limit=${connLimit} (pool_timeout=${params.get('pool_timeout')}, max_wait=${params.get('max_wait')})`);

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