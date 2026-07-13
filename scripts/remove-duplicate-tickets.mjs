import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

async function removeDuplicateTickets() {
  console.log('Scanning for duplicate tickets by subject...\n');

  // Get all tickets ordered by actual email/entry date (oldest first)
  const allTickets = await prisma.ticket.findMany({
    orderBy: { exactDate: 'asc' },
    select: { id: true, subject: true, serialNo: true, exactDate: true, jobMetadata: { select: { id: true } } },
  });

  console.log(`Total tickets found: ${allTickets.length}\n`);

  const groups = new Map(); // normalized subject -> tickets
  for (const ticket of allTickets) {
    const key = ticket.subject.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ticket);
  }

  const toDelete = [];
  let skippedConflicts = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const withMetadata = group.filter((t) => t.jobMetadata);
    if (withMetadata.length > 1) {
      // Multiple duplicates already have real job data attached — never
      // auto-delete work data. Leave this group for manual review.
      skippedConflicts += group.length;
      console.log(`CONFLICT: "${group[0].subject.substring(0, 60)}" has ${withMetadata.length} copies with job data — skipping, review manually.`);
      continue;
    }

    const keepId = withMetadata.length === 1 ? withMetadata[0].id : group[0].id; // earliest by exactDate if none have job data
    for (const t of group) {
      if (t.id !== keepId) {
        toDelete.push(t.id);
        console.log(`DUPLICATE: #${t.serialNo} "${t.subject.substring(0, 60)}" (will delete, keeping ticket id ${keepId})`);
      }
    }
  }

  if (skippedConflicts > 0) {
    console.log(`\n${skippedConflicts} tickets left untouched due to conflicting job data.`);
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