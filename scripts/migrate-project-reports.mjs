import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
      }
    }
  });

  console.log('Running safe additive migration for Project Reports...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectReportSubmission" (
      "id" SERIAL PRIMARY KEY,
      "jobMetadataId" INTEGER NOT NULL REFERENCES "JobMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "employeeId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "branchName" TEXT,
      "reportDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "version" INTEGER NOT NULL DEFAULT 1,
      "expenseData" TEXT,
      "progressData" TEXT,
      "totalExpenseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "overallProgressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "attachments" TEXT,
      "paidBy" TEXT NOT NULL DEFAULT 'FES',
      "reviewerNotes" TEXT,
      "reviewedById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "reviewedAt" TIMESTAMP(3),
      "linkedExpenseId" INTEGER REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectReportAudit" (
      "id" SERIAL PRIMARY KEY,
      "reportId" INTEGER NOT NULL REFERENCES "ProjectReportSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "action" TEXT NOT NULL,
      "changedById" INTEGER,
      "changedByName" TEXT,
      "version" INTEGER NOT NULL,
      "comment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProjectReportSubmission_jobMetadataId_idx" ON "ProjectReportSubmission"("jobMetadataId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProjectReportSubmission_employeeId_idx" ON "ProjectReportSubmission"("employeeId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProjectReportAudit_reportId_idx" ON "ProjectReportAudit"("reportId");
  `);

  console.log('Safe additive migration completed successfully!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
