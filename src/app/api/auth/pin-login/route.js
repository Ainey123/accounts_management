import { NextResponse } from 'next/server';

export async function POST(request) {
  const { pin, role } = await request.json();

  const ADMIN_PIN = (process.env.ADMIN_PIN || '123456').toString();
  const EMPLOYEE_PIN = (process.env.EMPLOYEE_PIN || '654321').toString();

  const pinStr = pin?.toString().trim();

  console.log('PIN login attempt:', { role, pinStr, ADMIN_PIN });

  if (role === 'ADMIN' && pinStr === ADMIN_PIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'temp-admin123', role: 'ADMIN' } });
  }
  
  if (role === 'EMPLOYEE' && pinStr === EMPLOYEE_PIN) {
    return NextResponse.json({ user: { email: 'user@gmail.com', tempPassword: 'temp-user123', role: 'EMPLOYEE' } });
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}