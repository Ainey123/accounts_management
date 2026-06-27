import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
      }
    }
  });
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, activeStatus: true } });
  console.log(JSON.stringify(users, null, 2));
  const accounts = await prisma.gmailAccount.findMany({ select: { id: true, gmailEmail: true, userId: true } });
  console.log('Gmail accounts:', JSON.stringify(accounts, null, 2));
  const tickets = await prisma.ticket.count();
  console.log('Total tickets:', tickets);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
