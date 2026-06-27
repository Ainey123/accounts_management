import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
      }
    }
  });

  // Delete quratullainsabir@gmail.com
  await prisma.gmailAccount.deleteMany({
    where: { gmailEmail: 'quratullainsabir@gmail.com' }
  });
  console.log('Removed quratullainsabir@gmail.com');

  // Ensure fesopreations@gmail.com exists (it already does)
  const fes = await prisma.gmailAccount.findFirst({
    where: { gmailEmail: 'fesopreations@gmail.com' }
  });
  console.log('fesopreations@gmail.com status:', fes ? 'exists' : 'missing');

  const allAccounts = await prisma.gmailAccount.findMany({ select: { gmailEmail: true } });
  console.log('Remaining Gmail accounts:', allAccounts);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });