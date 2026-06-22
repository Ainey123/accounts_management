import { prisma } from './src/lib/prisma.js';
import { hashPassword } from './src/lib/password.js';

async function main() {
  try {
    const adminEmail = 'admin@fes.com';
    const employeeEmail = 'employee@fes.com';

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log('Seed data already exists');
      process.exit(0);
    }

    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashPassword('admin123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });

    await prisma.user.create({
      data: {
        email: employeeEmail,
        password: hashPassword('employee123'),
        role: 'EMPLOYEE',
        employeeName: 'Default Employee',
        activeStatus: true,
      },
    });

    console.log('Seed complete!');
    console.log('Admin credentials:', { email: adminEmail, password: 'admin123' });
    console.log('Employee credentials:', { email: employeeEmail, password: 'employee123' });
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
