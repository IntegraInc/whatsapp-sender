import "server-only";

import axios from "axios";

type EvolutionCreateInstancePayload = {
  instanceName: string;
  qrcode: true;
  integration: "WHATSAPP-BAILEYS";
  webhook?: {
    enabled: true;
    url: string;
    byEvents: boolean;
    base64: boolean;
    events: string[];
  };
};

function getEvolutionConfig() {
  const baseUrl = process.env.EVOLUTION_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("EVOLUTION_URL e EVOLUTION_API_KEY precisam estar configurados.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
  };
}

function getHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  };
}

function getWebhookEvents() {
  const events = process.env.EVOLUTION_WEBHOOK_EVENTS;

  if (!events) {
    return ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];
  }

  return events
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean);
}

function getWebhookConfig(url?: string) {
  if (!url) return undefined;

  return {
    enabled: true as const,
    url,
    byEvents: true,
    base64: false,
    events: getWebhookEvents(),
  };
}

export async function createEvolutionInstance(instanceName: string, webhookUrl?: string) {
  const { baseUrl, apiKey } = getEvolutionConfig();
  const payload: EvolutionCreateInstancePayload = {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: getWebhookConfig(webhookUrl),
  };

  const response = await axios.post(`${baseUrl}/instance/create`, payload, {
    headers: getHeaders(apiKey),
  });

  return response.data;
}

export function isEvolutionInstanceAlreadyExistsError(error: unknown) {
  const responseError = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  const errorText = JSON.stringify(
    responseError.response?.data ?? responseError.message ?? ""
  ).toLowerCase();

  return (
    responseError.response?.status === 409 ||
    (errorText.includes("instance") && errorText.includes("exist"))
  );
}

export function isEvolutionInstanceNotFoundError(error: unknown) {
  const responseError = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  const errorText = JSON.stringify(
    responseError.response?.data ?? responseError.message ?? ""
  ).toLowerCase();

  return (
    responseError.response?.status === 404 ||
    (errorText.includes("instance") && errorText.includes("not") && errorText.includes("found"))
  );
}

export async function deleteEvolutionInstance(instanceName: string) {
  const { baseUrl, apiKey } = getEvolutionConfig();

  const response = await axios.delete(`${baseUrl}/instance/delete/${instanceName}`, {
    headers: getHeaders(apiKey),
  });

  return response.data;
}

export async function sendEvolutionTextMessage(
  instanceName: string,
  body: { number: string; text: string }
) {
  const { baseUrl, apiKey } = getEvolutionConfig();

  const response = await axios.post(`${baseUrl}/message/sendText/${instanceName}`, body, {
    headers: getHeaders(apiKey),
  });

  return response.data;
}

function findStringByKey(data: unknown, keys: string[]): string | null {
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

function findInstancePayload(data: unknown, instanceName: string): unknown {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const value = findInstancePayload(item, instanceName);

      if (value) return value;
    }

    return null;
  }

  const candidateInstanceName = findStringByKey(data, [
    "instanceName",
    "instance",
    "name",
  ]);

  if (candidateInstanceName === instanceName) {
    return data;
  }

  for (const value of Object.values(data)) {
    const nestedValue = findInstancePayload(value, instanceName);

    if (nestedValue) return nestedValue;
  }

  return null;
}

export async function getEvolutionInstanceState(instanceName: string) {
  const { baseUrl, apiKey } = getEvolutionConfig();

  try {
    const response = await axios.get(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: getHeaders(apiKey),
      }
    );

    return {
      state: findStringByKey(response.data, ["state", "status", "connectionStatus"]),
      phoneNumber: findStringByKey(response.data, ["number", "phone", "phoneNumber", "owner"]),
      data: response.data,
    };
  } catch {
    const response = await axios.get(`${baseUrl}/instance/fetchInstances`, {
      headers: getHeaders(apiKey),
    });
    const instancePayload = findInstancePayload(response.data, instanceName);

    return {
      state: findStringByKey(instancePayload, [
        "state",
        "status",
        "connectionStatus",
      ]),
      phoneNumber: findStringByKey(instancePayload, [
        "number",
        "phone",
        "phoneNumber",
        "owner",
      ]),
      data: instancePayload,
    };
  }
}
