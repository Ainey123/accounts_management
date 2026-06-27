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
    await prisma.$executeRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_gmailAccountId_fkey"`;
    console.log('Dropped constraint Ticket_gmailAccountId_fkey');
  } catch (e) {
    console.log('Drop error:', e.message);
  }

  try {
    const result = await prisma.$executeRaw`ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_gmailAccountId_fkey" FOREIGN KEY ("gmailAccountId") REFERENCES "GmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
    console.log('Re-added FK with SET NULL');
  } catch (e) {
    console.log('Add FK error:', e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
