import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { isComplaintEmail } from '@/lib/complaintFilter';

function getBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_URL) return process.env.VERCEL_URL;
  return 'http://localhost:3000';
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${getBaseUrl()}/api/gmail/callback`
);

async function postToGmailApi(emails, accountId) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('Server URL not configured');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const res = await fetch(`${baseUrl}/api/gmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, gmailAccountId: accountId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gmail API responded ${res.status}: ${text}`);
    }
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Gmail API request timed out');
    }
    throw err;
  }
}

// Sync emails from connected Gmail account
export async function POST() {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, { status: 500 });
    }
    // Get connected account
    const account = await prisma.gmailAccount.findFirst();
    
    if (!account) {
      return NextResponse.json({ error: 'No Gmail account connected' }, { status: 400 });
    }

    // Set up OAuth client
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: Number(account.expiryDate),
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Parse synced IDs
    const syncedIds = JSON.parse(account.syncedEmailIds || '[]');

    // Fetch recent messages - use complaint-focused search query
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: 'newer_than:7d (complaint OR issue OR problem OR fault OR urgent OR repair OR maintenance OR breakdown OR error OR not working OR service OR assistance OR help OR ticket OR work order) -from:linkedin.com -from:google.com -subject:"security alert" -subject:"new sign-in" -subject:"password changed"',
    });

    const messages = response.data.messages || [];
    const newEmails = [];
    const updatedSyncedIds = [...syncedIds];

    // Process each message
    for (const message of messages) {
      if (updatedSyncedIds.includes(message.id)) {
        continue; // Skip already synced
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

      // Parse date and time
      const dateObj = new Date(dateStr);
      const date = dateObj.toISOString().split('T')[0];
      const time = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const emailData = {
        gmailMessageId: message.id,
        sender: from,
        subject,
        exactDate: date,
        time,
      };

      // Only include complaint emails
      if (isComplaintEmail(emailData)) {
        newEmails.push(emailData);
      }

      updatedSyncedIds.push(message.id);
    }

    // Save new emails to database
    if (newEmails.length > 0) {
      await postToGmailApi(newEmails, account.id);
    }

    // Update synced IDs
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: {
        syncedEmailIds: JSON.stringify(updatedSyncedIds),
        syncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      synced: newEmails.length,
      emails: newEmails,
    });
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}
