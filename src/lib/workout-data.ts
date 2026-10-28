import "server-only";
import { connection } from "next/server";
import type { WorkoutSnapshot } from "@/domain/types";
import { SupabaseWorkoutRepository } from "@/repositories/supabase-workout-repository";
import { createSupabaseAdminClient, isSupabaseConfigured } from "./supabase/admin";

// "cloud": datos en Supabase a través del servidor. "local": datos en el navegador.
export type StorageMode = "cloud" | "local";

export interface InitialWorkout {
  mode: StorageMode;
  snapshot: WorkoutSnapshot | null;
}

// Lectura inicial en el servidor. Sin Supabase configurado, la app arranca en modo local.
export async function loadInitialWorkout(): Promise<InitialWorkout> {
  // Los datos cambian en cada visita: no se generan en el build.
  await connection();
  if (!isSupabaseConfigured) return { mode: "local", snapshot: null };

  const snapshot = await new SupabaseWorkoutRepository(createSupabaseAdminClient()).load();
  return { mode: "cloud", snapshot };
}
