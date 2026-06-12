import { NextRequest, NextResponse } from "next/server";
import {
  extractPhoneNumber,
  extractQrCode,
  findStringByKey,
  updateWhatsappInstanceFromWebhook,
} from "@/lib/whatsapp-instances";

type EvolutionWebhookPayload = {
  event?: string;
  instance?: unknown;
  data?: unknown;
};

function normalizeEvent(event?: string | null) {
  return String(event ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", ".");
}

function isConnectionUpdateEvent(event?: string | null) {
  const normalizedEvent = normalizeEvent(event);

  return (
    normalizedEvent === "connection.update" ||
    normalizedEvent.endsWith(".connection.update")
  );
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as EvolutionWebhookPayload;
    const event = payload.event ?? findStringByKey(payload, ["event"]);
    const instanceName =
      (typeof payload.instance === "string" ? payload.instance : null) ??
      findStringByKey(payload, ["instanceName", "instance"]);
    const state = findStringByKey(payload.data ?? payload, [
      "state",
      "status",
      "connection",
    ]);

    if (
      instanceName &&
      state &&
      isConnectionUpdateEvent(event)
    ) {
      await updateWhatsappInstanceFromWebhook({
        instanceName,
        state,
        phoneNumber: extractPhoneNumber(payload.data ?? payload) ?? undefined,
        qrCode: extractQrCode(payload.data ?? payload) ?? undefined,
      });
    }

    console.log("Evolution webhook recebido:", {
      event,
      instance: instanceName,
      state,
      data: payload.data,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao processar webhook.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
