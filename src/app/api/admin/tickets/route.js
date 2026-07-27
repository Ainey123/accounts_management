export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    const existing = await prisma.ticket.findUnique({
      where: { id },
      include: { jobMetadata: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    await prisma.ticket.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Delete ticket error:', error);
    return NextResponse.json({ error: 'Failed to delete ticket', details: error.message }, { status: 500 });
  }
}