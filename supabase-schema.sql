-- Run this entire script in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/cheqzrvucqlrdtlvfirk/editor

CREATE TABLE IF NOT EXISTS "User" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'EMPLOYEE',
  "employeeName" VARCHAR(255) NOT NULL,
  "activeStatus" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "GmailAccount" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "gmailEmail" VARCHAR(255) UNIQUE NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiryDate" BIGINT NOT NULL,
  "syncedAt" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "syncedEmailIds" TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS "Ticket" (
  id SERIAL PRIMARY KEY,
  "gmailAccountId" INTEGER REFERENCES "GmailAccount"(id) ON DELETE SET NULL,
  "gmailMessageId" VARCHAR(255) UNIQUE NOT NULL,
  "serialNo" VARCHAR(50) UNIQUE NOT NULL,
  "exactDate" TIMESTAMP NOT NULL,
  time VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  sender TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "jobMetadataId" INTEGER UNIQUE
);

CREATE TABLE IF NOT EXISTS "JobMetadata" (
  id SERIAL PRIMARY KEY,
  "ticketId" INTEGER UNIQUE NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "clientName" TEXT NOT NULL,
  "branchName" TEXT NOT NULL,
  "personOfContact" TEXT NOT NULL,
  "workNature" TEXT NOT NULL,
  "assignedEmployeeId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SurveyReport" (
  id SERIAL PRIMARY KEY,
  "jobMetadataId" INTEGER UNIQUE NOT NULL REFERENCES "JobMetadata"(id) ON DELETE CASCADE,
  "reportText" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "QuotationInvoice" (
  id SERIAL PRIMARY KEY,
  "jobMetadataId" INTEGER NOT NULL REFERENCES "JobMetadata"(id) ON DELETE CASCADE,
  "poNumber" TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  "documentType" VARCHAR(50) DEFAULT 'QUOTATION',
  "lineItems" TEXT DEFAULT '[]',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Expense" (
  id SERIAL PRIMARY KEY,
  "jobMetadataId" INTEGER NOT NULL REFERENCES "JobMetadata"(id) ON DELETE CASCADE,
  amount FLOAT NOT NULL,
  "imageUrl" TEXT,
  "summaryNotes" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ticket_serial ON "Ticket"("serialNo");
CREATE INDEX IF NOT EXISTS idx_ticket_gmail ON "Ticket"("gmailMessageId");
CREATE INDEX IF NOT EXISTS idx_job_ticket ON "JobMetadata"("ticketId");
CREATE INDEX IF NOT EXISTS idx_gmail_user ON "GmailAccount"("userId");
CREATE INDEX IF NOT EXISTS idx_survey_job ON "SurveyReport"("jobMetadataId");
CREATE INDEX IF NOT EXISTS idx_quote_job ON "QuotationInvoice"("jobMetadataId");
CREATE INDEX IF NOT EXISTS idx_expense_job ON "Expense"("jobMetadataId");
