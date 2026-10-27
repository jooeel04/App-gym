import "server-only";
import { redirect } from "next/navigation";
import type { WorkoutSnapshot } from "@/domain/types";
import { SupabaseWorkoutRepository } from "@/repositories/supabase-workout-repository";
import { isSupabaseConfigured } from "./supabase/env";
import { createSupabaseServerClient, getCurrentUser } from "./supabase/server";

export type Account = { mode: "cloud"; email: string } | { mode: "local" };

export interface InitialWorkout {
  account: Account;
  snapshot: WorkoutSnapshot | null;
  programId: string | null;
}

// Capa de acceso a datos del servidor: valida la sesión y lee el programa del
// usuario con RLS. Sin Supabase configurado, la app arranca en modo local.
export async function loadInitialWorkout(): Promise<InitialWorkout> {
  if (!isSupabaseConfigured) return { account: { mode: "local" }, snapshot: null, programId: null };

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const repository = new SupabaseWorkoutRepository(await createSupabaseServerClient());
  const snapshot = await repository.load();
  return { account: { mode: "cloud", email: user.email }, snapshot, programId: repository.currentProgramId };
}
