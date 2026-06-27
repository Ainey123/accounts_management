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
    await prisma.$executeRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_jobMetadataId_key"`;
    console.log('Dropped constraint Ticket_jobMetadataId_key');
  } catch (e) {
    console.log('Constraint drop result:', e.message);
  }

  try {
    await prisma.$executeRaw`ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "jobMetadataId"`;
    console.log('Dropped column jobMetadataId');
  } catch (e) {
    console.log('Column drop result:', e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
