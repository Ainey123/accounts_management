import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'production'
    ? `${process.env.VERCEL_URL}/api/gmail-oauth/callback`
    : 'http://localhost:3000/api/gmail-oauth/callback'
);

// Sync emails from connected Gmail account
export async function POST() {
  try {
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

    // Fetch recent messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'newer_than:1d',
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

      newEmails.push({
        gmailMessageId: message.id,
        sender: from,
        subject,
        exactDate: date,
        time,
      });

      updatedSyncedIds.push(message.id);
    }

    // Save new emails to database
    if (newEmails.length > 0) {
      await fetch(`${process.env.NODE_ENV === 'production' ? process.env.VERCEL_URL : 'http://localhost:3000'}/api/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: newEmails,
          gmailAccountId: account.id,
        }),
      });
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
