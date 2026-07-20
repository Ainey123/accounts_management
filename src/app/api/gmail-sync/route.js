export const maxDuration = 60; // Allow more time on Vercel
export const dynamic = 'force-dynamic';

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
 * Robustly extract a deduplication key from a subject line.
 * Handles ticket numbers (including ADM/Admin patterns), strips prefixes
 * repeatedly, collapses spaces, and strips common suffixes.
 */
function getDedupKey(subject) {
  if (!subject) return '';
  let s = subject.trim();

  // Remove surrounding quotes
  s = s.replace(/^"|"$/g, '').trim();

  let lower = s.toLowerCase();

  // 1. Check for "Ticket No ADM 1196207" or "Ticket No :ADM 1196207" patterns
  const admMatch = lower.match(/ticket\s*(?:no\.?|#)?\s*:?\s*(?:adm|admin)\s*:?\s*(\d{3,})/i);
  if (admMatch) {
    return `ticket-adm-${admMatch[1]}`;
  }

  // 2. Check for "Ticket # Admin 40280" patterns
  const adminHashMatch = lower.match(/ticket\s*#\s*admin\s*(\d{3,})/i);
  if (adminHashMatch) {
    return `ticket-admin-${adminHashMatch[1]}`;
  }

  // 3. Check for numeric ticket number (e.g., "Ticket No :154678", "Ticket#154678")
  const ticketMatch = lower.match(/ticket\s*(?:no\.?|#|:)?\s*:?\s*(\d{4,})/i) || lower.match(/#\s*(\d{4,})/);
  if (ticketMatch) {
    return `ticket-${ticketMatch[1]}`;
  }

  // 4. Normalize by stripping prefixes repeatedly
  let prev = null;
  lower = s.toLowerCase();
  while (prev !== lower) {
    prev = lower;
    lower = lower
      .replace(/^\s*re\s*:/i, '')
      .replace(/^\s*fwd?\s*:/i, '')
      .replace(/^\s*fw\s*:/i, '')
      .replace(/^\s*\[external\]\s*/i, '')
      .replace(/^\s*\[ext\]\s*/i, '')
      .replace(/^\s*\[spam\]\s*/i, '')
      .replace(/^\s*atm\s*id\s*#?\s*\d+/i, '')
      .replace(/^\s*sr#?\s*\d+/i, '')
      .trim();
  }

  // 5. Strip trailing revised sets or other common boq suffixes
  lower = lower
    .replace(/\s*-\s*working\s*set.*$/i, '')
    .replace(/\s*-\s*revised\s*working\s*set.*$/i, '')
    .replace(/\s*-\s*boq.*$/i, '')
    .trim();

  // 6. Strip trailing person names (words after the last meaningful token)
  //    e.g. "Ticket No ADM 1196207 shahzaib" -> already handled above
  //    For non-ticket subjects, just collapse spaces

  // Collapse multiple spaces
  return lower.replace(/\s+/g, ' ');
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

// ── Month definitions: Jan 2026 → Dec 2027 (future-proof) ──────────────────
const MONTHS = [
  { after: '2026/01/01', before: '2026/02/01', label: 'January 2026',   year: 2026, month: 1  },
  { after: '2026/02/01', before: '2026/03/01', label: 'February 2026',  year: 2026, month: 2  },
  { after: '2026/03/01', before: '2026/04/01', label: 'March 2026',     year: 2026, month: 3  },
  { after: '2026/04/01', before: '2026/05/01', label: 'April 2026',     year: 2026, month: 4  },
  { after: '2026/05/01', before: '2026/06/01', label: 'May 2026',       year: 2026, month: 5  },
  { after: '2026/06/01', before: '2026/07/01', label: 'June 2026',      year: 2026, month: 6  },
  { after: '2026/07/01', before: '2026/08/01', label: 'July 2026',      year: 2026, month: 7  },
  { after: '2026/08/01', before: '2026/09/01', label: 'August 2026',    year: 2026, month: 8  },
  { after: '2026/09/01', before: '2026/10/01', label: 'September 2026', year: 2026, month: 9  },
  { after: '2026/10/01', before: '2026/11/01', label: 'October 2026',   year: 2026, month: 10 },
  { after: '2026/11/01', before: '2026/12/01', label: 'November 2026',  year: 2026, month: 11 },
  { after: '2026/12/01', before: '2027/01/01', label: 'December 2026',  year: 2026, month: 12 },
  { after: '2027/01/01', before: '2027/02/01', label: 'January 2027',   year: 2027, month: 1  },
  { after: '2027/02/01', before: '2027/03/01', label: 'February 2027',  year: 2027, month: 2  },
  { after: '2027/03/01', before: '2027/04/01', label: 'March 2027',     year: 2027, month: 3  },
  { after: '2027/04/01', before: '2027/05/01', label: 'April 2027',     year: 2027, month: 4  },
  { after: '2027/05/01', before: '2027/06/01', label: 'May 2027',       year: 2027, month: 5  },
  { after: '2027/06/01', before: '2027/07/01', label: 'June 2027',      year: 2027, month: 6  },
  { after: '2027/07/01', before: '2027/08/01', label: 'July 2027',      year: 2027, month: 7  },
  { after: '2027/08/01', before: '2027/09/01', label: 'August 2027',    year: 2027, month: 8  },
  { after: '2027/09/01', before: '2027/10/01', label: 'September 2027', year: 2027, month: 9  },
  { after: '2027/10/01', before: '2027/11/01', label: 'October 2027',   year: 2027, month: 10 },
  { after: '2027/11/01', before: '2027/12/01', label: 'November 2027',  year: 2027, month: 11 },
  { after: '2027/12/01', before: '2028/01/01', label: 'December 2027',  year: 2027, month: 12 },
];

/** Returns the MONTHS index for the current real-world month (0-based). */
function getCurrentMonthIdx() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const idx = MONTHS.findIndex((m) => m.year === year && m.month === month);
  return idx >= 0 ? idx : MONTHS.length - 1;
}

/**
 * Process a single month for a given Gmail account.
 * Returns the number of new tickets saved.
 */
async function processMonth(gmail, account, monthDef, syncedSet, savedTickets, existingTicketKeys, serialState) {
  let pageToken = undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: `after:${monthDef.after} before:${monthDef.before}`,
      pageToken,
    });

    const pageMessages = response.data.messages || [];
    pageToken = response.data.nextPageToken || undefined;

    const batchSize = 20;
    for (let i = 0; i < pageMessages.length; i += batchSize) {
      const batch = pageMessages.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (message) => {
        if (syncedSet.has(message.id)) return;

        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = msg.data.payload?.headers || [];
          const from    = headers.find((h) => h.name === 'From')?.value    || 'Unknown';
          const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
          const dateStr = headers.find((h) => h.name === 'Date')?.value    || '';

          const dateObj  = new Date(dateStr);
          const exactDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
          const time = exactDate.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
          });

          const incomingKey = getDedupKey(subject);
          let existingTicket = null;

          if (incomingKey && existingTicketKeys.has(incomingKey)) {
            existingTicket = true;
          }

          if (!existingTicket) {
            const serialNo = String(serialState.current++);
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
                if (incomingKey) existingTicketKeys.add(incomingKey);
              }
            } catch (e) {
              if (!e.message?.includes('Unique constraint')) {
                console.error(`Failed to save ticket for ${message.id}:`, e.message);
              }
            }
          }

          syncedSet.add(message.id);
        } catch (e) {
          console.error(`Failed to get message ${message.id}:`, e.message);
          syncedSet.add(message.id); // Mark as seen so we don't retry broken messages
        }
      }));
    }
  } while (pageToken);
}

