import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Custom replacer to support BigInt serialization
function jsonReplacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

async function runBackup() {
  const prisma = new PrismaClient();
  console.log('Connecting to database for checkpoint...');

  try {
    // 1. Fetch all data in dependency order
    const users = await prisma.user.findMany();
    const gmailAccounts = await prisma.gmailAccount.findMany();
    const tickets = await prisma.ticket.findMany();
    const jobMetadata = await prisma.jobMetadata.findMany();
    const surveyReports = await prisma.surveyReport.findMany();
    const quotationInvoices = await prisma.quotationInvoice.findMany();
    const expenses = await prisma.expense.findMany();

    const checkpointData = {
      timestamp: new Date().toISOString(),
      data: {
        users,
        gmailAccounts,
        tickets,
        jobMetadata,
        surveyReports,
        quotationInvoices,
        expenses
      }
    };

    const filename = `checkpoint-${Date.now()}.json`;
    const latestFilename = 'checkpoint-latest.json';

    const filepath = path.join(BACKUPS_DIR, filename);
    const latestFilepath = path.join(BACKUPS_DIR, latestFilename);

    // Save timestamped checkpoint
    fs.writeFileSync(filepath, JSON.stringify(checkpointData, jsonReplacer, 2));
    // Update latest link
    fs.writeFileSync(latestFilepath, JSON.stringify(checkpointData, jsonReplacer, 2));

    console.log(`Database checkpoint saved: ${filename}`);
    console.log(`Summary of exported records:`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Gmail Accounts: ${gmailAccounts.length}`);
    console.log(`- Tickets: ${tickets.length}`);
    console.log(`- Job Metadata: ${jobMetadata.length}`);
    console.log(`- Survey Reports: ${surveyReports.length}`);
    console.log(`- Quotation Invoices: ${quotationInvoices.length}`);
    console.log(`- Expenses: ${expenses.length}`);

  } catch (error) {
    console.error('Checkpoint failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
