import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';

function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function syncAccount(account) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/gmail/callback`
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: Number(account.expiryDate),
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const syncedIds = JSON.parse(account.syncedEmailIds || '[]');
  const updatedSyncedIds = [...syncedIds];
  const savedTickets = [];

  let messages = [];
  let pageToken = null;

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 500,
      q: 'after:2026/01/01 before:2027/01/01 -from:linkedin.com -from:google.com -subject:"security alert" -subject:"new sign-in" -subject:"password changed"',
      pageToken,
    });

    messages = messages.concat(response.data.messages || []);
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  for (const message of messages) {
    if (updatedSyncedIds.includes(message.id)) {
      continue;
    }

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = msg.data.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const dateStr = headers.find(h => h.name === 'Date')?.value || '';

    const dateObj = new Date(dateStr);
    const exactDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    const date = exactDate.toISOString().split('T')[0];
    const time = exactDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const serialNo = await nextTicketSerialNo();

    try {
      const ticket = await prisma.ticket.create({
        data: {
          gmailAccountId: account.id,
          gmailMessageId: message.id,
          serialNo,
          exactDate,
          time,
          subject,
          sender: from,
        },
      });
      savedTickets.push(ticket);
    } catch (e) {
      console.error(`Failed to save ticket for ${message.id}:`, e.message);
    }

    updatedSyncedIds.push(message.id);
  }

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: {
      syncedEmailIds: JSON.stringify(updatedSyncedIds),
      syncedAt: new Date(),
    },
  });

  return { email: account.gmailEmail, synced: savedTickets.length };
}

export async function POST() {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Google OAuth not configured.' }, { status: 500 });
    }

    const accounts = await prisma.gmailAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (!accounts.length) {
      return NextResponse.json({ error: 'No Gmail accounts connected' }, { status: 400 });
    }

    const results = [];
    for (const account of accounts) {
      try {
        const result = await syncAccount(account);
        results.push(result);
      } catch (error) {
        console.error(`Sync failed for ${account.gmailEmail}:`, error);
        results.push({ email: account.gmailEmail, error: error.message });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      results,
    });
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}
