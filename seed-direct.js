const { PrismaClient } = require('@prisma/client');
const { scryptSync, randomBytes } = require('crypto');

function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: 'file:./prisma/dev.db'
  });
  
  try {
    const adminEmail = 'admin@gmail.com';
    const employeeEmail = 'user@gmail.com';

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log('Seed data already exists');
      return;
    }

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    await prisma.user.create({
      data: {
        email: employeeEmail,
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
    });

    console.log('Seed complete!');
    console.log('Admin credentials:', { email: adminEmail, password: 'password123' });
    console.log('Employee credentials:', { email: employeeEmail, password: 'user123' });
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
