import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  // Verifica se já existe um usuário admin
  const adminUser = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
    },
  });

  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123@!";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Se não existir, cria um novo usuário admin
  if (!adminUser) {
    await prisma.user.create({
      data: {
        name: "Admin User",
        cpf: "00000000000", // CPF fictício
        email: "admin@hrx.com",
        phone: "0000000000", // Telefone fictício
        password: hashedPassword, // Certifique-se de usar uma senha hash
        role: "ADMIN",
      },
    });
    console.log("Admin user created");
  } else {
    console.log("Admin user already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
