import { NextResponse } from 'next/server';

export async function POST(request) {
  const { pin, role } = await request.json();

  const PINS = {
    ADMIN: process.env.ADMIN_PIN || '123456',
    EMPLOYEE: process.env.EMPLOYEE_PIN || '654321'
  };

  if (role === 'ADMIN' && pin === PINS.ADMIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'admin123', role: 'ADMIN' } });
  }
  
  if (role === 'EMPLOYEE' && pin === PINS.EMPLOYEE) {
    return NextResponse.json({ user: { email: 'guest@example.com', tempPassword: 'guest123', role: 'EMPLOYEE' } });
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}