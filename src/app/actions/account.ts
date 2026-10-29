"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

// Ajustes de la cuenta: contraseña, correo, privacidad en Social y borrar la cuenta.
// Todo con la sesión del usuario (RLS y funciones de la base de datos solo tocan lo suyo).

export interface Result<T = null> {
  ok: boolean;
  data?: T;
  error?: string;
}

const NO_DB = "Falta preparar la base de datos (migración nueva en Supabase).";

async function session() {
  if (!(await getCurrentUser())) return null;
  return createSupabaseServerClient();
}

export async function changePassword(password: unknown, confirm: unknown): Promise<Result> {
  if (typeof password !== "string" || password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  if (password !== confirm) return { ok: false, error: "Las dos contraseñas no coinciden." };
  const db = await session();
  if (!db) return { ok: false, error: "Sesión caducada: vuelve a iniciar sesión." };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { ok: false, error: error.code === "same_password" ? "Usa una contraseña distinta de la actual." : error.code === "weak_password" ? "La contraseña es demasiado débil." : "No se pudo cambiar la contraseña." };
  return { ok: true };
}

// Supabase manda un correo de confirmación: el cambio se hace al abrir el enlace.
export async function changeEmail(email: unknown): Promise<Result> {
  const value = typeof email === "string" ? email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 200) return { ok: false, error: "Escribe un correo válido." };
  const db = await session();
  if (!db) return { ok: false, error: "Sesión caducada: vuelve a iniciar sesión." };
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await db.auth.updateUser({ email: value }, { emailRedirectTo: origin + "/auth/confirm" });
  if (error) return { ok: false, error: error.code === "email_exists" ? "Ese correo ya tiene otra cuenta." : error.code?.startsWith("over_") ? "Demasiados intentos. Espera un momento." : "No se pudo cambiar el correo." };
  return { ok: true };
}

// true = no salir en «Quién levanta más» de tus grupos.
export async function getLiftPrivacy(): Promise<Result<boolean>> {
  const db = await session();
  if (!db) return { ok: false, error: "Sin sesión" };
  const { data, error } = await db.from("profiles").select("hide_lifts").maybeSingle();
  if (error) return { ok: false, error: error.code === "42703" ? NO_DB : "No se pudo cargar." };
  return { ok: true, data: !!data?.hide_lifts };
}

export async function saveLiftPrivacy(hide: unknown): Promise<Result<boolean>> {
  if (typeof hide !== "boolean") return { ok: false, error: "Valor no válido." };
  const db = await session();
  if (!db) return { ok: false, error: "Sesión caducada: vuelve a iniciar sesión." };
  const { error } = await db.rpc("set_lift_privacy", { p_hide: hide });
  if (error) return { ok: false, error: error.code === "PGRST202" ? NO_DB : "No se pudo guardar." };
  return { ok: true, data: hide };
}

// Borra la cuenta y todos sus datos (la base de datos los borra en cascada) y cierra la sesión.
export async function deleteAccount(): Promise<Result> {
  const db = await session();
  if (!db) return { ok: false, error: "Sesión caducada: vuelve a iniciar sesión." };
  const { error } = await db.rpc("delete_my_account");
  if (error) return { ok: false, error: error.code === "PGRST202" ? NO_DB : "No se pudo borrar la cuenta." };
  await db.auth.signOut();
  return { ok: true };
}
