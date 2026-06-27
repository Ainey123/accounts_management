import { PrismaClient } from '@prisma/client';

async function reindex() {
  const prisma = new PrismaClient();

  try {
    // Get all tickets sorted by email date (oldest first)
    const tickets = await prisma.ticket.findMany({
      orderBy: { exactDate: 'asc' },
    });

    console.log(`Found ${tickets.length} tickets. Reindexing serial numbers by date (oldest = #001)...`);

    // Pass 1: Assign temporary serial numbers to avoid unique constraint collisions
    console.log('Pass 1: Assigning temporary serial numbers...');
    for (let i = 0; i < tickets.length; i++) {
      await prisma.ticket.update({
        where: { id: tickets[i].id },
        data: { serialNo: `__TEMP__${i}` },
      });
    }

    // Pass 2: Assign final chronological serial numbers
    console.log('Pass 2: Assigning final chronological serial numbers...');
    for (let i = 0; i < tickets.length; i++) {
      const newSerial = `#${String(i + 1).padStart(3, '0')}`;
      await prisma.ticket.update({
        where: { id: tickets[i].id },
        data: { serialNo: newSerial },
      });
    }

    // Show first 10 and last 10
    const final = await prisma.ticket.findMany({ orderBy: { exactDate: 'asc' }, take: 5 });
    const finalLast = await prisma.ticket.findMany({ orderBy: { exactDate: 'desc' }, take: 5 });
    
    console.log('\nOldest tickets (should have lowest serial numbers):');
    for (const t of final) {
      console.log(`  ${t.serialNo}  |  ${new Date(t.exactDate).toLocaleDateString()}  |  ${t.subject.substring(0, 60)}`);
    }
    console.log('\nNewest tickets (should have highest serial numbers):');
    for (const t of finalLast.reverse()) {
      console.log(`  ${t.serialNo}  |  ${new Date(t.exactDate).toLocaleDateString()}  |  ${t.subject.substring(0, 60)}`);
    }

    console.log(`\n✅ Done! ${tickets.length} tickets reindexed chronologically.`);
  } catch (err) {
    console.error('Reindex error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

reindex();
