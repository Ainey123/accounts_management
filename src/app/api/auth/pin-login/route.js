import { NextResponse } from 'next/server';

export async function POST(request) {
  const { pin, role } = await request.json();

  const pinStr = String(pin || '').trim();
  const normalizedRole = String(role || '').toUpperCase();

  // Hardcoded PINs as ultimate fallback
  const ADMIN_PIN = (process.env.ADMIN_PIN || '123456').toString().trim();
  const EMPLOYEE_PIN = (process.env.EMPLOYEE_PIN || '654321').toString().trim();

  console.log('PIN validation:', { pinStr, normalizedRole, adminMatch: pinStr === ADMIN_PIN, empMatch: pinStr === EMPLOYEE_PIN });

  // Debug: also log when PINs are set via env
  if (process.env.ADMIN_PIN) console.log('ADMIN_PIN from env:', process.env.ADMIN_PIN);
  if (process.env.EMPLOYEE_PIN) console.log('EMPLOYEE_PIN from env:', process.env.EMPLOYEE_PIN);

  if (normalizedRole === 'ADMIN' && pinStr === ADMIN_PIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'temp-admin123', role: 'ADMIN' } });
  }
  
  if (normalizedRole === 'EMPLOYEE' && pinStr === EMPLOYEE_PIN) {
    return NextResponse.json({ user: { email: 'user@gmail.com', tempPassword: 'temp-user123', role: 'EMPLOYEE' } });
  }

  // Fallback: if no role match but PIN matches
  if (pinStr === ADMIN_PIN) {
    return NextResponse.json({ user: { email: 'admin@gmail.com', tempPassword: 'temp-admin123', role: 'ADMIN' } });
  }
  if (pinStr === EMPLOYEE_PIN) {
    return NextResponse.json({ user: { email: 'user@gmail.com', tempPassword: 'temp-user123', role: 'EMPLOYEE' } });
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
}