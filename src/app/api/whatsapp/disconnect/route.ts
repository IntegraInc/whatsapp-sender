import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteEvolutionInstance,
  isEvolutionInstanceNotFoundError,
} from "@/lib/evolution";
import {
  getWhatsappInstanceByUserId,
  removeWhatsappInstanceForUser,
} from "@/lib/whatsapp-instances";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Nao autenticado." },
        { status: 401 }
      );
    }

    const instance = await getWhatsappInstanceByUserId(user.id);

    if (!instance) {
      return NextResponse.json({ success: true, instance: null });
    }

    try {
      await deleteEvolutionInstance(instance.instanceName);
    } catch (error: unknown) {
      if (!isEvolutionInstanceNotFoundError(error)) {
        throw error;
      }
    }

    await removeWhatsappInstanceForUser(user.id);

    return NextResponse.json({ success: true });
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
