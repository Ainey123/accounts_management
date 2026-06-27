import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
      }
    }
  });

  await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      password: hashPassword('guest123'),
      role: 'EMPLOYEE',
      employeeName: 'Guest User',
      activeStatus: true,
    }
  });

  console.log('Guest user ready: guest@example.com / guest123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });