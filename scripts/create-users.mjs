import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const KEY_LEN = 64;
function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
      }
    }
  });

  // Create admin@fes.com if it doesn't exist
  const adminFeS = await prisma.user.upsert({
    where: { email: 'admin@fes.com' },
    update: {},
    create: {
      email: 'admin@fes.com',
      password: hashPassword('admin123'),
      role: 'ADMIN',
      employeeName: 'System Administrator',
      activeStatus: true,
    }
  });
  console.log('Created/found admin@fes.com:', adminFeS.email);

  // Create employee@fes.com if it doesn't exist
  const employeeFeS = await prisma.user.upsert({
    where: { email: 'employee@fes.com' },
    update: {},
    create: {
      email: 'employee@fes.com',
      password: hashPassword('employee123'),
      role: 'EMPLOYEE',
      employeeName: 'Default Employee',
      activeStatus: true,
    }
  });
  console.log('Created/found employee@fes.com:', employeeFeS.email);

  const allUsers = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('All users:', allUsers);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
