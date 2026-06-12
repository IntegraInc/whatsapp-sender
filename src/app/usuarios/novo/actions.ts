"use server";

import { revalidatePath } from "next/cache";
import { createUserWithPassword, getCurrentUser } from "@/lib/auth";

export type CreateUserFormState = {
  message?: string;
  success?: boolean;
  fields?: {
    name?: string;
    username?: string;
  };
};

export async function createUserAction(
  _state: CreateUserFormState,
  formData: FormData
): Promise<CreateUserFormState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      message: "Sessao expirada. Faca login novamente.",
      success: false,
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !username || !password || !confirmPassword) {
    return {
      message: "Preencha todos os campos.",
      success: false,
      fields: { name, username },
    };
  }

  if (username.length < 3) {
    return {
      message: "O login precisa ter pelo menos 3 caracteres.",
      success: false,
      fields: { name, username },
    };
  }

  if (password.length < 6) {
    return {
      message: "A senha precisa ter pelo menos 6 caracteres.",
      success: false,
      fields: { name, username },
    };
  }

  if (password !== confirmPassword) {
    return {
      message: "As senhas nao conferem.",
      success: false,
      fields: { name, username },
    };
  }

  const result = await createUserWithPassword({
    name,
    username,
    password,
  });

  if (!result.ok) {
    return {
      message: result.message,
      success: false,
      fields: { name, username },
    };
  }

  revalidatePath("/usuarios/novo");

  return {
    message: result.message,
    success: true,
  };
}
