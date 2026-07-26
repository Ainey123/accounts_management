import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const { purposeNotes } = await request.json();

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Valid account id is required' }, { status: 400 });
    }

    const account = await prisma.gmailAccount.findUnique({ where: { id } });
    if (!account) {
      return NextResponse.json({ error: 'Gmail account not found' }, { status: 404 });
    }

    const updated = await prisma.gmailAccount.update({
      where: { id },
      data: { purposeNotes: purposeNotes ?? null },
    });

    return NextResponse.json({
      account: {
        id: updated.id,
        gmailEmail: updated.gmailEmail,
        purposeNotes: updated.purposeNotes,
        syncedAt: updated.syncedAt,
      },
    });
  } catch (error) {
    console.error('Update Gmail purpose notes error:', error);
    return NextResponse.json({ error: 'Failed to update purpose notes' }, { status: 500 });
  }
}
