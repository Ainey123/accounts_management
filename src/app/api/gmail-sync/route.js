import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';
import { isComplaintEmail } from '@/lib/complaintFilter';

function getBaseUrl() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.APP_URL) return process.env.APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  }
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

  // Automatically save refreshed tokens to prevent authentication dropouts
  oauth2Client.on('tokens', async (tokens) => {
    try {
      const updateData = {};
      if (tokens.access_token) updateData.accessToken = tokens.access_token;
      if (tokens.expiry_date) updateData.expiryDate = BigInt(tokens.expiry_date);
      if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;

      if (Object.keys(updateData).length > 0) {
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: updateData,
        });
        console.log(`Updated refreshed Google OAuth tokens in database for ${account.gmailEmail}`);
      }
    } catch (e) {
      console.error(`Error updating refreshed token for ${account.gmailEmail}:`, e);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const syncedIds = JSON.parse(account.syncedEmailIds || '[]');
  const updatedSyncedIds = [...syncedIds];
  const savedTickets = [];

  let messages = [];
  let pageToken = null;

  try {
    do {
      // Fetch ALL emails in date range — let the app-side isComplaintEmail filter handle keyword matching
      // Previous query had complaint keywords that caused recent emails to be missed
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'after:2026/01/01 before:2027/12/31 -from:linkedin.com -from:google.com -subject:"security alert" -subject:"new sign-in" -subject:"password changed"',
        pageToken,
      });

      const pageMessages = response.data.messages || [];
      
      // Check if we hit any messages we've already synced in this page to break pagination early
      let hitSynced = false;
      for (const m of pageMessages) {
        if (syncedIds.includes(m.id)) {
          hitSynced = true;
          break;
        }
      }

      messages = messages.concat(pageMessages);
      if (hitSynced || !response.data.nextPageToken) {
        break;
      }
      pageToken = response.data.nextPageToken;
    } while (pageToken);
  } catch (error) {
    console.error(`Failed to list messages for ${account.gmailEmail}:`, error.message);
    throw error;
  }

  // Reverse so oldest emails are processed first → oldest gets lowest serial number
  messages.reverse();

  for (const message of messages) {
    if (syncedIds.includes(message.id)) {
      continue; // Skip already-synced messages
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

    const emailData = {
      gmailMessageId: message.id,
      sender: from,
      subject,
      exactDate: date,
      time,
      body: msg.data.snippet || '',
    };

    if (isComplaintEmail(emailData)) {
      const serialNo = await nextTicketSerialNo();

      try {
        // Use upsert to prevent unique constraint violations on gmailMessageId
        const ticket = await prisma.ticket.upsert({
          where: { gmailMessageId: message.id },
          update: {},  // Don't overwrite existing tickets
          create: {
            gmailAccountId: account.id,
            gmailMessageId: message.id,
            serialNo,
            exactDate,
            time,
            subject,
            sender: from,
          },
        });
        // Only count as new if it was actually created (not an existing record)
        if (ticket.serialNo === serialNo) {
          savedTickets.push(ticket);
        }
      } catch (e) {
        console.error(`Failed to save ticket for ${message.id}:`, e.message);
      }
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
