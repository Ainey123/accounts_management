import { PrismaClient } from '@prisma/client';

async function fixSerials() {
  const prisma = new PrismaClient();

  try {
    // First check how many tickets have broken __TEMP__ serials
    const broken = await prisma.ticket.count({
      where: { serialNo: { startsWith: '__TEMP__' } }
    });
    console.log(`Found ${broken} tickets with broken __TEMP__ serial numbers.`);

    if (broken === 0) {
      console.log('No broken serials to fix. Proceeding to chronological reindex...');
    } else {
      // Fix broken serials with a single raw SQL UPDATE using row_number
      console.log('Fixing broken serials with batch SQL...');
      await prisma.$executeRawUnsafe(`
        UPDATE "Ticket" 
        SET "serialNo" = '#' || LPAD(sub.rn::text, 3, '0')
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "exactDate" ASC, id ASC) as rn
          FROM "Ticket"
        ) sub
        WHERE "Ticket".id = sub.id
      `);
      console.log('All serial numbers reindexed in one query!');
    }

    // Verify results
    const oldest = await prisma.ticket.findMany({ orderBy: { exactDate: 'asc' }, take: 3 });
    const newest = await prisma.ticket.findMany({ orderBy: { exactDate: 'desc' }, take: 3 });
    const total = await prisma.ticket.count();

    console.log(`\nTotal tickets: ${total}`);
    console.log('\nOldest (should have lowest serial):');
    for (const t of oldest) {
      console.log(`  ${t.serialNo}  |  ${new Date(t.exactDate).toLocaleDateString()}  |  ${t.subject?.substring(0, 50)}`);
    }
    console.log('\nNewest (should have highest serial):');
    for (const t of newest) {
      console.log(`  ${t.serialNo}  |  ${new Date(t.exactDate).toLocaleDateString()}  |  ${t.subject?.substring(0, 50)}`);
    }

    console.log('\n✅ Done!');
  } catch (err) {
    console.error('Fix error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixSerials();
