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

// Envía el correo para cambiar la contraseña. Siempre responde lo mismo para no
// revelar qué correos tienen cuenta.
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe el correo de tu cuenta." };
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/auth/confirm?next=/auth/nueva-contrasena" });
  if (error?.code && error.code.startsWith("over_")) return { error: authMessage(error) };
  return { message: "Si ese correo tiene cuenta, te hemos enviado un enlace para crear una contraseña nueva. Ábrelo en este mismo navegador." };
}

// Guarda la contraseña nueva (tras entrar con el enlace del correo).
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Las dos contraseñas no coinciden." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "Usa una contraseña distinta de la anterior." : authMessage(error) };
  redirect("/entrenar");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
