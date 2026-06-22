import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding operational user roles...");
  
  // Clear any residual data to avoid conflict mutations
  await prisma.user.deleteMany({});

  // Insert Master Admin Security Record
  await prisma.user.create({
    data: {
      email: "admin@fes.com",
      password: "admin123", // In production, hash this with bcrypt
      role: "ADMIN",
      employeeName: "Master Admin",
      activeStatus: true,
    },
  });

  // Insert Standard Processing Employee Record
  await prisma.user.create({
    data: {
      email: "employee@fes.com",
      password: "employee123",
      role: "EMPLOYEE",
      employeeName: "Field Operations Group",
      activeStatus: true,
    },
  });

  console.log("Seeding complete! User accounts are primed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
