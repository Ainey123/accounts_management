import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get connected Gmail account
export async function GET() {
  try {
    const account = await prisma.gmailAccount.findFirst();
    
    if (!account) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      email: account.gmailEmail,
      syncedAt: account.syncedAt,
    });
  } catch (error) {
    console.error('Get Gmail account error:', error);
    return NextResponse.json({ error: 'Failed to get account' }, { status: 500 });
  }
}

// Save Gmail account tokens
export async function POST(request) {
  try {
    const { email, accessToken, refreshToken, expiryDate, userId } = await request.json();

    if (!email || !accessToken || !refreshToken) {
      return NextResponse.json({ error: 'email, accessToken, and refreshToken are required' }, { status: 400 });
    }

    let targetUserId = userId;
    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        return NextResponse.json({ error: 'No user found. Create a user first.' }, { status: 400 });
      }
      targetUserId = firstUser.id;
    }

    const parsedExpiry = expiryDate ? BigInt(expiryDate) : BigInt(Date.now() + 3600000);

    const account = await prisma.gmailAccount.upsert({
      where: { gmailEmail: email },
      update: {
        accessToken,
        refreshToken,
        expiryDate: parsedExpiry,
        syncedAt: new Date(),
        userId: targetUserId,
      },
      create: {
        userId: targetUserId,
        gmailEmail: email,
        accessToken,
        refreshToken,
        expiryDate: parsedExpiry,
        syncedEmailIds: '[]',
      },
    });

    return NextResponse.json({
      success: true,
      email: account.gmailEmail,
    });
  } catch (error) {
    console.error('Save Gmail account error:', error);
    return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
  }
}

// Disconnect Gmail account
export async function DELETE() {
  try {
    await prisma.gmailAccount.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect Gmail error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
