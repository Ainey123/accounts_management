import { NextResponse } from 'next/server';

export async function POST(request) {
  const { pin, role } = await request.json();

  // Trim and normalize the PIN
  const pinStr = String(pin || '').trim();
  const normalizedRole = String(role || '').toUpperCase();

  const ADMIN_PIN = (process.env.ADMIN_PIN || '123456').toString().trim();
  const EMPLOYEE_PIN = (process.env.EMPLOYEE_PIN || '654321').toString().trim();

  console.log('PIN check:', { pinStr, normalizedRole, ADMIN_PIN, EMPLOYEE_PIN, match: pinStr === ADMIN_PIN || pinStr === EMPLOYEE_PIN });

  if (normalizedRole === 'ADMIN' && pinStr === ADMIN_PIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'temp-admin123', role: 'ADMIN' } });
  }
  
  if (normalizedRole === 'EMPLOYEE' && pinStr === EMPLOYEE_PIN) {
    return NextResponse.json({ user: { email: 'user@gmail.com', tempPassword: 'temp-user123', role: 'EMPLOYEE' } });
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}