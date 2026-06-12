"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  authenticateUser,
  createSession,
  deleteSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export type LoginFormState = {
  message?: string;
  fields?: {
    username?: string;
  };
};

export async function loginAction(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return {
      message: "Informe usuario e senha.",
      fields: { username },
    };
  }

  const user = await authenticateUser(username, password);

  if (!user) {
    return {
      message: "Credenciais invalidas.",
      fields: { username },
    };
  }

  const session = await createSession(user.id);
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    session.token,
    getSessionCookieOptions(session.maxAge)
  );

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  await deleteSession(token);
  cookieStore.delete(SESSION_COOKIE_NAME);

  redirect("/login");
}