/**
 * Sweep the last 7 days regardless of monthIdx, to catch any recently
 * missed emails due to monthIdx drift or cron gaps.
 */
async function recentSweep(gmail, account, syncedSet, savedTickets, existingTicketKeys, serialState) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yyyy = sevenDaysAgo.getFullYear();
  const mm   = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
  const dd   = String(sevenDaysAgo.getDate()).padStart(2, '0');
  const afterDate = `${yyyy}/${mm}/${dd}`;

  let pageToken = undefined;
  console.log(`[${account.gmailEmail}] Recent sweep: after ${afterDate}`);

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: `after:${afterDate}`,
      pageToken,
    });

    const pageMessages = response.data.messages || [];
    pageToken = response.data.nextPageToken || undefined;

    const batchSize = 20;
    for (let i = 0; i < pageMessages.length; i += batchSize) {
      const batch = pageMessages.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (message) => {
        if (syncedSet.has(message.id)) return;

        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = msg.data.payload?.headers || [];
          const from    = headers.find((h) => h.name === 'From')?.value    || 'Unknown';
          const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
          const dateStr = headers.find((h) => h.name === 'Date')?.value    || '';

          const dateObj  = new Date(dateStr);
          const exactDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
          const time = exactDate.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
          });

          const incomingKey = getDedupKey(subject);
          let existingTicket = null;

          if (incomingKey && existingTicketKeys.has(incomingKey)) {
            existingTicket = true;
          }

          if (!existingTicket) {
            const serialNo = String(serialState.current++);
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
                if (incomingKey) existingTicketKeys.add(incomingKey);
              }
            } catch (e) {
              if (!e.message?.includes('Unique constraint')) {
                console.error(`Recent sweep - failed to save ticket for ${message.id}:`, e.message);
              }
            }
          }

          syncedSet.add(message.id);
        } catch (e) {
          console.error(`Recent sweep - failed to get message ${message.id}:`, e.message);
          syncedSet.add(message.id);
        }
      }));
    }
  } while (pageToken);
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
      if (tokens.access_token) updateData.accessToken = tokens.access_token;
      if (tokens.expiry_date)  updateData.expiryDate  = BigInt(tokens.expiry_date);
      if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
      if (Object.keys(updateData).length > 0) {
        await prisma.gmailAccount.update({ where: { id: account.id }, data: updateData });
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
  const MAX_SYNCED_IDS = 3000;

  // Cache all ticket subjects to drastically improve dedup performance
  const allTickets = await prisma.ticket.findMany({
    select: { subject: true }
  });
  const existingTicketKeys = new Set(
    allTickets.map(t => getDedupKey(t.subject)).filter(Boolean)
  );

  // Initialize serialState
  const maxTicket = await prisma.ticket.findFirst({
    orderBy: { serialNo: 'desc' },
    select: { serialNo: true },
  });
  let maxNum = 0;
  if (maxTicket && maxTicket.serialNo) {
     const match = maxTicket.serialNo.match(/^(\d+)/);
     if (match) maxNum = parseInt(match[1], 10);
  }
  const serialState = { current: maxNum + 1 };

  // ── Clamp monthIdx to valid range ─────────────────────────────────────────
  const maxMonthIdx = getCurrentMonthIdx(); // never go past today's month

  if (currentMonthIdx < 0 || isNaN(currentMonthIdx)) currentMonthIdx = 0;
  if (currentMonthIdx >= MONTHS.length) currentMonthIdx = maxMonthIdx;

  // ── Catch-up loop: process all months from currentMonthIdx up to today ───
  try {
    const startIdx = currentMonthIdx;
    for (let idx = startIdx; idx <= maxMonthIdx; idx++) {
      const monthDef = MONTHS[idx];
      console.log(`[${account.gmailEmail}] Processing ${monthDef.label} (${idx + 1}/${MONTHS.length})`);

      await processMonth(gmail, account, monthDef, syncedSet, savedTickets, existingTicketKeys, serialState);

      // Save progress after each month
      const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
      const nextIdx = idx === maxMonthIdx ? idx : idx + 1; // stay at current if it's today
      const safeNextIdx = Math.min(nextIdx, MONTHS.length - 1);
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: `${safeNextIdx}|${JSON.stringify(idsArray)}` },
      });

      console.log(`[${account.gmailEmail}] ✅ ${monthDef.label} done. ${savedTickets.length} total new tickets so far.`);
    }
  } catch (error) {
    console.error(`[${account.gmailEmail}] Month-loop error:`, error.message);
    // Save progress before re-throwing
    try {
      const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
      const safeIdx = isNaN(currentMonthIdx) ? 0 : currentMonthIdx;
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { syncedEmailIds: `${safeIdx}|${JSON.stringify(idsArray)}` },
      }).catch(() => {});
    } catch {}
    // Don't re-throw — still do the recent sweep below
  }

  // ── Always do a 7-day recent sweep to catch any gaps ─────────────────────
  try {
    await recentSweep(gmail, account, syncedSet, savedTickets, existingTicketKeys, serialState);
    // Save final state after recent sweep
    const idsArray = Array.from(syncedSet).slice(-MAX_SYNCED_IDS);
    const finalIdx = Math.min(maxMonthIdx, MONTHS.length - 1);
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: {
        syncedEmailIds: `${finalIdx}|${JSON.stringify(idsArray)}`,
        syncedAt: new Date(),
      },
    });
  } catch (sweepErr) {
    console.error(`[${account.gmailEmail}] Recent sweep error:`, sweepErr.message);
  }

  return {
    email: account.gmailEmail,
    synced: savedTickets.length,
    monthsProcessed: Math.max(0, getCurrentMonthIdx() - currentMonthIdx + 1),
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

  return NextResponse.json({ success: true, synced: totalSynced, results });
}

export async function POST(request) {
  try {
    return await runSync(request);
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}

// GET handler — Vercel crons use GET requests
export async function GET(request) {
  try {
    return await runSync(request);
  } catch (error) {
    console.error('Email sync error (GET/cron):', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}