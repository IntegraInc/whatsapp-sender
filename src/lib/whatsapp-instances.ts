import "server-only";

import { randomUUID } from "crypto";
import {
  type WhatsappInstance,
  type WhatsappInstanceStatus,
  readDatabase,
  writeDatabase,
} from "./database";

export type WhatsappInstanceDTO = {
  id: string;
  userId: string;
  instanceName: string;
  phoneNumber?: string;
  status: WhatsappInstanceStatus;
  qrCode?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function toDTO(instance: WhatsappInstance): WhatsappInstanceDTO {
  return {
    id: instance.id,
    userId: instance.userId,
    instanceName: instance.instanceName,
    phoneNumber: instance.phoneNumber,
    status: instance.status,
    qrCode: instance.qrCode,
    connectedAt: instance.connectedAt,
    disconnectedAt: instance.disconnectedAt,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

export function buildWhatsappInstanceName(userId: string) {
  return `whatsapp_${userId}`;
}

export function normalizeWhatsappStatus(state?: string): WhatsappInstanceStatus {
  const normalizedState = String(state ?? "").toLowerCase();

  if (normalizedState === "open" || normalizedState === "connected") {
    return "connected";
  }

  if (normalizedState === "connecting") {
    return "connecting";
  }

  if (normalizedState === "close" || normalizedState === "closed") {
    return "closed";
  }

  if (normalizedState === "disconnected") {
    return "disconnected";
  }

  if (normalizedState === "error") {
    return "error";
  }

  return "connecting";
}

export function findStringByKey(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const value = findStringByKey(item, keys);

      if (value) return value;
    }

    return null;
  }

  for (const [key, value] of Object.entries(data)) {
    if (keys.includes(key) && typeof value === "string" && value.trim()) {
      return value;
    }

    const nestedValue = findStringByKey(value, keys);

    if (nestedValue) return nestedValue;
  }

  return null;
}

export function extractQrCode(data: unknown) {
  return findStringByKey(data, [
    "base64",
    "base64Qr",
    "base64QRCode",
    "qrCodeBase64",
    "qrcodeBase64",
    "qrcode",
    "qrCode",
  ]);
}

export function extractPhoneNumber(data: unknown) {
  return findStringByKey(data, ["number", "phone", "phoneNumber", "owner"]);
}

export async function getWhatsappInstanceByUserId(userId: string) {
  const database = await readDatabase();
  const instance = database.whatsappInstances.find(
    (candidate) => candidate.userId === userId
  );

  return instance ? toDTO(instance) : null;
}

export async function getWhatsappInstanceByName(instanceName: string) {
  const database = await readDatabase();
  const instance = database.whatsappInstances.find(
    (candidate) => candidate.instanceName === instanceName
  );

  return instance ? toDTO(instance) : null;
}

export async function createWhatsappInstanceForUser(
  userId: string,
  data: unknown
) {
  const database = await readDatabase();
  const existingInstance = database.whatsappInstances.find(
    (candidate) => candidate.userId === userId
  );
  const now = new Date().toISOString();

  if (existingInstance) {
    existingInstance.qrCode = extractQrCode(data) ?? existingInstance.qrCode;
    existingInstance.phoneNumber =
      extractPhoneNumber(data) ?? existingInstance.phoneNumber;
    existingInstance.status =
      existingInstance.status === "connected" ? "connected" : "connecting";
    existingInstance.updatedAt = now;
    await writeDatabase(database);

    return toDTO(existingInstance);
  }

  const instance: WhatsappInstance = {
    id: randomUUID(),
    userId,
    instanceName: buildWhatsappInstanceName(userId),
    phoneNumber: extractPhoneNumber(data) ?? undefined,
    status: "connecting",
    qrCode: extractQrCode(data) ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  database.whatsappInstances.push(instance);
  await writeDatabase(database);

  return toDTO(instance);
}

export async function updateWhatsappInstanceFromWebhook(input: {
  instanceName: string;
  state?: string;
  phoneNumber?: string;
  qrCode?: string;
}) {
  const database = await readDatabase();
  const instance = database.whatsappInstances.find(
    (candidate) => candidate.instanceName === input.instanceName
  );

  if (!instance) return null;

  const now = new Date().toISOString();
  const status = normalizeWhatsappStatus(input.state);

  instance.status = status;
  instance.updatedAt = now;

  if (input.phoneNumber) {
    instance.phoneNumber = input.phoneNumber;
  }

  if (input.qrCode) {
    instance.qrCode = input.qrCode;
  }

  if (status === "connected") {
    instance.connectedAt = now;
    instance.disconnectedAt = undefined;
    instance.qrCode = undefined;
  }

  if (["closed", "disconnected", "error"].includes(status)) {
    instance.disconnectedAt = now;
  }

  await writeDatabase(database);

  return toDTO(instance);
}

export async function removeWhatsappInstanceForUser(userId: string) {
  const database = await readDatabase();
  const instance = database.whatsappInstances.find(
    (candidate) => candidate.userId === userId
  );

  if (!instance) return null;

  database.whatsappInstances = database.whatsappInstances.filter(
    (candidate) => candidate.id !== instance.id
  );
  await writeDatabase(database);

  return toDTO(instance);
}
