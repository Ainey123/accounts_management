import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding operational user roles...");
  
  await prisma.user.deleteMany({});

  await prisma.user.create({
    data: {
      email: "admin@fes.com",
      password: hashPassword("admin123"),
      role: "ADMIN",
      employeeName: "Master Admin",
      activeStatus: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "employee@fes.com",
      password: hashPassword("employee123"),
      role: "EMPLOYEE",
      employeeName: "Field Operations Group",
      activeStatus: true,
    },
  });

  console.log("Seeding complete! Users created with hashed passwords.");
  console.log("Admin: admin@fes.com / admin123");
  console.log("Employee: employee@fes.com / employee123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
