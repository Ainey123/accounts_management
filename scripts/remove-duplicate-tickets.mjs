import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

async function removeDuplicateTickets() {
  console.log('Scanning for duplicate tickets by subject...\n');

  // Get all tickets ordered by creation date (oldest first)
  const allTickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, subject: true, serialNo: true, createdAt: true },
  });

  console.log(`Total tickets found: ${allTickets.length}\n`);

  const seen = new Map(); // subject -> first ticket id
  const toDelete = [];

  for (const ticket of allTickets) {
    const key = ticket.subject.trim().toLowerCase();
    if (seen.has(key)) {
      toDelete.push(ticket.id);
      console.log(`DUPLICATE: #${ticket.serialNo} "${ticket.subject.substring(0, 60)}" (will delete, keeping #${seen.get(key)})`);
    } else {
      seen.set(key, ticket.serialNo);
    }
  }

  if (toDelete.length === 0) {
    console.log('\nNo duplicate tickets found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nTotal duplicates to remove: ${toDelete.length}`);

  // Delete in batches to avoid overwhelming the DB
  const BATCH_SIZE = 50;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const result = await prisma.ticket.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleted ${result.count} duplicates`);
  }

  console.log(`\n✅ Successfully removed ${deleted} duplicate tickets!`);
  await prisma.$disconnect();
}

removeDuplicateTickets().catch((err) => {
  console.error('Error removing duplicates:', err);
  process.exit(1);
});