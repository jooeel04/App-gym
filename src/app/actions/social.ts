"use server";

import { randomInt } from "node:crypto";
import { isISODate } from "@/domain/calendar";
import type { Exercise } from "@/domain/types";
import { isExercise } from "@/domain/validation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

// Compartir rutinas y grupos de amigos. Todo se hace con la sesión del usuario;
// las funciones de la base de datos solo dejan ver lo de los grupos a los que
// pertenece (nombres y días entrenados).

export interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface GroupInfo {
  code: string;
  name: string;
  members: number;
}

export interface LeaderRow {
  display_name: string;
  days: number;
  is_me: boolean;
}

// Sin 0/O ni 1/I/L para que el código se lea y se dicte sin errores.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const isCode = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9]{6}$/.test(v.trim());
const cleanName = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function session() {
  if (!(await getCurrentUser())) throw new Error("Sesión caducada: vuelve a iniciar sesión");
  return createSupabaseServerClient();
}

const fail = (error: string) => ({ ok: false, error });
const isDuplicate = (e: { code?: string } | null) => e?.code === "23505";

// ---- Rutinas compartidas ----

export async function shareRoutine(routine: unknown): Promise<Result<string>> {
  if (!Array.isArray(routine) || routine.length === 0 || routine.length > 200 || !routine.every(isExercise)) return fail("La rutina no es válida.");
  const db = await session();
  const clean = (routine as Exercise[]).map(({ day, name, sets, target, note, prescription, superset }) => ({ day, name, sets, target, note, prescription, superset: !!superset }));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error } = await db.from("shared_routines").insert({ code, routine: clean });
    if (!error) return { ok: true, data: code };
    if (!isDuplicate(error)) return fail("No se pudo compartir la rutina.");
  }
  return fail("No se pudo generar un código. Inténtalo de nuevo.");
}

export async function getSharedRoutine(code: unknown): Promise<Result<Omit<Exercise, "id" | "group" | "optionalLast">[]>> {
  if (!isCode(code)) return fail("El código tiene 6 letras o números.");
  const db = await session();
  const { data, error } = await db.rpc("get_shared_routine", { p_code: code.trim().toUpperCase() });
  if (error) return fail("No se pudo leer la rutina.");
  if (!Array.isArray(data)) return fail("No hay ninguna rutina con ese código.");
  return { ok: true, data };
}

// ---- Grupos y clasificación ----

export async function myGroups(): Promise<Result<GroupInfo[]>> {
  const db = await session();
  const { data, error } = await db.rpc("my_groups");
  return error ? fail("No se pudieron cargar tus grupos.") : { ok: true, data: data ?? [] };
}

export async function createGroup(name: unknown, displayName: unknown): Promise<Result<string>> {
  const groupName = cleanName(name, 40), display = cleanName(displayName, 30);
  if (!groupName || !display) return fail("Escribe el nombre del grupo y tu nombre.");
  const db = await session();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error } = await db.rpc("create_group", { p_code: code, p_name: groupName, p_display: display });
    if (!error) return { ok: true, data: code };
    if (!isDuplicate(error)) return fail("No se pudo crear el grupo.");
  }
  return fail("No se pudo generar un código. Inténtalo de nuevo.");
}

export async function joinGroup(code: unknown, displayName: unknown): Promise<Result<string>> {
  const display = cleanName(displayName, 30);
  if (!isCode(code)) return fail("El código tiene 6 letras o números.");
  if (!display) return fail("Escribe tu nombre para la clasificación.");
  const db = await session();
  const { data, error } = await db.rpc("join_group", { p_code: code.trim().toUpperCase(), p_display: display });
  if (error) return fail(error.code === "P0002" ? "No hay ningún grupo con ese código." : error.message === "Grupo lleno" ? "Ese grupo está lleno." : "No se pudo entrar en el grupo.");
  return { ok: true, data: data as string };
}

export async function leaveGroup(code: unknown): Promise<Result<null>> {
  if (!isCode(code)) return fail("Código no válido.");
  const db = await session();
  const { error } = await db.rpc("leave_group", { p_code: code.trim().toUpperCase() });
  return error ? fail("No se pudo salir del grupo.") : { ok: true, data: null };
}

// Mejor serie (más peso) de cada miembro del grupo en cada ejercicio: quién levanta más.
export interface LiftRecordRow {
  exercise: string;
  display_name: string;
  weight: number;
  reps: number | null;
  is_me: boolean;
}

export async function groupExerciseRecords(code: unknown): Promise<Result<LiftRecordRow[]>> {
  if (!isCode(code)) return fail("Código no válido.");
  const db = await session();
  const { data, error } = await db.rpc("group_exercise_records", { p_code: code.trim().toUpperCase() });
  if (error) return fail(error.code === "PGRST202" ? "Falta preparar la base de datos para comparar pesos." : "No se pudo cargar quién levanta más.");
  return { ok: true, data: ((data ?? []) as LiftRecordRow[]).map((r) => ({ ...r, weight: Number(r.weight) })) };
}

export async function groupLeaderboard(code: unknown, from: unknown, to: unknown): Promise<Result<LeaderRow[]>> {
  if (!isCode(code) || !isISODate(from) || !isISODate(to)) return fail("Datos no válidos.");
  const db = await session();
  const { data, error } = await db.rpc("group_leaderboard", { p_code: code.trim().toUpperCase(), p_from: from, p_to: to });
  return error ? fail("No se pudo cargar la clasificación.") : { ok: true, data: data ?? [] };
}
