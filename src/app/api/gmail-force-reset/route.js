import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const accounts = await prisma.gmailAccount.findMany({
      select: { id: true, gmailEmail: true, syncedEmailIds: true },
    });

    const results = [];

    for (const account of accounts) {
      const beforeCount = JSON.parse(account.syncedEmailIds || '[]').length;

      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: '[]' },
      });

      results.push({
        email: account.gmailEmail,
        clearedIds: beforeCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sync history cleared for all accounts. Now trigger a sync to import ALL emails.',
      results,
    });
  } catch (error) {
    console.error('Force reset error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
