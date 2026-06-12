import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEvolutionInstanceState } from "@/lib/evolution";
import {
  getWhatsappInstanceByUserId,
  updateWhatsappInstanceFromWebhook,
} from "@/lib/whatsapp-instances";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Nao autenticado." },
      { status: 401 }
    );
  }

  let instance = await getWhatsappInstanceByUserId(user.id);

  if (instance) {
    try {
      const evolutionState = await getEvolutionInstanceState(instance.instanceName);

      if (evolutionState.state) {
        instance = await updateWhatsappInstanceFromWebhook({
          instanceName: instance.instanceName,
          state: evolutionState.state,
          phoneNumber: evolutionState.phoneNumber ?? undefined,
        });
      }
    } catch (error) {
      console.error("Falha ao sincronizar status da Evolution API.", error);
    }
  }

  return NextResponse.json({
    success: true,
    instance,
  });
}
