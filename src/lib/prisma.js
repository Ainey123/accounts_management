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
  // Many concurrent lambda instances each open a connection, which
  // can exceed the DB's pool_size (e.g. 15) and throw EMAXCONNSESSION.
  // We keep each instance's connection_limit to 1 so the global pool can serve
  // more concurrent functions without exhausting sessions.
  let pooledUrl = databaseUrl;

  const baseUrl = databaseUrl.split('?')[0];
  const existingParams = databaseUrl.includes('?')
    ? new URLSearchParams(databaseUrl.split('?')[1])
    : new URLSearchParams();

  const params = new URLSearchParams(existingParams);
  params.set('connect_timeout', '20');
  params.set('pool_timeout', '20');
  params.set('connection_limit', '1');
  params.set('max_wait', '20');

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

/**
 * Executes a database operation with automatic retry on connection pool exhaustion / transient DB errors.
 */
export async function withDbRetry(fn, maxRetries = 3, baseDelayMs = 250) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errMsg = (err.message || '').toLowerCase();
      const isTransient =
        errMsg.includes('emaxconnsession') ||
        errMsg.includes('max clients reached') ||
        errMsg.includes('pool_size') ||
        errMsg.includes('p2024') ||
        errMsg.includes('connection timed out') ||
        errMsg.includes('connection refused') ||
        errMsg.includes('timed out fetching a new connection');

      if (isTransient && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 200);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        console.warn(`[prisma] Transient DB error (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export { prisma };