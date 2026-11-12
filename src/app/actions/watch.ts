"use server";

import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import type { Result } from "./profile";

// Clave del atajo de iPhone (spec ajustes R9). Se guarda solo su SHA-256 en
// programs.watch_token_hash (RLS: cada uno el suyo); la clave se enseña una sola vez.

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

async function setHash(hash: string | null): Promise<Result<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("programs").update({ watch_token_hash: hash }).eq("user_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, error: "No se pudo guardar la clave." };
  return { ok: true, data: null };
}

// Crea una clave nueva (la anterior deja de valer) y la devuelve.
export async function createWatchToken(): Promise<Result<string>> {
  const token = randomBytes(32).toString("base64url");
  const res = await setHash(hashOf(token));
  return res.ok ? { ok: true, data: token } : { ok: false, error: res.error };
}

export async function deleteWatchToken(): Promise<Result<null>> {
  return setHash(null);
}

// Si hay una clave activa (sin enseñarla).
export async function watchTokenStatus(): Promise<Result<boolean>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("programs").select("watch_token_hash").maybeSingle();
  return error ? { ok: false, error: "No se pudo comprobar la clave." } : { ok: true, data: !!data?.watch_token_hash };
}
