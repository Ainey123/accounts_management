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
 * Extract dedup key ONLY for reliably unique ticket-numbered subjects.
 * Returns '' for everything else — those are deduped by gmailMessageId only.
 */
function getDedupKey(subject) {
  if (!subject) return '';
  const lower = subject.toLowerCase();
  const admMatch = lower.match(/ticket\s*(?:no\.?|#)?\s*:?\s*(?:adm|admin)\s*:?\s*(\d{3,})/i);
  if (admMatch) return `ticket-adm-${admMatch[1]}`;
  const adminHashMatch = lower.match(/ticket\s*#\s*admin\s*(\d{3,})/i);
  if (adminHashMatch) return `ticket-admin-${adminHashMatch[1]}`;
  const ticketMatch = lower.match(/ticket\s*(?:no\.?|#|:)?\s*:?\s*(\d{4,})/i) || lower.match(/#\s*(\d{4,})/);
  if (ticketMatch) return `ticket-${ticketMatch[1]}`;
  return '';
}

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
      console.error(`Token refresh error for ${account.gmailEmail}:`, e.message);
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // ── 1. Pre-load existing gmailMessageIds (primary dedup) ──────────────────
  // ONLY use ticket table as source of truth — NOT the syncedEmailIds cache
  const existingRows = await prisma.ticket.findMany({ select: { gmailMessageId: true } });
  const existingMsgIds = new Set(existingRows.map(r => r.gmailMessageId));
  console.log(`[${account.gmailEmail}] Pre-loaded ${existingMsgIds.size} existing message IDs from DB`);

  // ── 2. Pre-load subject keys for ticket-number dedup ──────────────────────
  const allSubjects = await prisma.ticket.findMany({ select: { subject: true } });
  const existingKeys = new Set(allSubjects.map(r => getDedupKey(r.subject)).filter(Boolean));

  // ── 3. Get next serial number — MATHEMATICAL max, not alphabetical ────────
  const allSerials = await prisma.ticket.findMany({ select: { serialNo: true } });
  let serialCounter = 0;
  for (const t of allSerials) {
    if (t.serialNo) {
      const m = t.serialNo.match(/^(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > serialCounter) serialCounter = num;
      }
    }
  }
  serialCounter += 1; // Start at max + 1
  console.log(`[${account.gmailEmail}] Next serial number will be: ${serialCounter}`);

  // ── 4. Scan from July 7, 2026 onwards ─────────────────────────────────────
  const afterDate = '2026/07/07';
  console.log(`[${account.gmailEmail}] Scanning from ${afterDate} onwards`);

  const savedTickets = [];
  const deadline = Date.now() + 50_000; // 50s safety margin

  let pageToken = undefined;
  let totalFound = 0;

  do {
    if (Date.now() > deadline) {
      console.log(`[${account.gmailEmail}] Time budget reached. Saved ${savedTickets.length} so far.`);
      break;
    }

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: `after:${afterDate}`,
      pageToken,
    });

    const msgs = listRes.data.messages || [];
    pageToken = listRes.data.nextPageToken || undefined;
    totalFound += msgs.length;

    console.log(`[${account.gmailEmail}] Found ${msgs.length} messages in this page (${totalFound} total so far)`);

    // Filter out already-known message IDs BEFORE making get() calls
    const newMsgs = msgs.filter(m => !existingMsgIds.has(m.id));
    console.log(`[${account.gmailEmail}] ${newMsgs.length} are NEW (not in DB yet)`);

    if (newMsgs.length === 0) continue;

    // ── Process messages SEQUENTIALLY to avoid serial number collisions ──
    for (const message of newMsgs) {
      if (Date.now() > deadline) break;

      try {
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

        const dateObj   = new Date(dateStr);
        const exactDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
        const time = exactDate.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });

        // Subject dedup for ticket-numbered emails only
        const key = getDedupKey(subject);
        if (key && existingKeys.has(key)) {
          existingMsgIds.add(message.id);
          continue;
        }

        const serialNo = String(serialCounter);
        try {
          await prisma.ticket.create({
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
          // Only increment serial AFTER successful save
          serialCounter++;
          savedTickets.push({ subject, serialNo });
          existingMsgIds.add(message.id);
          if (key) existingKeys.add(key);
          console.log(`[${account.gmailEmail}] ✅ Saved: "${subject.slice(0, 60)}" (${serialNo})`);
        } catch (e) {
          if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
            // gmailMessageId already exists — mark seen and skip
            existingMsgIds.add(message.id);
            console.log(`[${account.gmailEmail}] ⏭ Duplicate (constraint): ${message.id}`);
          } else {
            console.error(`[${account.gmailEmail}] DB error for ${message.id}:`, e.message);
          }
        }
      } catch (e) {
        console.error(`[${account.gmailEmail}] Gmail API error for ${message.id}:`, e.message);
      }
    }
  } while (pageToken);

  // Update syncedAt
  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncedAt: new Date() },
  }).catch(() => {});

  console.log(`[${account.gmailEmail}] Done. ${savedTickets.length} new tickets saved out of ${totalFound} scanned.`);

  return {
    email: account.gmailEmail,
    synced: savedTickets.length,
    totalScanned: totalFound,
  };
}

async function runSync(request) {
  // Allow cron OR any logged-in user (no CRON_SECRET enforcement for manual sync)
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
      console.error(`Sync failed for ${account.gmailEmail}:`, error.message);
      results.push({ email: account.gmailEmail, error: error.message, synced: 0 });
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);
  const totalScanned = results.reduce((sum, r) => sum + (r.totalScanned || 0), 0);

  return NextResponse.json({
    success: true,
    synced: totalSynced,
    totalScanned,
    message: `Synced ${totalSynced} new email(s) from ${totalScanned} scanned across ${accounts.length} account(s)!`,
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