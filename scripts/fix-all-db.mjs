import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
      }
    }
  });

  const allTickets = await prisma.ticket.findMany({
    select: { id: true, gmailAccountId: true, gmailMessageId: true }
  });

  const validAccountIds = new Set(
    (await prisma.gmailAccount.findMany({ select: { id: true } })).map(a => a.id)
  );

  let fixed = 0;
  for (const ticket of allTickets) {
    if (ticket.gmailAccountId && !validAccountIds.has(ticket.gmailAccountId)) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { gmailAccountId: null }
      });
      fixed++;
    }
  }

  console.log(`Fixed ${fixed} tickets with invalid gmailAccountId`);

  try {
    await prisma.$executeRaw`DROP INDEX IF EXISTS "Ticket_gmailAccountId_fkey"`;
  } catch (e) {}

  try {
    await prisma.$executeRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_gmailAccountId_fkey"`;
  } catch (e) {}

  try {
    await prisma.$executeRaw`ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_gmailAccountId_fkey" FOREIGN KEY ("gmailAccountId") REFERENCES "GmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
    console.log('Re-added FK constraint with SET NULL');
  } catch (e) {
    console.log('FK add error:', e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
