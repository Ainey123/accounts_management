import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple in-memory settings store (for demo; use a database table in production)
const SETTINGS = {
  appName: 'NEXUS Operations',
  companyName: 'FES FAST Engineering Solutions',
  companyEmail: 'info@fastengineeringsolutions.com',
  companyPhone: '+92-300-1234567',
  companyAddress: 'Lahore, Pakistan',
  taxRate: 0.15,
  currency: 'PKR',
  emailFilterEnabled: true,
  autoSyncEnabled: false,
  syncInterval: '24h',
};

export async function GET() {
  return NextResponse.json({ settings: SETTINGS });
}

export async function POST(request) {
  try {
    const updates = await request.json();
    Object.assign(SETTINGS, updates);
    return NextResponse.json({ success: true, settings: SETTINGS });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
