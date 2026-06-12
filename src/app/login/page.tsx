import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_420px]">
        <section className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            WhatsApp Sender [BETA]
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Acesse o painel de envios
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Entre com o usuario cadastrado no  importar sua
            planilha e disparar mensagens via whatsapp.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-950">Login</h2>

          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
