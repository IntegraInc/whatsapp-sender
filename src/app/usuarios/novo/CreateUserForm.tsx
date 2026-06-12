"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserFormState } from "./actions";

const initialState: CreateUserFormState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="name">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={state.fields?.name ?? ""}
          className="h-12 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="username">
          Login
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          defaultValue={state.fields?.username ?? ""}
          className="h-12 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="h-12 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          required
        />
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="confirmPassword"
        >
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="h-12 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          required
        />
      </div>

      {state.message && (
        <p
          className={`rounded-md border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar usuario"}
      </button>
    </form>
  );
}
