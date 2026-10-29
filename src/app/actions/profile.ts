"use server";

import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

// Apodo de la persona con sesión (tabla profiles, RLS: cada uno solo el suyo).

export interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function getNickname(): Promise<Result<string | null>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("profiles").select("nickname").maybeSingle();
  return error ? { ok: false, error: "No se pudo cargar tu nombre." } : { ok: true, data: data?.nickname ?? null };
}

// Lo guarda y lo usa como nombre en todos sus grupos de amigos.
export async function saveNickname(name: unknown): Promise<Result<null>> {
  const nickname = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (nickname.length < 1 || nickname.length > 30) return { ok: false, error: "Escribe un nombre de 1 a 30 letras." };
  if (!(await getCurrentUser())) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("set_nickname", { p_nickname: nickname });
  return error ? { ok: false, error: "No se pudo guardar tu nombre." } : { ok: true, data: null };
}
