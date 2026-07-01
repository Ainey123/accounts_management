import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

async function resetSyncForFullImport() {
  console.log('Resetting synced email IDs for all Gmail accounts...\n');

  const accounts = await prisma.gmailAccount.findMany({
    select: { id: true, gmailEmail: true, syncedEmailIds: true },
  });

  console.log(`Found ${accounts.length} Gmail account(s):\n`);

  for (const account of accounts) {
    const count = JSON.parse(account.syncedEmailIds || '[]').length;
    console.log(`  ${account.gmailEmail}: ${count} previously synced IDs`);

    // Clear the synced IDs so all emails will be re-scanned
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: { syncedEmailIds: '[]' },
    });

    console.log(`  ✅ Cleared sync history for ${account.gmailEmail}`);
  }

  console.log('\nAll sync histories reset. Next sync will import ALL emails from 2026.');
  await prisma.$disconnect();
}

resetSyncForFullImport().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});