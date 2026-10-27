import { DAYS } from "./snapshot";
import type { Exercise, Tally } from "./types";
import type { WorkoutModel } from "./workout-model";

export interface LoadHistoryItem {
  exercise: Exercise;
  first: number;
  last: number;
  delta: number;
}

export function percent(n: number, p: number) {
  return p ? Math.min(100, Math.round((n / p) * 100)) : 0;
}

// Cálculos de solo lectura sobre el modelo: series anotadas e historial de cargas.
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

  // Primera y última carga registrada de cada ejercicio con datos.
  loadHistory(): LoadHistoryItem[] {
    const m = this.model, history: LoadHistoryItem[] = [];
    m.routine.forEach((x) => {
      let first: number | null = null, last: number | null = null;
      for (let w = 1; w <= m.weeksCount; w++) {
        for (let s = 1; s <= x.sets; s++) {
          const e = m.getEntry(w, x.day, x.id, s);
          if (String(e.weight ?? "").trim()) {
            const weight = Number(e.weight);
            if (first === null) first = weight;
            last = weight;
          }
        }
      }
      if (first !== null && last !== null) history.push({ exercise: x, first, last, delta: last - first });
    });
    return history;
  }
}
