import { applyWorkoutChanges, loadWorkout } from "@/app/actions/workout";
import { entryKey } from "@/domain/snapshot";
import type { WorkoutChange, WorkoutSnapshot } from "@/domain/types";
import type { WorkoutRepository } from "./workout-repository";

const ENTRY_DEBOUNCE_MS = 600;

type Batch = { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void };

// Repositorio del navegador: envía los cambios al servidor mediante Server Actions,
// que escriben en Supabase con la clave secreta.
// - Las series se agrupan durante ENTRY_DEBOUNCE_MS (una petición por pausa, no por tecla).
// - Cualquier otro cambio se envía enseguida junto con las series pendientes.
// - Los envíos se encadenan en una cola para respetar el orden.
export class ServerActionWorkoutRepository implements WorkoutRepository {
  private queue: Promise<void> = Promise.resolve();
  private pending = new Map<string, WorkoutChange>();
  private batch: Batch | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private snapshot: WorkoutSnapshot | null = null;

  load(): Promise<WorkoutSnapshot | null> {
    return loadWorkout();
  }

  apply(change: WorkoutChange, snapshot: WorkoutSnapshot): Promise<void> {
    const key = change.type === "entry" ? entryKey(change.week, change.day, change.exerciseId, change.set) : "op:" + this.pending.size;
    this.pending.set(key, change);
    if (change.type === "replaced") this.snapshot = snapshot;
    const promise = this.currentBatch().promise;

    clearTimeout(this.timer);
    if (change.type === "entry") this.timer = setTimeout(() => { this.flush().catch(() => {}); }, ENTRY_DEBOUNCE_MS);
    else this.flush().catch(() => {});
    return promise;
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    const batch = this.batch, changes = Array.from(this.pending.values()), snapshot = this.snapshot;
    this.batch = null;
    this.pending.clear();
    this.snapshot = null;
    if (!batch) return this.queue;

    this.queue = this.queue.catch(() => {}).then(() => applyWorkoutChanges(changes, snapshot));
    this.queue.then(batch.resolve, batch.reject);
    return this.queue;
  }

  private currentBatch(): Batch {
    if (!this.batch) {
      let resolve!: () => void, reject!: (e: unknown) => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      this.batch = { promise, resolve, reject };
    }
    return this.batch;
  }
}
