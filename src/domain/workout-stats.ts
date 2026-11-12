import { isLogged } from "./snapshot";
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

// Lo que se hizo en un ejercicio en una vez de un día de una semana del ciclo.
export interface ExerciseSession {
  week: number;
  round: number; // vez del día en esa semana (1, 2…)
  date: string | null; // fecha real más reciente de sus series
  sets: SetResult[];
  topWeight: number | null; // carga máxima
  reps: number; // repeticiones totales
  volume: number; // kg × repeticiones
}

function toNumber(v: string | undefined) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Mejor marca de un ejercicio: el día de más peso, con sus series.
export interface PersonalRecord {
  exercise: Exercise;
  heaviest: { weight: number; reps: number | null; week: number; date: string | null };
  sets: SetResult[]; // todas las series de trabajo de ese día
  totalReps: number;
}

// Cálculos de solo lectura sobre el modelo: series anotadas, cargas y repeticiones.
export class WorkoutStats {
  constructor(private readonly model: WorkoutModel) {}

  day(w: number, d: number, r = 1): Tally {
    let n = 0, p = 0;
    this.model.exercisesOfDay(d).forEach((x) => {
      p += x.sets;
      n += this.model.loggedSets(w, d, x, r);
    });
    return { n, p };
  }

  week(w: number): Tally {
    let n = 0, p = 0;
    this.model.days.forEach((d) => { const t = this.day(w, d); n += t.n; p += t.p; });
    return { n, p };
  }

  all(): Tally {
    let n = 0, p = 0;
    for (let w = 1; w <= this.model.weeksCount; w++) { const t = this.week(w); n += t.n; p += t.p; }
    return { n, p };
  }

  // ---- Por ejercicio ----

  // Lo anotado en un ejercicio en la vez `r` del día en la semana `w`.
  session(x: Exercise, w: number, r = 1): ExerciseSession | null {
    const sets: SetResult[] = [];
    let date: string | null = null;
    for (let s = 1; s <= x.sets; s++) {
      const e = this.model.getEntry(w, x.day, x.id, s, r);
      if (!isLogged(e)) continue;
      sets.push({ set: s, weight: toNumber(e.weight), reps: toNumber(e.reps) });
      if (e.date && (!date || e.date > date)) date = e.date;
    }
    if (!sets.length) return null;
    const weights = sets.map((v) => v.weight).filter((v): v is number => v !== null);
    return {
      week: w,
      round: r,
      date,
      sets,
      topWeight: weights.length ? Math.max(...weights) : null,
      reps: sets.reduce((sum, v) => sum + (v.reps ?? 0), 0),
      volume: Math.round(sets.reduce((sum, v) => sum + (v.weight ?? 0) * (v.reps ?? 0), 0)),
    };
  }

  // Cada vez que se anotó el ejercicio (semana y vez), de la más antigua a la más reciente.
  exerciseHistory(x: Exercise): ExerciseSession[] {
    const history: ExerciseSession[] = [];
    for (let w = 1; w <= this.model.weeksCount; w++) {
      const last = this.model.lastRound(w, x.day);
      for (let r = 1; r <= last; r++) {
        const s = this.session(x, w, r);
        if (s) history.push(s);
      }
    }
    return history;
  }

  // Récord del ejercicio: el día (sesión) en que se levantó más peso, con todas sus
  // series; a igual peso, el de más repeticiones en total. null si no hay series con
  // carga. `skip` excluye una serie concreta ("semana|vez|serie"), para comparar una serie
  // recién anotada con lo anterior.
  record(x: Exercise, skip?: string): PersonalRecord | null {
    let best: PersonalRecord | null = null;
    for (const session of this.exerciseHistory(x)) {
      const sets = session.sets.filter((v) => skip !== [session.week, session.round, v.set].join("|"));
      const weight = Math.max(0, ...sets.map((v) => v.weight ?? 0));
      if (!(weight > 0)) continue;
      const totalReps = sets.reduce((sum, v) => sum + (v.reps ?? 0), 0);
      if (best && (weight < best.heaviest.weight || (weight === best.heaviest.weight && totalReps <= best.totalReps))) continue;
      const reps = Math.max(0, ...sets.filter((v) => v.weight === weight).map((v) => v.reps ?? 0)) || null;
      best = { exercise: x, heaviest: { weight, reps, week: session.week, date: session.date }, sets, totalReps };
    }
    return best;
  }

  records(): PersonalRecord[] {
    return this.model.routine.map((x) => this.record(x)).filter((r): r is PersonalRecord => r !== null);
  }

  // La última vez que se hizo el ejercicio antes de la vez `r` de la semana `w` (la
  // anterior de esa misma semana, si se repitió el día).
  lastBefore(x: Exercise, w: number, r = 1): ExerciseSession | null {
    const before = this.exerciseHistory(x).filter((s) => s.week < w || (s.week === w && s.round < r));
    return before[before.length - 1] ?? null;
  }
}
