import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { WorkoutSnapshot } from "@/domain/types";
import { SupabaseWorkoutRepository } from "@/repositories/supabase-workout-repository";
import { isSupabaseConfigured } from "./supabase/env";
import { createSupabaseServerClient, getCurrentUser, type CurrentUser } from "./supabase/server";

// "cloud": datos en la cuenta del usuario en Supabase. "local": datos en el navegador.
export type StorageMode = "cloud" | "local";

export interface InitialWorkout {
  mode: StorageMode;
  snapshot: WorkoutSnapshot | null;
  // Correo de la cuenta con la sesión iniciada (null en modo local).
  email: string | null;
}

// Repositorio del usuario con la sesión iniciada, o null si no hay sesión.
export async function getUserRepository(): Promise<{ user: CurrentUser; repository: SupabaseWorkoutRepository } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, repository: new SupabaseWorkoutRepository(await createSupabaseServerClient(), user.id) };
}

// Lectura inicial en el servidor. Sin Supabase configurado, la app arranca en modo local.
export async function loadInitialWorkout(): Promise<InitialWorkout> {
  // Los datos cambian en cada visita: no se generan en el build.
  await connection();
  if (!isSupabaseConfigured) return { mode: "local", snapshot: null, email: null };

  const session = await getUserRepository();
  if (!session) redirect("/login");
  const snapshot = await session.repository.load();
  return { mode: "cloud", snapshot, email: session.user.email };
}
