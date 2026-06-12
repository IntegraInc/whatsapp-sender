import "server-only";

import { prisma } from "./prisma";

export type UserRole = "admin";

export type User = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type WhatsappInstanceStatus =
  | "created"
  | "connecting"
  | "connected"
  | "disconnected"
  | "closed"
  | "error";

export type WhatsappInstance = {
  id: string;
  userId: string;
  companyId?: string;
  instanceName: string;
  phoneNumber?: string;
  status: WhatsappInstanceStatus;
  qrCode?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthDatabase = {
  users: User[];
  sessions: Session[];
  whatsappInstances: WhatsappInstance[];
};

function toIsoString(date: Date | string) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function toOptionalIsoString(date?: Date | string | null) {
  return date ? toIsoString(date) : undefined;
}

function toDate(date: string) {
  return new Date(date);
}

export async function readDatabase(): Promise<AuthDatabase> {
  const [users, sessions, whatsappInstances] = await Promise.all([
    prisma.user.findMany(),
    prisma.session.findMany(),
    prisma.whatsappInstance.findMany(),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      passwordHash: user.passwordHash,
      createdAt: toIsoString(user.createdAt),
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      createdAt: toIsoString(session.createdAt),
      expiresAt: toIsoString(session.expiresAt),
    })),
    whatsappInstances: whatsappInstances.map((instance) => ({
      id: instance.id,
      userId: instance.userId,
      instanceName: instance.instanceName,
      phoneNumber: instance.phoneNumber ?? undefined,
      status: instance.status as WhatsappInstanceStatus,
      qrCode: instance.qrCode ?? undefined,
      connectedAt: toOptionalIsoString(instance.connectedAt),
      disconnectedAt: toOptionalIsoString(instance.disconnectedAt),
      createdAt: toIsoString(instance.createdAt),
      updatedAt: toIsoString(instance.updatedAt),
    })),
  };
}

export async function writeDatabase(database: AuthDatabase) {
  const userIds = database.users.map((user) => user.id);
  const sessionIds = database.sessions.map((session) => session.id);
  const instanceIds = database.whatsappInstances.map((instance) => instance.id);

  for (const user of database.users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        createdAt: toDate(user.createdAt),
      },
      create: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        createdAt: toDate(user.createdAt),
      },
    });
  }

  await prisma.user.deleteMany({
    where: userIds.length ? { id: { notIn: userIds } } : {},
  });

  for (const session of database.sessions) {
    await prisma.session.upsert({
      where: { id: session.id },
      update: {
        userId: session.userId,
        createdAt: toDate(session.createdAt),
        expiresAt: toDate(session.expiresAt),
      },
      create: {
        id: session.id,
        userId: session.userId,
        createdAt: toDate(session.createdAt),
        expiresAt: toDate(session.expiresAt),
      },
    });
  }

  await prisma.session.deleteMany({
    where: sessionIds.length ? { id: { notIn: sessionIds } } : {},
  });

  for (const instance of database.whatsappInstances) {
    await prisma.whatsappInstance.upsert({
      where: { id: instance.id },
      update: {
        userId: instance.userId,
        instanceName: instance.instanceName,
        phoneNumber: instance.phoneNumber ?? null,
        status: instance.status,
        qrCode: instance.qrCode ?? null,
        connectedAt: instance.connectedAt ? toDate(instance.connectedAt) : null,
        disconnectedAt: instance.disconnectedAt
          ? toDate(instance.disconnectedAt)
          : null,
        createdAt: toDate(instance.createdAt),
        updatedAt: toDate(instance.updatedAt),
      },
      create: {
        id: instance.id,
        userId: instance.userId,
        instanceName: instance.instanceName,
        phoneNumber: instance.phoneNumber ?? null,
        status: instance.status,
        qrCode: instance.qrCode ?? null,
        connectedAt: instance.connectedAt ? toDate(instance.connectedAt) : null,
        disconnectedAt: instance.disconnectedAt
          ? toDate(instance.disconnectedAt)
          : null,
        createdAt: toDate(instance.createdAt),
        updatedAt: toDate(instance.updatedAt),
      },
    });
  }

  await prisma.whatsappInstance.deleteMany({
    where: instanceIds.length ? { id: { notIn: instanceIds } } : {},
  });
}
