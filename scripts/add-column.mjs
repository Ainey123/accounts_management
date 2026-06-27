import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
      }
    }
  });

  try {
    await prisma.$executeRaw`ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "createdById" INTEGER`;
    console.log('Added createdById column');
    
    await prisma.$executeRaw`ALTER TABLE "Ticket" ADD CONSTRAINT IF NOT EXISTS "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
    console.log('Added FK constraint');
  } catch (e) {
    console.log('Migration note:', e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });