import { prisma } from './src/lib/prisma.js';
import { hashPassword } from './src/lib/password.js';

async function main() {
  try {
    const adminEmail = 'admin@gmail.com';
    const employeeEmail = 'user@gmail.com';

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
      create: {
        email: adminEmail,
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    await prisma.user.upsert({
      where: { email: employeeEmail },
      update: {
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
      create: {
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
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
