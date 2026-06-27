import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
      }
    }
  });

  try {
    await prisma.$executeRaw`DROP INDEX IF EXISTS "Ticket_gmailAccountId_fkey"`;
    console.log('Dropped index');
  } catch (e) {
    console.log('Index drop:', e.message);
  }

  try {
    await prisma.$executeRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_gmailAccountId_fkey"`;
    console.log('Dropped FK constraint');
  } catch (e) {
    console.log('FK drop:', e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
