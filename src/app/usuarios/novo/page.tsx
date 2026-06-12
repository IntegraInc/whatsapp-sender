import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentAuthContext } from "@/lib/auth";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  const authContext = await getCurrentAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  return (
    <AppShell
      activeItem="users"
      title="Criar usuario"
      user={authContext.user}
    >
      <section className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Novo acesso ao sistema
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            O usuario criado aqui podera entrar pela tela de login.
          </p>
        </div>

        <CreateUserForm />
      </section>
    </AppShell>
  );
}
