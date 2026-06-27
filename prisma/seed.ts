import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from 'crypto';

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding operational user roles...");
  
  // We use upsert instead of deleteMany + create to protect user data and connected accounts during seeding.
  const adminEmail = "admin@fes.com";
  const employeeEmail = "employee@fes.com";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashPassword("admin123"),
      role: "ADMIN",
      employeeName: "Master Admin",
      activeStatus: true,
    },
    create: {
      email: adminEmail,
      password: hashPassword("admin123"),
      role: "ADMIN",
      employeeName: "Master Admin",
      activeStatus: true,
    },
  });

  await prisma.user.upsert({
    where: { email: employeeEmail },
    update: {
      password: hashPassword("employee123"),
      role: "EMPLOYEE",
      employeeName: "Field Operations Group",
      activeStatus: true,
    },
    create: {
      email: employeeEmail,
      password: hashPassword("employee123"),
      role: "EMPLOYEE",
      employeeName: "Field Operations Group",
      activeStatus: true,
    },
  });

  console.log("Seeding complete! Users upserted with hashed passwords.");
  console.log("Admin credentials:", { email: adminEmail, password: "admin123" });
  console.log("Employee credentials:", { email: employeeEmail, password: "employee123" });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
