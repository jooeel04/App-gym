import { isValidSnapshot } from "@/domain/snapshot";
import type { WorkoutChange, WorkoutSnapshot } from "@/domain/types";
import type { WorkoutRepository } from "./workout-repository";

// Clave usada por la versión anterior de la app: así se conservan sus datos.
export const LOCAL_STORAGE_KEY = "torso-8-semanas-v1";

// Guarda el snapshot completo en localStorage del navegador.
export class LocalWorkoutRepository implements WorkoutRepository {
  constructor(private readonly storageKey = LOCAL_STORAGE_KEY) {}

  async load(): Promise<WorkoutSnapshot | null> {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? "null");
      return isValidSnapshot(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  async apply(_change: WorkoutChange, snapshot: WorkoutSnapshot): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
  }

  async flush(): Promise<void> {}
}
