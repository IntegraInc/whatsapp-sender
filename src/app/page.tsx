import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { getWhatsappInstanceByUserId } from "@/lib/whatsapp-instances";
import { AppShell } from "@/components/AppShell";
import { WhatsappSender } from "@/components/WhatsappSender";

export default async function Home() {
  const authContext = await getCurrentAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user } = authContext;
  const whatsappInstance = await getWhatsappInstanceByUserId(user.id);

  return (
    <AppShell activeItem="send" title="Envio de WhatsApp por Excel" user={user}>
      <WhatsappSender initialInstance={whatsappInstance} />
    </AppShell>
  );
}
