import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'production'
    ? `${process.env.VERCEL_URL}/api/gmail/callback`
    : 'http://localhost:3000/api/gmail/callback'
);

// Start OAuth connection
export async function GET() {
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
  try {
    const { code } = await request.json();
    
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
  try {
    const { accessToken, refreshToken, expiryDate, syncedEmailIds } = await request.json();
    
    // Set up OAuth client with stored tokens
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Fetch recent messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'is:unread OR newer_than:1d',
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
      
      newEmails.push({
        gmailMessageId: message.id,
        sender: from,
        subject,
        exactDate: date,
        time,
      });
      
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
