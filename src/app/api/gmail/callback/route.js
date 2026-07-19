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

function createOAuth2Client() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/gmail/callback`
  );
}

// OAuth callback handler - server-side token exchange and redirect
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = getBaseUrl();

  if (error) {
    return NextResponse.redirect(`${appUrl}/gmail?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/gmail?error=No+code+received`);
  }

  try {
    const oauth2Client = createOAuth2Client();
    if (!oauth2Client) throw new Error('OAuth not configured');

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Save to DB
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) throw new Error('No admin user found to link account');

    const parsedExpiry = tokens.expiry_date ? BigInt(tokens.expiry_date) : BigInt(Date.now() + 3600000);

    await prisma.gmailAccount.upsert({
      where: { gmailEmail: email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: parsedExpiry,
        syncedAt: new Date(),
        userId: firstUser.id,
      },
      create: {
        userId: firstUser.id,
        gmailEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: parsedExpiry,
        syncedEmailIds: '[]',
      },
    });

    return NextResponse.redirect(`${appUrl}/gmail?success=true&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    let errorMsg = err.message || 'Unknown error';
    if (errorMsg.includes('403') || errorMsg.includes('access_denied')) {
      errorMsg = 'Google OAuth setup incomplete. Add your Gmail as a Test user in Google Cloud Console.';
    }
    return NextResponse.redirect(`${appUrl}/gmail?error=${encodeURIComponent(errorMsg)}`);
  }
}
