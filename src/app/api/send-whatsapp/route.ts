import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEvolutionTextMessage } from "@/lib/evolution";
import { getWhatsappInstanceByUserId } from "@/lib/whatsapp-instances";

export async function POST(req: NextRequest) {
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
   return NextResponse.json(
    { success: false, error: "Conecte o WhatsApp antes de enviar mensagens." },
    { status: 409 }
   );
  }

  if (instance.status !== "connected") {
   return NextResponse.json(
    { success: false, error: "Aguarde o WhatsApp ficar conectado antes de enviar." },
    { status: 409 }
   );
  }

  const { number, text } = await req.json();
  const data = await sendEvolutionTextMessage(instance.instanceName, {
   number,
   text,
  });

  return NextResponse.json({
   success: true,
   data,
  });
 } catch (error: any) {
  console.log("STATUS:", error.response?.status);
  console.log("DATA:", error.response?.data);
  console.log("MESSAGE:", error.message);

  return NextResponse.json(
   {
    success: false,
    status: error.response?.status,
    error: error.response?.data || error.message,
   },
   { status: 500 }
  );
 }
}
