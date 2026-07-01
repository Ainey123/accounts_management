import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { nextTicketSerialNo } from '@/lib/serial';

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
  const syncedSet = new Set(syncedIds);
  const savedTickets = [];
  const MAX_SYNCED_IDS = 2000;

  let pageToken = undefined;
  let messagesProcessed = 0;
  // Limit to 50 new emails per sync to avoid Vercel 504 timeout.
  // Over multiple sync cycles (cron runs daily + manual clicks),
  // ALL emails will be imported gradually.
  const BATCH_LIMIT = 50;

  try {
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'after:2026/01/01',
        pageToken,
      });

      const pageMessages = response.data.messages || [];
      pageToken = response.data.nextPageToken || undefined;

      const messagesToProcess = pageMessages;

      for (const message of messagesToProcess) {
        if (syncedSet.has(message.id)) continue;

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
        const time = exactDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        // Check for duplicate subject across ALL tickets to prevent re-imports
        const existingTicket = await prisma.ticket.findFirst({
          where: { subject },
          select: { id: true, serialNo: true },
        });

        if (!existingTicket) {
          const serialNo = await nextTicketSerialNo();

          try {
            const ticket = await prisma.ticket.upsert({
              where: { gmailMessageId: message.id },
              update: {},
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
            if (ticket.serialNo === serialNo) {
              savedTickets.push(ticket);
            }
          } catch (e) {
            console.error(`Failed to save ticket for ${message.id}:`, e.message);
          }
        } else {
          console.log(`Skipping duplicate subject (ticket #${existingTicket.serialNo} already exists): ${subject}`);
        }

        syncedSet.add(message.id);
        messagesProcessed++;

        // Stop early if we hit the batch limit to avoid 504 timeout on Vercel
        if (messagesProcessed >= BATCH_LIMIT) break;
      }

      if (syncedSet.size > 0) {
        const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: { syncedEmailIds: JSON.stringify(idsArray) },
        });
      }

      // If we hit the limit, stop pagination so we don't time out.
      // Next sync will pick up where we left off.
      if (messagesProcessed >= BATCH_LIMIT) break;
    } while (pageToken);
  } catch (error) {
    console.error(`Failed to list messages for ${account.gmailEmail}:`, error.message);
    try {
      const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: JSON.stringify(idsArray) },
      }).catch(() => {});
    } catch {}
    throw error;
  }

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncedAt: new Date() },
  });

  return { email: account.gmailEmail, synced: savedTickets.length };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      console.log('OAuth missing - CLIENT_ID:', !!clientId, 'CLIENT_SECRET:', !!clientSecret);
      return NextResponse.json({ error: 'Google OAuth not configured. Check Vercel env vars.' }, { status: 500 });
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
