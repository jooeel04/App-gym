import { DAYS } from "./snapshot";
import type { Tally } from "./types";
import type { WorkoutModel } from "./workout-model";

export function percent(n: number, p: number) {
  return p ? Math.min(100, Math.round((n / p) * 100)) : 0;
}

// Cálculos de solo lectura sobre el modelo: series anotadas y volumen levantado.
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

  // Volumen de un día de rutina en una semana: suma de kg × repeticiones de sus series.
  volume(w: number, d: number) {
    let total = 0;
    this.model.exercisesOfDay(d).forEach((x) => {
      for (let s = 1; s <= x.sets; s++) {
        const e = this.model.getEntry(w, d, x.id, s);
        const kg = Number(e.weight), reps = Number(e.reps);
        if (kg > 0 && reps > 0) total += kg * reps;
      }
    });
    return Math.round(total);
  }
}
