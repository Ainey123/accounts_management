const { PrismaClient } = require('@prisma/client');
const { scryptSync, randomBytes } = require('crypto');

function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Delete all existing users
    await prisma.user.deleteMany();
    console.log('Cleared existing users');

    // Create admin
    await prisma.user.create({
      data: {
        email: 'admin@gmail.com',
        password: hashPassword('password123'),
        role: 'ADMIN',
        employeeName: 'System Administrator',
        activeStatus: true,
      },
    });
    console.log('Created admin: admin@gmail.com / password123');

    // Create employee
    await prisma.user.create({
      data: {
        email: 'user@gmail.com',
        password: hashPassword('user123'),
        role: 'EMPLOYEE',
        employeeName: 'Default User',
        activeStatus: true,
      },
    });
    console.log('Created employee: user@gmail.com / user123');

    console.log('\n✅ Database seeded successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
