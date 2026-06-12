import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL precisa estar configurada para executar o seed.");
}

function removeSslMode(url: string) {
  const databaseUrl = new URL(url);
  databaseUrl.searchParams.delete("sslmode");

  return databaseUrl.toString();
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: removeSslMode(connectionString),
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

const user = {
  id: "f79db86099593d311777297de498171c",
  username: "admin",
  name: "admin",
  role: "admin",
  passwordHash:
    "pbkdf2_sha512$210000$e22d5d2a9e991c77866b372bc1db7e72$ee5432060c6188b92c27521e5150f73ceb8ada22d09b20d771bbeebbca2689dc04ac9afd614c6ad0ecf45fa9762b4cfcb36257dde0c2f4f86561b6893e6f7951",
  createdAt: new Date("2026-06-12T11:04:05.650Z"),
};

const session = {
  id: "c02f543a-b06c-420e-914a-4018b35efc0f",
  userId: user.id,
  createdAt: new Date("2026-06-12T11:57:35.623Z"),
  expiresAt: new Date("2026-06-12T19:57:35.623Z"),
};

const whatsappInstance = {
  id: "f39202d8-2ed1-4498-b262-95ab48967263",
  userId: user.id,
  instanceName: "whatsapp_f79db86099593d311777297de498171c",
  status: "connected",
  createdAt: new Date("2026-06-12T12:29:15.203Z"),
  updatedAt: new Date("2026-06-12T12:29:24.775Z"),
  connectedAt: new Date("2026-06-12T12:29:24.775Z"),
};

async function main() {
  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      username: user.username,
      name: user.name,
      role: user.role,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    },
    create: user,
  });

  await prisma.session.upsert({
    where: { id: session.id },
    update: {
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    },
    create: session,
  });

  await prisma.whatsappInstance.upsert({
    where: { id: whatsappInstance.id },
    update: {
      userId: whatsappInstance.userId,
      instanceName: whatsappInstance.instanceName,
      status: whatsappInstance.status,
      createdAt: whatsappInstance.createdAt,
      updatedAt: whatsappInstance.updatedAt,
      connectedAt: whatsappInstance.connectedAt,
      disconnectedAt: null,
    },
    create: whatsappInstance,
  });

  console.log("Seed executado com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
