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
 * GET /api/gmail-debug
 * Shows a full diagnostic of what is happening in the sync.
 * Does NOT modify any data — read-only.
 */
export async function GET() {
  const report = {
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      nodeEnv: process.env.NODE_ENV,
    },
    accounts: [],
  };

  try {
    const accounts = await prisma.gmailAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (!accounts.length) {
      return NextResponse.json({ ...report, error: 'No Gmail accounts in database' });
    }

    // Count tickets already in DB
    const totalTickets = await prisma.ticket.count();
    const existingMsgIds = await prisma.ticket.findMany({ select: { gmailMessageId: true } });
    report.db = {
      totalTickets,
      totalMessageIds: existingMsgIds.length,
    };

    for (const account of accounts) {
      const accountReport = {
        email: account.gmailEmail,
        tokenExpiry: new Date(Number(account.expiryDate)).toISOString(),
        tokenExpired: Date.now() > Number(account.expiryDate),
        syncedAt: account.syncedAt,
      };

      try {
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

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Test 1: Can we call Gmail API at all?
        try {
          const profile = await gmail.users.getProfile({ userId: 'me' });
          accountReport.gmailApiStatus = 'OK';
          accountReport.gmailProfile = {
            email: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
            threadsTotal: profile.data.threadsTotal,
          };
        } catch (e) {
          accountReport.gmailApiStatus = 'FAILED';
          accountReport.gmailApiError = e.message;
          accountReport.needsReAuth = e.message?.includes('401') || e.message?.includes('invalid_grant') || e.message?.includes('Token has been expired');
          report.accounts.push(accountReport);
          continue;
        }

        // Test 2: How many messages after July 7?
        try {
          const listRes = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: 'after:2026/07/07',
          });
          const msgs = listRes.data.messages || [];
          accountReport.messagesAfterJuly7 = {
            foundInThisPage: msgs.length,
            hasMore: !!listRes.data.nextPageToken,
            sampleIds: msgs.slice(0, 5).map(m => m.id),
          };

          // Check how many of those are already in DB
          const existingSet = new Set(existingMsgIds.map(r => r.gmailMessageId));
          const alreadyInDb = msgs.filter(m => existingSet.has(m.id)).length;
          const newOnes = msgs.filter(m => !existingSet.has(m.id)).length;
          accountReport.messagesAfterJuly7.alreadyInDb = alreadyInDb;
          accountReport.messagesAfterJuly7.genuinelyNew = newOnes;

          // Test 3: Fetch first new message details
          const firstNew = msgs.find(m => !existingSet.has(m.id));
          if (firstNew) {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: firstNew.id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date'],
            });
            const headers = detail.data.payload?.headers || [];
            accountReport.sampleNewEmail = {
              id: firstNew.id,
              from: headers.find(h => h.name === 'From')?.value,
              subject: headers.find(h => h.name === 'Subject')?.value,
              date: headers.find(h => h.name === 'Date')?.value,
            };
          } else {
            accountReport.allAlreadyInDb = true;
            accountReport.note = 'All messages on first page are already in the database. If you expect more, the sync has been working but those emails are already saved.';
          }
        } catch (e) {
          accountReport.listError = e.message;
        }

      } catch (e) {
        accountReport.error = e.message;
      }

      report.accounts.push(accountReport);
    }

    return NextResponse.json(report, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ...report, fatalError: e.message }, { status: 500 });
  }
}
