import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { isComplaintEmail } from '@/lib/complaintFilter';

function googleConfigured() {
  return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
}

function getBaseUrl() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.APP_URL) return process.env.APP_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  }
  return 'http://localhost:3000';
}

function createOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/gmail/callback`
  );
}

// Start OAuth connection
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' }, { status: 500 });
  }
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  return NextResponse.json({ authUrl: url });
}

// OAuth callback - save tokens
export async function POST(request) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google OAuth not configured.' }, { status: 500 });
  }
  try {
    const { code } = await request.json();
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    return NextResponse.json({
      success: true,
      email: userInfo.data.email,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json({ error: 'OAuth failed' }, { status: 500 });
  }
}

// Sync emails from Gmail
export async function PUT(request) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google OAuth not configured.' }, { status: 500 });
  }
  try {
    const { accessToken, refreshToken, expiryDate, syncedEmailIds } = await request.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Missing access or refresh token' }, { status: 400 });
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Fetch recent messages - complaint focused
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: 'after:2026/01/01 before:2027/01/01 (complaint OR issue OR problem OR fault OR urgent OR repair OR maintenance OR breakdown OR error OR not working OR service OR assistance OR help OR ticket OR work order) -from:linkedin.com -from:google.com -subject:"security alert" -subject:"new sign-in" -subject:"password changed"',
    });
    
    const messages = response.data.messages || [];
    const newEmails = [];
    const updatedSyncedIds = [...(syncedEmailIds || [])];
    
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
      
      if (isComplaintEmail(emailData)) {
        newEmails.push(emailData);
      }
      
      updatedSyncedIds.push(message.id);
    }
    
    return NextResponse.json({
      success: true,
      newEmails,
      syncedEmailIds: updatedSyncedIds,
      count: newEmails.length,
    });
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

// Disconnect Gmail account
export async function DELETE() {
  return NextResponse.json({ success: true });
}
