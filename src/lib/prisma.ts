import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL precisa estar configurada.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function removeSslMode(url: string) {
  const databaseUrl = new URL(url);
  databaseUrl.searchParams.delete("sslmode");

  return databaseUrl.toString();
}

const adapter = new PrismaPg({
  connectionString: removeSslMode(connectionString),
  ssl: {
    rejectUnauthorized: false,
  },
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
