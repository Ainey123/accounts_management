import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getAdminFromCookie(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/users/[id]/role
 * Body: { role: 'FIELD_EMPLOYEE' | 'EMPLOYEE' }
 */
export async function PATCH(request, context) {
  try {
    const admin = getAdminFromCookie(request);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const params = await context.params;
    const userId = Number(params?.id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    const { role } = await request.json();
    if (!role || (role !== 'FIELD_EMPLOYEE' && role !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Role must be either FIELD_EMPLOYEE or EMPLOYEE' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot change Administrator role' }, { status: 400 });
    }

    const updated = await withDbRetry(async () => {
      return await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, employeeName: true, role: true, email: true, activeStatus: true },
      });
    });

    return NextResponse.json({ user: updated, success: true });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Failed to update role: ' + error.message }, { status: 500 });
  }
}
