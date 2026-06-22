import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';

// Save synced emails to database
export async function POST(request) {
  try {
    const data = await request.json();
    const { emails, gmailAccountId } = data;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: 'Emails array is required' }, { status: 400 });
    }

    const savedTickets = [];

    for (const email of emails) {
      const { gmailMessageId, subject, sender, exactDate, time } = email;

      // Check for duplicate
      const existing = await prisma.ticket.findUnique({
        where: { gmailMessageId },
      });

      if (existing) {
        continue; // Skip duplicate
      }

      const serialNo = await nextTicketSerialNo();
      const parsedDate = exactDate ? new Date(exactDate) : new Date();
      const timeStr = time || new Date().toLocaleTimeString('en-US', { hour12: true });

      const ticket = await prisma.ticket.create({
        data: {
          gmailAccountId: gmailAccountId || null,
          gmailMessageId,
          serialNo,
          exactDate: parsedDate,
          time: timeStr,
          subject,
          sender,
        },
      });

      savedTickets.push(ticket);
    }

    return NextResponse.json({ 
      success: true, 
      saved: savedTickets.length,
      tickets: savedTickets 
    }, { status: 201 });
  } catch (error) {
    console.error('Gmail save error:', error);
    return NextResponse.json({ error: 'Failed to save emails' }, { status: 500 });
  }
}
