import { prisma } from './src/lib/prisma.js';
import { hashPassword } from './src/lib/password.js';

async function main() {
  try {
    const adminEmail = 'admin@gmail.com';
    const employeeEmail = 'guest@example.com';

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashPassword('admin123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
      create: {
        email: adminEmail,
        password: hashPassword('admin123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    await prisma.user.upsert({
      where: { email: employeeEmail },
      update: {
        password: hashPassword('guest123'),
        role: 'EMPLOYEE',
        employeeName: 'Guest User',
        activeStatus: true,
      },
      create: {
        email: employeeEmail,
        password: hashPassword('guest123'),
        role: 'EMPLOYEE',
        employeeName: 'Guest User',
        activeStatus: true,
      },
    });

    console.log('Seed complete!');
    console.log('Admin credentials:', { email: adminEmail, password: 'admin123' });
    console.log('Guest credentials:', { email: employeeEmail, password: 'guest123' });
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
