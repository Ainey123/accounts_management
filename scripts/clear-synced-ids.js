const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.gmailAccount.updateMany({
    data: {
      syncedEmailIds: '[]'
    }
  });
  console.log('Cleared syncedEmailIds array for all Gmail accounts.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
