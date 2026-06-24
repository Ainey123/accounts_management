import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { isComplaintEmail } from '@/lib/complaintFilter';

function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_URL) return process.env.VERCEL_URL;
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
  const newEmails = [];

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 100,
    q: 'newer_than:7d (complaint OR issue OR problem OR fault OR urgent OR repair OR maintenance OR breakdown OR error OR not working OR service OR assistance OR help OR ticket OR work order) -from:linkedin.com -from:google.com -subject:"security alert" -subject:"new sign-in" -subject:"password changed"',
  });

  const messages = response.data.messages || [];

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
    const date = dateObj.toISOString().split('T')[0];
    const time = dateObj.toLocaleTimeString('en-US', {
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
    };

    if (isComplaintEmail(emailData)) {
      newEmails.push(emailData);
    }

    updatedSyncedIds.push(message.id);
  }

  // Save new emails to database
  if (newEmails.length > 0) {
    const baseUrl = getBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`${baseUrl}/api/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: newEmails, gmailAccountId: account.id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      console.error(`Failed to save emails for ${account.gmailEmail}:`, err);
    }
  }

  // Update synced IDs
  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: {
      syncedEmailIds: JSON.stringify(updatedSyncedIds),
      syncedAt: new Date(),
    },
  });

  return { email: account.gmailEmail, synced: newEmails.length };
}

// Sync emails from all connected Gmail accounts
export async function POST() {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, { status: 500 });
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
