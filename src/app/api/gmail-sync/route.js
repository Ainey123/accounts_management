export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

function getBaseUrl() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.APP_URL) return process.env.APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  }
  return 'http://localhost:3000';
}

/**
 * Robustly extract a deduplication key from a subject line.
 * Returns '' for subjects that cannot be reliably deduped by subject alone —
 * those will be deduped only by gmailMessageId (DB unique constraint).
 */
function getDedupKey(subject) {
  if (!subject) return '';
  let s = subject.trim().replace(/^"|"$/g, '').trim();
  const lower = s.toLowerCase();

  // 1. Ticket patterns with ticket numbers — very reliable to dedup
  const admMatch = lower.match(/ticket\s*(?:no\.?|#)?\s*:?\s*(?:adm|admin)\s*:?\s*(\d{3,})/i);
  if (admMatch) return `ticket-adm-${admMatch[1]}`;

  const adminHashMatch = lower.match(/ticket\s*#\s*admin\s*(\d{3,})/i);
  if (adminHashMatch) return `ticket-admin-${adminHashMatch[1]}`;

  const ticketMatch = lower.match(/ticket\s*(?:no\.?|#|:)?\s*:?\s*(\d{4,})/i) || lower.match(/#\s*(\d{4,})/);
  if (ticketMatch) return `ticket-${ticketMatch[1]}`;

  // For all other subjects — return '' so they are NOT deduped by subject.
  // The gmailMessageId unique constraint prevents actual duplicates.
  return '';
}

/**
 * Core sync: scan the last N days from Gmail and save new tickets.
 * Uses gmailMessageId as the primary dedup key (DB unique constraint),
 * subject-based dedup only for ticket-numbered emails.
 */
async function syncAccount(account) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/gmail/callback`
  );

  oauth2Client.setCredentials({
    access_token:  account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date:   Number(account.expiryDate),
  });

  // Persist refreshed tokens immediately
  oauth2Client.on('tokens', async (tokens) => {
    try {
      const updateData = {};
      if (tokens.access_token)  updateData.accessToken  = tokens.access_token;
      if (tokens.expiry_date)   updateData.expiryDate   = BigInt(tokens.expiry_date);
      if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
      if (Object.keys(updateData).length > 0) {
        await prisma.gmailAccount.update({ where: { id: account.id }, data: updateData });
      }
    } catch (e) {
      console.error(`Error updating refreshed token for ${account.gmailEmail}:`, e);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // ── Step 1: Load existing gmailMessageIds from DB so we never re-process ──
  // This is the ONLY reliable dedup: by unique gmail message ID.
  const existingMessages = await prisma.ticket.findMany({
    select: { gmailMessageId: true },
  });
  const existingMsgIds = new Set(existingMessages.map(t => t.gmailMessageId));

  // ── Step 2: Load existing ticket subject keys (only ticket-numbered ones) ──
  const allTickets = await prisma.ticket.findMany({
    select: { subject: true },
  });
  const existingTicketKeys = new Set(
    allTickets.map(t => getDedupKey(t.subject)).filter(Boolean)
  );

  // ── Step 3: Get next serial number base ──
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { serialNo: 'desc' },
    select: { serialNo: true },
  });
  let maxNum = 0;
  if (maxTicket?.serialNo) {
    const match = maxTicket.serialNo.match(/^(\d+)/);
    if (match) maxNum = parseInt(match[1], 10);
  }
  let serialCounter = maxNum + 1;

  const savedTickets = [];
  const deadline = Date.now() + 50_000; // 50s budget out of 60s max

  // ── Step 4: Scan last 45 days to always catch recent emails ──
  const daysBack = 45;
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const yyyy = sinceDate.getFullYear();
  const mm   = String(sinceDate.getMonth() + 1).padStart(2, '0');
  const dd   = String(sinceDate.getDate()).padStart(2, '0');
  const afterDate = `${yyyy}/${mm}/${dd}`;

  console.log(`[${account.gmailEmail}] Scanning Gmail after ${afterDate} (last ${daysBack} days)`);

  let pageToken = undefined;
  let pageCount = 0;

  do {
    if (Date.now() > deadline) {
      console.log(`[${account.gmailEmail}] ⏱️ Time budget reached. Will catch remaining emails next sync.`);
      break;
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: `after:${afterDate}`,
      pageToken,
    });

    const pageMessages = response.data.messages || [];
    pageToken = response.data.nextPageToken || undefined;
    pageCount++;

    console.log(`[${account.gmailEmail}] Page ${pageCount}: ${pageMessages.length} messages from Gmail`);

    // Process in batches of 20 concurrently for speed
    const batchSize = 20;
    for (let i = 0; i < pageMessages.length; i += batchSize) {
      if (Date.now() > deadline) break;

      const batch = pageMessages.slice(i, i + batchSize);

      const results = await Promise.allSettled(batch.map(async (message) => {
        // Skip if we already have this exact message in the DB
        if (existingMsgIds.has(message.id)) return;

        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers  = msg.data.payload?.headers || [];
        const from     = headers.find(h => h.name === 'From')?.value    || 'Unknown';
        const subject  = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const dateStr  = headers.find(h => h.name === 'Date')?.value    || '';

        const dateObj  = new Date(dateStr);
        const exactDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
        const time = exactDate.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });

        // Subject-based dedup only for ticket-numbered emails
        const incomingKey = getDedupKey(subject);
        if (incomingKey && existingTicketKeys.has(incomingKey)) {
          // Mark as seen so UI doesn't show it as a gap, but don't duplicate
          existingMsgIds.add(message.id);
          return;
        }

        const serialNo = String(serialCounter++);

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
          existingMsgIds.add(message.id);
          if (incomingKey) existingTicketKeys.add(incomingKey);
          console.log(`[${account.gmailEmail}] ✅ Saved: ${subject.slice(0, 60)}`);
        } catch (e) {
          if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
            // Already exists — mark as seen
            existingMsgIds.add(message.id);
          } else {
            console.error(`[${account.gmailEmail}] Failed to save ${message.id}:`, e.message);
          }
        }
      }));

      // Log any unexpected errors from the batch
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[${account.gmailEmail}] Batch item ${i} failed:`, r.reason?.message);
        }
      });
    }
  } while (pageToken);

  // ── Step 5: Update syncedAt timestamp ──
  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncedAt: new Date() },
  }).catch(e => console.error(`Failed to update syncedAt:`, e.message));

  console.log(`[${account.gmailEmail}] Sync complete. ${savedTickets.length} new tickets saved.`);

  return {
    email: account.gmailEmail,
    synced: savedTickets.length,
  };
}

async function runSync(request) {
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
    message: `Synced ${totalSynced} email(s) across ${accounts.length} account(s)!`,
    results,
  });
}

export async function POST(request) {
  try {
    return await runSync(request);
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    return await runSync(request);
  } catch (error) {
    console.error('Email sync error (GET/cron):', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}