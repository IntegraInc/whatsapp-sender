import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { AuthenticatedUser } from "@/lib/auth";

type AppShellProps = {
  activeItem: "send" | "users";
  children: React.ReactNode;
  title: string;
  user: AuthenticatedUser;
};

const menuItems = [
  {
    href: "/",
    key: "send",
    label: "Envios",
  },
  {
    href: "/usuarios/novo",
    key: "users",
    label: "Criar usuario",
  },
] as const;

export function AppShell({ activeItem, children, title, user }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col px-4 py-5">
            <div className="mb-6 px-2">
              <p className="text-sm font-semibold text-emerald-700">
                WhatsApp Sender
              </p>
              <p className="mt-1 text-sm text-slate-600">Logado como {user.name}</p>
            </div>

            <nav className="flex gap-2 lg:flex-col">
              {menuItems.map((item) => {
                const isActive = item.key === activeItem;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <form action={logoutAction} className="mt-6 lg:mt-auto">
              <button
                type="submit"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 px-6 py-8">
          <div className="mx-auto w-full max-w-6xl">
            <header className="mb-8">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
                {title}
              </h1>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
