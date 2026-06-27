import { NextResponse } from 'next/server';

export async function POST(request) {
  const { pin, role } = await request.json();

  const ADMIN_PIN = process.env.ADMIN_PIN || '123456';
  const EMPLOYEE_PIN = process.env.EMPLOYEE_PIN || '654321';

  console.log('PIN login attempt:', { role, pinLength: pin?.length, adminPinSet: !!process.env.ADMIN_PIN });

  if (role === 'ADMIN' && pin === ADMIN_PIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'admin123', role: 'ADMIN' } });
  }
  
  if (role === 'EMPLOYEE' && pin === EMPLOYEE_PIN) {
    return NextResponse.json({ user: { email: 'user@gmail.com', tempPassword: 'user123', role: 'EMPLOYEE' } });
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}