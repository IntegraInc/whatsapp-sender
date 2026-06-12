import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createEvolutionInstance,
  isEvolutionInstanceAlreadyExistsError,
} from "@/lib/evolution";
import {
  buildWhatsappInstanceName,
  createWhatsappInstanceForUser,
  getWhatsappInstanceByUserId,
} from "@/lib/whatsapp-instances";

function getWebhookUrl(req: NextRequest) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");

  if (host) {
    return `${forwardedProto ?? req.nextUrl.protocol.replace(":", "")}://${host}/api/webhooks/evolution`;
  }

  return new URL("/api/webhooks/evolution", req.nextUrl.origin).toString();
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Nao autenticado." },
        { status: 401 }
      );
    }

    const existingInstance = await getWhatsappInstanceByUserId(user.id);

    if (existingInstance?.status === "connected") {
      return NextResponse.json({
        success: true,
        instance: existingInstance,
      });
    }

    const instanceName = existingInstance?.instanceName ?? buildWhatsappInstanceName(user.id);
    let data: unknown = null;

    try {
      data = await createEvolutionInstance(instanceName, getWebhookUrl(req));
    } catch (error: unknown) {
      if (!isEvolutionInstanceAlreadyExistsError(error)) {
        throw error;
      }
    }

    const instance = await createWhatsappInstanceForUser(user.id, data);

    return NextResponse.json({
      success: true,
      instance,
    });
  } catch (error: unknown) {
    const responseError = error as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };

    return NextResponse.json(
      {
        success: false,
        status: responseError.response?.status,
        error: responseError.response?.data || responseError.message,
      },
      { status: responseError.response?.status || 500 }
    );
  }
}
