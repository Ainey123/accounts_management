import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    await prisma.$queryRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_jobMetadataId_key"`;
    await prisma.$queryRaw`ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_jobMetadataId_fkey"`;
    await prisma.$queryRaw`ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "jobMetadataId"`;
    return NextResponse.json({ success: true, step: 'fixed-ticket' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
