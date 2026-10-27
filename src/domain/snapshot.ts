import type { Exercise, SetEntry, WorkoutSnapshot } from "./types";

export const DAY_NAMES: Record<number, string> = { 1: "Torso", 2: "Pierna", 3: "Empujes", 4: "Tirones", 5: "Hombros y brazos" };
export const DAYS = [1, 2, 3, 4, 5] as const;

export const SNAPSHOT_VERSION = 1;
export const DEFAULT_WEEKS = 8;

export function blankSnapshot(routine: Exercise[]): WorkoutSnapshot {
  return { version: SNAPSHOT_VERSION, weeksCount: DEFAULT_WEEKS, entries: {}, completed: {}, routine };
}

export function isValidSnapshot(p: unknown): p is WorkoutSnapshot {
  const s = p as WorkoutSnapshot | null;
  return !!(s && s.version === SNAPSHOT_VERSION && s.entries && typeof s.entries === "object");
}

export function entryKey(w: number, d: number, id: number, s: number) {
  return [w, d, id, s].join("|");
}

export function dayKey(w: number, d: number) {
  return w + "|" + d;
}

export function parseKey(k: string) {
  return k.split("|").map(Number);
}

export function isLogged(e: SetEntry | undefined) {
  return !!(e && (String(e.weight ?? "").trim() || String(e.reps ?? "").trim()));
}

export function hasAny(e: SetEntry | undefined) {
  return isLogged(e) || !!(e && String(e.note ?? "").trim());
}
