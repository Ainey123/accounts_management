import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

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
        url: 'postgresql://postgres.cheqzrvucqlrdtlvfirk:anie%401234%231234@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
      }
    }
  });

  const adminHash = hashPassword('admin123');
  const employeeHash = hashPassword('employee123');

  await prisma.user.updateMany({
    where: { email: 'admin@gmail.com' },
    data: { password: adminHash, role: 'ADMIN', activeStatus: true }
  });

  await prisma.user.updateMany({
    where: { email: 'user@gmail.com' },
    data: { password: employeeHash, role: 'EMPLOYEE', activeStatus: true }
  });

  await prisma.user.updateMany({
    where: { email: 'sana@gmail.com' },
    data: { password: employeeHash, role: 'EMPLOYEE', activeStatus: true }
  });

  console.log('Passwords reset successfully');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
