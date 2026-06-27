import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LATEST_CHECKPOINT = path.join(__dirname, '..', 'backups', 'checkpoint-latest.json');

async function runRestore() {
  if (!fs.existsSync(LATEST_CHECKPOINT)) {
    console.error('No checkpoint found. Please create a checkpoint first.');
    return;
  }

  const checkpoint = JSON.parse(fs.readFileSync(LATEST_CHECKPOINT, 'utf-8'));
  const prisma = new PrismaClient();
  
  console.log(`Loading checkpoint from: ${checkpoint.timestamp}`);
  const { data } = checkpoint;

  try {
    // 1. Restore Users
    console.log('Restoring Users...');
    for (const u of data.users || []) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          password: u.password,
          role: u.role,
          employeeName: u.employeeName,
          activeStatus: u.activeStatus,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        },
        create: {
          id: u.id,
          email: u.email,
          password: u.password,
          role: u.role,
          employeeName: u.employeeName,
          activeStatus: u.activeStatus,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        }
      });
    }

    // 2. Restore GmailAccounts
    console.log('Restoring Gmail Accounts...');
    for (const ga of data.gmailAccounts || []) {
      await prisma.gmailAccount.upsert({
        where: { id: ga.id },
        update: {
          userId: ga.userId,
          gmailEmail: ga.gmailEmail,
          accessToken: ga.accessToken,
          refreshToken: ga.refreshToken,
          expiryDate: BigInt(ga.expiryDate),
          syncedAt: new Date(ga.syncedAt),
          createdAt: new Date(ga.createdAt),
          updatedAt: new Date(ga.updatedAt),
          syncedEmailIds: ga.syncedEmailIds,
        },
        create: {
          id: ga.id,
          userId: ga.userId,
          gmailEmail: ga.gmailEmail,
          accessToken: ga.accessToken,
          refreshToken: ga.refreshToken,
          expiryDate: BigInt(ga.expiryDate),
          syncedAt: new Date(ga.syncedAt),
          createdAt: new Date(ga.createdAt),
          updatedAt: new Date(ga.updatedAt),
          syncedEmailIds: ga.syncedEmailIds,
        }
      });
    }

    // 3. Restore Tickets
    console.log('Restoring Tickets...');
    for (const t of data.tickets || []) {
      await prisma.ticket.upsert({
        where: { id: t.id },
        update: {
          gmailAccountId: t.gmailAccountId,
          gmailMessageId: t.gmailMessageId,
          serialNo: t.serialNo,
          exactDate: new Date(t.exactDate),
          time: t.time,
          subject: t.subject,
          sender: t.sender,
          createdAt: new Date(t.createdAt),
          createdById: t.createdById,
        },
        create: {
          id: t.id,
          gmailAccountId: t.gmailAccountId,
          gmailMessageId: t.gmailMessageId,
          serialNo: t.serialNo,
          exactDate: new Date(t.exactDate),
          time: t.time,
          subject: t.subject,
          sender: t.sender,
          createdAt: new Date(t.createdAt),
          createdById: t.createdById,
        }
      });
    }

    // 4. Restore JobMetadata
    console.log('Restoring Job Metadata...');
    for (const j of data.jobMetadata || []) {
      await prisma.jobMetadata.upsert({
        where: { id: j.id },
        update: {
          ticketId: j.ticketId,
          clientName: j.clientName,
          branchName: j.branchName,
          personOfContact: j.personOfContact,
          workNature: j.workNature,
          assignedEmployeeId: j.assignedEmployeeId,
          createdById: j.createdById,
          createdAt: new Date(j.createdAt),
          updatedAt: new Date(j.updatedAt),
        },
        create: {
          id: j.id,
          ticketId: j.ticketId,
          clientName: j.clientName,
          branchName: j.branchName,
          personOfContact: j.personOfContact,
          workNature: j.workNature,
          assignedEmployeeId: j.assignedEmployeeId,
          createdById: j.createdById,
          createdAt: new Date(j.createdAt),
          updatedAt: new Date(j.updatedAt),
        }
      });
    }

    // 5. Restore SurveyReports
    console.log('Restoring Survey Reports...');
    for (const sr of data.surveyReports || []) {
      await prisma.surveyReport.upsert({
        where: { id: sr.id },
        update: {
          jobMetadataId: sr.jobMetadataId,
          createdById: sr.createdById,
          reportText: sr.reportText,
          createdAt: new Date(sr.createdAt),
          updatedAt: new Date(sr.updatedAt),
        },
        create: {
          id: sr.id,
          jobMetadataId: sr.jobMetadataId,
          createdById: sr.createdById,
          reportText: sr.reportText,
          createdAt: new Date(sr.createdAt),
          updatedAt: new Date(sr.updatedAt),
        }
      });
    }

    // 6. Restore QuotationInvoices
    console.log('Restoring Quotation Invoices...');
    for (const qi of data.quotationInvoices || []) {
      await prisma.quotationInvoice.upsert({
        where: { id: qi.id },
        update: {
          jobMetadataId: qi.jobMetadataId,
          createdById: qi.createdById,
          poNumber: qi.poNumber,
          status: qi.status,
          documentType: qi.documentType,
          lineItems: qi.lineItems,
          createdAt: new Date(qi.createdAt),
          updatedAt: new Date(qi.updatedAt),
        },
        create: {
          id: qi.id,
          jobMetadataId: qi.jobMetadataId,
          createdById: qi.createdById,
          poNumber: qi.poNumber,
          status: qi.status,
          documentType: qi.documentType,
          lineItems: qi.lineItems,
          createdAt: new Date(qi.createdAt),
          updatedAt: new Date(qi.updatedAt),
        }
      });
    }

    // 7. Restore Expenses
    console.log('Restoring Expenses...');
    for (const e of data.expenses || []) {
      await prisma.expense.upsert({
        where: { id: e.id },
        update: {
          jobMetadataId: e.jobMetadataId,
          createdById: e.createdById,
          amount: e.amount,
          imageUrl: e.imageUrl,
          summaryNotes: e.summaryNotes,
          createdAt: new Date(e.createdAt),
        },
        create: {
          id: e.id,
          jobMetadataId: e.jobMetadataId,
          createdById: e.createdById,
          amount: e.amount,
          imageUrl: e.imageUrl,
          summaryNotes: e.summaryNotes,
          createdAt: new Date(e.createdAt),
        }
      });
    }

    // Reset sequences in PostgreSQL so next inserts don't collide
    console.log('Resetting database ID auto-increment sequences...');
    const tables = ['User', 'GmailAccount', 'Ticket', 'JobMetadata', 'SurveyReport', 'QuotationInvoice', 'Expense'];
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${table}";`);
      } catch (err) {
        // Safe to ignore if running on SQLite
      }
    }

    console.log('Database restore complete!');
  } catch (error) {
    console.error('Restore failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runRestore();
