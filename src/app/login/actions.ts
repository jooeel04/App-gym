"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  weak_password: "La contraseña es demasiado débil (mínimo 6 caracteres).",
  over_request_rate_limit: "Demasiados intentos. Espera un momento.",
  over_email_send_rate_limit: "Demasiados correos enviados. Espera un momento.",
};

function authMessage(error: { code?: string } | null) {
  return (error?.code && AUTH_ERRORS[error.code]) || "No se pudo completar. Inténtalo de nuevo.";
}

// Inicia sesión o crea la cuenta según el botón pulsado (intent).
export async function authenticate(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 6) return { error: "Introduce un correo y una contraseña de al menos 6 caracteres." };

  const supabase = await createSupabaseServerClient();

  if (formData.get("intent") === "signup") {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: origin + "/auth/confirm" },
    });
    if (error) return { error: authMessage(error) };
    if (!data.session) return { message: "Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authMessage(error) };
  }

  redirect("/entrenar");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
