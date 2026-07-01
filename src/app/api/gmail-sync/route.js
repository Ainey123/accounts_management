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

/**
 * Parse the syncedEmailIds field.
 * Supports both old format (json array) and new format (monthIndex|json array).
 * If invalid, returns { monthIdx: 0, ids: [] }
 */
function parseSyncState(raw) {
  if (!raw || raw === '[]' || raw === '') {
    return { monthIdx: 0, ids: [] };
  }

  // Check if it's the new format: monthIndex|jsonArray
  if (raw.includes('|')) {
    const parts = raw.split('|');
    let monthIdx = parseInt(parts[0], 10);
    if (isNaN(monthIdx) || monthIdx < 0) monthIdx = 0;
    if (monthIdx > 12) monthIdx = 11; // clamp to Dec
    try {
      const ids = JSON.parse(parts[1] || '[]');
      return { monthIdx, ids: Array.isArray(ids) ? ids : [] };
    } catch {
      return { monthIdx: 0, ids: [] };
    }
  }

  // Old format: just a json array - start from January
  try {
    const ids = JSON.parse(raw);
    return { monthIdx: 0, ids: Array.isArray(ids) ? ids : [] };
  } catch {
    return { monthIdx: 0, ids: [] };
  }
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
      }
    } catch (e) {
      console.error(`Error updating refreshed token for ${account.gmailEmail}:`, e);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const state = parseSyncState(account.syncedEmailIds);
  let currentMonthIdx = state.monthIdx;
  const syncedSet = new Set(state.ids);
  const savedTickets = [];
  const MAX_SYNCED_IDS = 2000;

  const months = [
    { after: '2026/01/01', before: '2026/02/01', label: 'January 2026' },
    { after: '2026/02/01', before: '2026/03/01', label: 'February 2026' },
    { after: '2026/03/01', before: '2026/04/01', label: 'March 2026' },
    { after: '2026/04/01', before: '2026/05/01', label: 'April 2026' },
    { after: '2026/05/01', before: '2026/06/01', label: 'May 2026' },
    { after: '2026/06/01', before: '2026/07/01', label: 'June 2026' },
    { after: '2026/07/01', before: '2026/08/01', label: 'July 2026' },
    { after: '2026/08/01', before: '2026/09/01', label: 'August 2026' },
    { after: '2026/09/01', before: '2026/10/01', label: 'September 2026' },
    { after: '2026/10/01', before: '2026/11/01', label: 'October 2026' },
    { after: '2026/11/01', before: '2026/12/01', label: 'November 2026' },
    { after: '2026/12/01', before: '2027/01/01', label: 'December 2026' },
  ];

  // Clamp month index to valid range
  if (currentMonthIdx >= months.length) currentMonthIdx = months.length - 1;
  if (currentMonthIdx < 0) currentMonthIdx = 0;

  let pageToken = undefined;
  let monthFinished = false;

  try {
    const month = months[currentMonthIdx];
    console.log(`[${account.gmailEmail}] Syncing ${month.label} (month ${currentMonthIdx + 1}/${months.length})`);

    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: `after:${month.after} before:${month.before}`,
        pageToken,
      });

      const pageMessages = response.data.messages || [];
      pageToken = response.data.nextPageToken || undefined;

      for (const message of pageMessages) {
        if (syncedSet.has(message.id)) continue;

        try {
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
              if (ticket.serialNo === serialNo) savedTickets.push(ticket);
            } catch (e) {
              if (!e.message?.includes('Unique constraint')) {
                console.error(`Failed to save ticket for ${message.id}:`, e.message);
              }
            }
          }

          syncedSet.add(message.id);
        } catch (e) {
          console.error(`Failed to get message ${message.id}:`, e.message);
          // Still mark as synced so we don't retry broken messages
          syncedSet.add(message.id);
        }
      }

      // Save progress - ALWAYS use valid number for monthIdx
      const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
      const nextMonthIdx = pageToken ? currentMonthIdx : currentMonthIdx + 1;
      const safeMonthIdx = isNaN(nextMonthIdx) ? 0 : nextMonthIdx;
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: `${safeMonthIdx}|${JSON.stringify(idsArray)}` },
      });

      if (!pageToken) {
        monthFinished = true;
        console.log(`[${account.gmailEmail}] ✅ ${month.label} complete. ${savedTickets.length} new tickets. Moving to month ${currentMonthIdx + 2}.`);
      }
    } while (pageToken && !monthFinished);
  } catch (error) {
    console.error(`[${account.gmailEmail}] Error:`, error.message);
    try {
      const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
      const safeIdx = isNaN(currentMonthIdx) ? 0 : currentMonthIdx;
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: `${safeIdx}|${JSON.stringify(idsArray)}` },
      }).catch(() => {});
    } catch {}
    throw error;
  }

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncedAt: new Date() },
  });

  return { email: account.gmailEmail, synced: savedTickets.length, month: month.label };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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