import type { Exercise, SetEntry, WeekSchedule, WorkoutSnapshot } from "./types";

// Días de rutina con los que empieza toda cuenta (luego se pueden renombrar, borrar o
// añadir hasta MAX_DAYS). Cada día es un número del 1 al 7 con su color --dayN.
export const DEFAULT_DAY_NAMES: Readonly<Record<string, string>> = { 1: "Torso", 2: "Pierna", 3: "Empujes", 4: "Tirones", 5: "Hombros y brazos" };
export const DAY_NAMES = DEFAULT_DAY_NAMES;
export const MAX_DAYS = 7;
export const MAX_DAY_NAME = 30;
export const DAYS = [1, 2, 3, 4, 5] as const;

// Series de calentamiento: números de serie aparte (11-13) para que no cuenten en
// el progreso, los récords ni para completar el ejercicio.
export const WARMUP_SETS = [11, 12, 13];

export const SNAPSHOT_VERSION = 1;

// Por defecto: Día 1 el lunes … Día 5 el viernes (día de rutina → días de la semana).
export const DEFAULT_SCHEDULE: Readonly<WeekSchedule> = { 1: [1], 2: [2], 3: [3], 4: [4], 5: [5] };

// Calendario con el formato de ahora: cada día de rutina con su lista de días de la
// semana (1–7, sin repetir y en orden). Acepta el antiguo (un número; 0 = sin día fijo).
export function normalizeSchedule(raw: unknown): WeekSchedule {
  const out: WeekSchedule = {};
  if (!raw || typeof raw !== "object") return out;
  Object.entries(raw as Record<string, unknown>).forEach(([d, v]) => {
    const list = Array.isArray(v) ? v : [v];
    out[d] = [...new Set(list.filter((w): w is number => Number.isInteger(w) && (w as number) >= 1 && (w as number) <= 7))].sort((a, b) => a - b);
  });
  return out;
}
export const DEFAULT_WEEKS = 8;

export function blankSnapshot(routine: Exercise[]): WorkoutSnapshot {
  return { version: SNAPSHOT_VERSION, weeksCount: DEFAULT_WEEKS, entries: {}, completed: {}, routine };
}

export function isValidSnapshot(p: unknown): p is WorkoutSnapshot {
  const s = p as WorkoutSnapshot | null;
  return !!(s && s.version === SNAPSHOT_VERSION && s.entries && typeof s.entries === "object");
}

// La vez (2.ª, 3.ª… tanda del mismo día en una semana) va al final de la clave y solo si
// no es la 1.ª: así las claves guardadas antes de que existiera siguen valiendo.
export const MAX_ROUNDS = 20;
const withRound =(parts: number[], r: number) => (r > 1 ? [...parts, r] : parts).join("|");

export function entryKey(w: number, d: number, id: number, s: number, r = 1) {
  return withRound([w, d, id, s], r);
}

export function dayKey(w: number, d: number, r = 1) {
  return withRound([w, d], r);
}

export function exerciseKey(w: number, d: number, id: number, r = 1) {
  return withRound([w, d, id], r);
}

export function parseKey(k: string) {
  return k.split("|").map(Number);
}

// Vez de una clave que sin ella tiene `size` partes (4 en series, 3 en ticks, 2 en días).
export function roundOf(k: string, size: number) {
  return parseKey(k)[size] || 1;
}

export function isLogged(e: SetEntry | undefined) {
  return !!(e && (String(e.weight ?? "").trim() || String(e.reps ?? "").trim()));
}

export function hasAny(e: SetEntry | undefined) {
  return isLogged(e) || !!(e && String(e.note ?? "").trim());
}
