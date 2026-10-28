import { applyWorkoutChanges, loadWorkout } from "@/app/actions/workout";
import { entryKey, exerciseKey, isValidSnapshot } from "@/domain/snapshot";
import type { WorkoutChange, WorkoutSnapshot } from "@/domain/types";
import type { WorkoutRepository } from "./workout-repository";

const ENTRY_DEBOUNCE_MS = 600;
const RETRY_MS = 30_000;
// Con más cambios pendientes se envía el estado completo de una vez.
const MAX_BATCH = 400;
// Reintentos ante errores del servidor (no de red) antes de descartar los cambios.
const MAX_SERVER_ATTEMPTS = 3;

type Item = { key: string; change: WorkoutChange };

export interface SyncStatus {
  offline: boolean;
  pending: number;
}

const hasStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

function readJSON<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento lleno o bloqueado: se sigue funcionando en memoria.
  }
}

// Sin conexión, la Server Action no llega al servidor y fetch falla con TypeError.
function isNetworkError(e: unknown) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || e instanceof TypeError;
}

// Repositorio del navegador con prioridad local (funciona sin internet):
// - Cada cambio se guarda al momento en este dispositivo (copia del estado y una
//   cola de cambios pendientes, por cuenta) y después se envía al servidor
//   mediante Server Actions.
// - Sin conexión la cola se conserva y se reenvía al volver la red (evento
//   "online" y reintentos periódicos).
// - Las series se agrupan durante ENTRY_DEBOUNCE_MS (una petición por pausa, no por tecla).
export class ServerActionWorkoutRepository implements WorkoutRepository {
  private items: Item[];
  private sending: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;
  private status: SyncStatus;
  private listeners = new Set<() => void>();
  private onError: (e: unknown) => void = () => {};

  private readonly snapshotKey: string;
  private readonly outboxKey: string;

  constructor(account: string) {
    const id = account.toLowerCase();
    this.snapshotKey = "rutina:" + id + ":snapshot";
    this.outboxKey = "rutina:" + id + ":outbox";
    this.items = readJSON<Item[]>(this.outboxKey) ?? [];
    this.status = { offline: false, pending: this.items.length };
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => { this.setStatus(false); this.flush().catch(() => {}); });
      window.addEventListener("offline", () => this.setStatus(true));
    }
  }

  // ---- Estado de sincronización (para la interfaz) ----

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getStatus = () => this.status;

  setErrorHandler(handler: (e: unknown) => void) {
    this.onError = handler;
  }

  private setStatus(offline: boolean) {
    if (offline === this.status.offline && this.items.length === this.status.pending) return;
    this.status = { offline, pending: this.items.length };
    this.listeners.forEach((l) => l());
  }

  // ---- Copia local ----

  // Último estado guardado en este dispositivo para esta cuenta.
  localSnapshot(): WorkoutSnapshot | null {
    const s = readJSON<unknown>(this.snapshotKey);
    return isValidSnapshot(s) ? s : null;
  }

  hasPending() {
    return this.items.length > 0;
  }

  saveSnapshot(snapshot: WorkoutSnapshot) {
    writeJSON(this.snapshotKey, snapshot);
  }

  // Al cerrar sesión: no deja datos de esta cuenta en el dispositivo.
  clearLocal() {
    if (!hasStorage()) return;
    localStorage.removeItem(this.snapshotKey);
    localStorage.removeItem(this.outboxKey);
  }

  // ---- WorkoutRepository ----

  load(): Promise<WorkoutSnapshot | null> {
    return loadWorkout();
  }

  // Se resuelve en cuanto el cambio queda guardado en el dispositivo; los errores
  // del servidor se avisan con setErrorHandler.
  apply(change: WorkoutChange, snapshot: WorkoutSnapshot): Promise<void> {
    this.saveSnapshot(snapshot);
    const key = change.type === "entry" ? "entry:" + entryKey(change.week, change.day, change.exerciseId, change.set)
      : change.type === "exerciseChecked" ? "check:" + exerciseKey(change.week, change.day, change.exerciseId)
      : "op:" + Date.now() + ":" + this.seq++;
    this.items = [...this.items.filter((i) => i.key !== key), { key, change }];
    writeJSON(this.outboxKey, this.items);
    this.setStatus(this.status.offline);

    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, change.type === "entry" ? ENTRY_DEBOUNCE_MS : 0);
    return Promise.resolve();
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.sending) this.sending = this.send().finally(() => { this.sending = null; });
    return this.sending;
  }

  private async send() {
    let attempts = 0;
    while (this.items.length) {
      const batch = this.items;
      const snapshot = this.localSnapshot();
      // Una restauración o una cola muy larga se envían como el estado completo,
      // que ya incluye todos los cambios.
      const whole = !!snapshot && (batch.length > MAX_BATCH || batch.some((i) => i.change.type === "replaced"));
      try {
        await applyWorkoutChanges(whole ? [{ type: "replaced" }] : batch.map((i) => i.change), whole ? snapshot : null);
        this.setStatus(false);
      } catch (e) {
        if (isNetworkError(e)) {
          this.setStatus(true);
          clearTimeout(this.retryTimer);
          this.retryTimer = setTimeout(() => { this.flush().catch(() => {}); }, RETRY_MS);
          return;
        }
        if (++attempts < MAX_SERVER_ATTEMPTS) continue;
        this.onError(e);
      }
      attempts = 0;
      const sent = new Set(batch);
      this.items = this.items.filter((i) => !sent.has(i));
      writeJSON(this.outboxKey, this.items);
      this.setStatus(this.status.offline);
    }
  }
}
