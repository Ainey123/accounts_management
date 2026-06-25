import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $func$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Ticket' AND column_name = 'jobMetadataId'
        ) THEN
          EXECUTE 'ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_jobMetadataId_key"';
          EXECUTE 'ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_jobMetadataId_fkey"';
          EXECUTE 'ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "jobMetadataId"';
        END IF;
      END;
      $func$;
    `);
    console.log('Schema fix applied: old Ticket.jobMetadataId removed');
  } catch (e) {
    console.error('Schema fix failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
