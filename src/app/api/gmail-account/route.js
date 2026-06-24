import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all connected Gmail accounts for current user
export async function GET(request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        return NextResponse.json({ accounts: [] });
      }
      var accounts = await prisma.gmailAccount.findMany({
        where: { userId: firstUser.id },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      accounts = await prisma.gmailAccount.findMany({
        where: { userId: Number(userId) },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        gmailEmail: a.gmailEmail,
        syncedAt: a.syncedAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get Gmail accounts error:', error);
    return NextResponse.json({ error: 'Failed to get accounts' }, { status: 500 });
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
      account: {
        id: account.id,
        email: account.gmailEmail,
        syncedAt: account.syncedAt,
      },
    });
  } catch (error) {
    console.error('Save Gmail account error:', error);
    return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
  }
}

// Disconnect specific Gmail account
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    await prisma.gmailAccount.delete({
      where: { id: Number(accountId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect Gmail error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
