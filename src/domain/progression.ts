import type { Exercise } from "./types";
import type { ExerciseSession } from "./workout-stats";

// 1RM estimado (fórmula de Epley): lo que se podría levantar a una repetición.
export function estimate1RM(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// Rango de repeticiones objetivo, p. ej. "8–12" → { min: 8, max: 12 }.
// Devuelve null si no es un rango de repeticiones ("Sin rango", "30–60 s"…).
export function parseRepRange(target: string): { min: number; max: number } | null {
  if (/\ds\b|seg|min/i.test(target)) return null;
  const range = target.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = target.match(/^\s*(\d+)\s*$/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : null;
}

// Cuánto subir la carga: pasos pequeños para pesos ligeros (mancuernas, poleas).
function increment(weight: number) {
  return weight < 20 ? 1 : 2.5;
}

export interface Suggestion {
  kind: "increase" | "reps" | "reach";
  weight: number;
  reps: number;
  text: string;
}

const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " kg";

// Doble progresión: si la última vez todas las series llegaron al máximo del rango,
// toca subir peso; si no, mantener el peso y buscar más repeticiones.
export function suggestNext(x: Exercise, last: ExerciseSession | null): Suggestion | null {
  const range = parseRepRange(x.target);
  if (!last || !range || last.topWeight === null) return null;
  const required = x.sets - (x.optionalLast ? 1 : 0);
  const work = last.sets.filter((s) => s.set <= required && s.weight === last.topWeight);
  if (!work.length) return null;
  const minReps = Math.min(...work.map((s) => s.reps ?? 0));
  const weight = last.topWeight;

  if (work.length >= required && minReps >= range.max) {
    const next = weight + increment(weight);
    return { kind: "increase", weight: next, reps: range.min, text: "Sube a " + kg(next) + " y haz " + range.min + "–" + range.max + " reps" };
  }
  if (minReps < range.min) {
    return { kind: "reach", weight, reps: range.min, text: "Mantén " + kg(weight) + " y llega a " + range.min + " reps en todas las series" };
  }
  return { kind: "reps", weight, reps: Math.min(minReps + 1, range.max), text: "Mantén " + kg(weight) + " e intenta " + Math.min(minReps + 1, range.max) + " reps (máx. " + range.max + ")" };
}
