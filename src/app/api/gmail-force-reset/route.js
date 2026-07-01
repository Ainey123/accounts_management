import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const accounts = await prisma.gmailAccount.findMany({
      select: { id: true, gmailEmail: true, syncedEmailIds: true },
    });

    const results = [];

    for (const account of accounts) {
      // Safely count previous IDs - handle both old and new formats
      let beforeCount = 0;
      const raw = account.syncedEmailIds || '';
      if (raw.includes('|')) {
        try { beforeCount = JSON.parse(raw.split('|')[1] || '[]').length; } catch {}
      } else {
        try { beforeCount = JSON.parse(raw || '[]').length; } catch {}
      }

      // Reset to start from January 2026 (monthIndex=0) with empty ID list
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: '0|[]' },
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
