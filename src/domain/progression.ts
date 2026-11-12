import { nextLoad } from "./equipment";
import type { Exercise } from "./types";
import type { ExerciseSession, SetResult } from "./workout-stats";

// Rango de repeticiones objetivo, p. ej. "8–12" → { min: 8, max: 12 }.
// Devuelve null si no es un rango de repeticiones ("Sin rango", "30–60 s"…).
export function parseRepRange(target: string): { min: number; max: number } | null {
  if (/\ds\b|seg|min/i.test(target)) return null;
  const range = target.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = target.match(/^\s*(\d+)\s*$/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : null;
}

export interface Suggestion {
  kind: "increase" | "reps" | "reach";
  weight: number;
  reps: number;
  text: string;
}

const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " kg";

// Doble progresión: si la última vez todas las series llegaron al máximo del rango,
// toca subir peso (al siguiente que existe con su material, ver `nextLoad`); si no,
// mantener el peso y buscar más repeticiones. `smallestPlate`: el disco más pequeño del gym.
export function suggestNext(x: Exercise, last: ExerciseSession | null, smallestPlate?: number): Suggestion | null {
  const range = parseRepRange(x.target);
  if (!last || !range || last.topWeight === null) return null;
  const required = x.sets - (x.optionalLast ? 1 : 0);
  const work = last.sets.filter((s) => s.set <= required && s.weight === last.topWeight);
  if (!work.length) return null;
  const minReps = Math.min(...work.map((s) => s.reps ?? 0));
  const weight = last.topWeight;

  const next = nextLoad(x.name, weight, 1, smallestPlate);
  if (work.length >= required && minReps >= range.max && next > weight) {
    return { kind: "increase", weight: next, reps: range.min, text: "Sube a " + kg(next) + " y haz " + range.min + "–" + range.max + " reps" };
  }
  if (minReps < range.min) {
    return { kind: "reach", weight, reps: range.min, text: "Mantén " + kg(weight) + " y llega a " + range.min + " reps en todas las series" };
  }
  return { kind: "reps", weight, reps: Math.min(minReps + 1, range.max), text: "Mantén " + kg(weight) + " e intenta " + Math.min(minReps + 1, range.max) + " reps (máx. " + range.max + ")" };
}

export interface TrendPoint {
  week: number;
  round: number;
  date: string | null;
  value: number; // peso máximo en kg o repeticiones
  best: SetResult; // la serie que da ese valor
  sets: SetResult[]; // todas las series de ese día
}

// Evolución de un ejercicio para Progreso: con carga, el peso máximo de cada vez; sin
// carga (peso corporal), las repeticiones de la mejor serie. `change` compara la
// última sesión con la anterior (null si solo hay una).
export interface ProgressTrend {
  kind: "weight" | "reps";
  points: TrendPoint[];
  last: TrendPoint;
  change: number | null;
}

const bestBy = (sets: SetResult[], score: (r: SetResult) => number) => sets.reduce((a, b) => (score(b) > score(a) ? b : a));

export function progressTrend(history: ExerciseSession[]): ProgressTrend | null {
  const weighted = history.some((s) => (s.topWeight ?? 0) > 0);
  const points: TrendPoint[] = weighted
    ? history.filter((s) => (s.topWeight ?? 0) > 0).map((s) => ({
        week: s.week, round: s.round, date: s.date, value: s.topWeight!, sets: s.sets,
        // A igual peso, la de más repeticiones.
        best: bestBy(s.sets, (r) => (r.weight ?? 0) * 1000 + (r.reps ?? 0)),
      }))
    : history.filter((s) => s.sets.some((r) => (r.reps ?? 0) > 0)).map((s) => {
        const best = bestBy(s.sets, (r) => r.reps ?? 0);
        return { week: s.week, round: s.round, date: s.date, value: best.reps ?? 0, best, sets: s.sets };
      });
  if (!points.length) return null;
  const last = points[points.length - 1], prev = points[points.length - 2];
  return { kind: weighted ? "weight" : "reps", points, last, change: prev ? Math.round((last.value - prev.value) * 100) / 100 : null };
}
