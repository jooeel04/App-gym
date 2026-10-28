import { estimate1RM } from "./progression";
import { DAYS, isLogged } from "./snapshot";
import type { Exercise, Tally } from "./types";
import type { WorkoutModel } from "./workout-model";

export function percent(n: number, p: number) {
  return p ? Math.min(100, Math.round((n / p) * 100)) : 0;
}

// Una serie anotada con sus valores numéricos (null si no se escribió).
export interface SetResult {
  set: number;
  weight: number | null;
  reps: number | null;
}

// Lo que se hizo en un ejercicio en una semana del ciclo.
export interface ExerciseSession {
  week: number;
  date: string | null; // fecha real más reciente de sus series
  sets: SetResult[];
  topWeight: number | null; // carga máxima
  reps: number; // repeticiones totales
  volume: number; // kg × repeticiones
  e1rm: number; // mejor 1RM estimado de sus series
}

function toNumber(v: string | undefined) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Mejor marca de un ejercicio: la serie de más peso y la de mayor 1RM estimado.
export interface PersonalRecord {
  exercise: Exercise;
  heaviest: { weight: number; reps: number | null; week: number; date: string | null };
  best1RM: { value: number; weight: number; reps: number; week: number; date: string | null };
}

// Cálculos de solo lectura sobre el modelo: series anotadas, cargas y repeticiones.
export class WorkoutStats {
  constructor(private readonly model: WorkoutModel) {}

  day(w: number, d: number): Tally {
    let n = 0, p = 0;
    this.model.exercisesOfDay(d).forEach((x) => {
      p += x.sets;
      n += this.model.loggedSets(w, d, x);
    });
    return { n, p };
  }

  week(w: number): Tally {
    let n = 0, p = 0;
    DAYS.forEach((d) => { const t = this.day(w, d); n += t.n; p += t.p; });
    return { n, p };
  }

  all(): Tally {
    let n = 0, p = 0;
    for (let w = 1; w <= this.model.weeksCount; w++) { const t = this.week(w); n += t.n; p += t.p; }
    return { n, p };
  }

  // ---- Por ejercicio ----

  session(x: Exercise, w: number): ExerciseSession | null {
    const sets: SetResult[] = [];
    let date: string | null = null;
    for (let s = 1; s <= x.sets; s++) {
      const e = this.model.getEntry(w, x.day, x.id, s);
      if (!isLogged(e)) continue;
      sets.push({ set: s, weight: toNumber(e.weight), reps: toNumber(e.reps) });
      if (e.date && (!date || e.date > date)) date = e.date;
    }
    if (!sets.length) return null;
    const weights = sets.map((r) => r.weight).filter((v): v is number => v !== null);
    return {
      week: w,
      date,
      sets,
      topWeight: weights.length ? Math.max(...weights) : null,
      reps: sets.reduce((sum, r) => sum + (r.reps ?? 0), 0),
      volume: Math.round(sets.reduce((sum, r) => sum + (r.weight ?? 0) * (r.reps ?? 0), 0)),
      e1rm: Math.max(0, ...sets.map((r) => estimate1RM(r.weight ?? 0, r.reps ?? 0))),
    };
  }

  // Semanas en que se anotó el ejercicio, de la más antigua a la más reciente.
  exerciseHistory(x: Exercise): ExerciseSession[] {
    const history: ExerciseSession[] = [];
    for (let w = 1; w <= this.model.weeksCount; w++) {
      const s = this.session(x, w);
      if (s) history.push(s);
    }
    return history;
  }

  // Récord del ejercicio (null si no hay series con carga). `skip` excluye una serie
  // concreta ("semana|serie"), para comparar una serie recién anotada con lo anterior.
  record(x: Exercise, skip?: string): PersonalRecord | null {
    let heaviest: PersonalRecord["heaviest"] | null = null, best: PersonalRecord["best1RM"] | null = null;
    for (let w = 1; w <= this.model.weeksCount; w++) {
      for (let s = 1; s <= x.sets; s++) {
        if (skip === w + "|" + s) continue;
        const e = this.model.getEntry(w, x.day, x.id, s);
        const weight = Number(e.weight), reps = Number(e.reps);
        if (!(weight > 0)) continue;
        if (!heaviest || weight > heaviest.weight) heaviest = { weight, reps: reps > 0 ? reps : null, week: w, date: e.date ?? null };
        const value = estimate1RM(weight, reps);
        if (reps > 0 && (!best || value > best.value)) best = { value, weight, reps, week: w, date: e.date ?? null };
      }
    }
    return heaviest && best ? { exercise: x, heaviest, best1RM: best } : null;
  }

  records(): PersonalRecord[] {
    return this.model.routine.map((x) => this.record(x)).filter((r): r is PersonalRecord => r !== null);
  }

  // La última vez que se hizo el ejercicio antes de la semana `w`.
  lastBefore(x: Exercise, w: number): ExerciseSession | null {
    for (let prev = w - 1; prev >= 1; prev--) {
      const s = this.session(x, prev);
      if (s) return s;
    }
    return null;
  }
}
