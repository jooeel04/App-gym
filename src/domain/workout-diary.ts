import { hasAny, isLogged, parseKey, roundOf } from "./snapshot";
import type { Exercise, SetEntry } from "./types";
import type { WorkoutCalendar } from "./workout-calendar";
import type { WorkoutModel } from "./workout-model";

export interface DiaryExercise {
  exercise: Exercise;
  sets: { set: number; entry: SetEntry }[];
}

export interface DiarySession {
  week: number;
  day: number;
  round: number; // vez del día en esa semana (1.ª, 2.ª…)
  // Fecha planificada; si es distinta del día real, la sesión se recuperó o se adelantó.
  plannedDate: string | null;
  exercises: DiaryExercise[];
}

// Un entreno del historial: la vez `round` del día de rutina `day` en la semana `week`.
export interface Workout {
  week: number;
  day: number;
  round: number;
  date: string; // fecha real más reciente de lo anotado
  exercises: DiaryExercise[];
  sets: number; // series de trabajo anotadas
  volume: number; // kg × repeticiones de esas series
}

export interface DiaryDay {
  date: string;
  sessions: DiarySession[];
}

// Registro diario: lo anotado agrupado por la fecha real en que se hizo.
export class WorkoutDiary {
  constructor(private readonly model: WorkoutModel, private readonly calendar: WorkoutCalendar) {}

  days(): DiaryDay[] {
    const byDate = new Map<string, Map<string, Map<number, DiaryExercise>>>();

    Object.entries(this.model.snapshot.entries).forEach(([k, entry]) => {
      if (!entry.date || !hasAny(entry)) return;
      const [week, day, id, set] = parseKey(k);
      const exercise = this.model.findExercise(id);
      if (!exercise) return;

      const sessions = byDate.get(entry.date) ?? new Map<string, Map<number, DiaryExercise>>();
      byDate.set(entry.date, sessions);
      const sessionKey = [week, day, roundOf(k, 4)].join("|");
      const exercises = sessions.get(sessionKey) ?? new Map<number, DiaryExercise>();
      sessions.set(sessionKey, exercises);
      const item = exercises.get(id) ?? { exercise, sets: [] };
      exercises.set(id, item);
      item.sets.push({ set, entry });
    });

    const order = new Map(this.model.routine.map((x, i) => [x.id, i]));
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, sessions]) => ({
        date,
        sessions: Array.from(sessions.entries())
          .map(([key, exercises]) => {
            const [week, day, round] = parseKey(key);
            return {
              week,
              day,
              round,
              plannedDate: this.calendar.plannedDate(week, day, round),
              exercises: Array.from(exercises.values())
                .sort((a, b) => (order.get(a.exercise.id) ?? 0) - (order.get(b.exercise.id) ?? 0))
                .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.set - b.set) })),
            };
          })
          .sort((a, b) => a.week - b.week || a.day - b.day || a.round - b.round),
      }));
  }

  // Historial: cada entreno (una vez de un día de rutina en una semana) con sus ejercicios
  // y series, del más reciente al más antiguo. La fecha es la más reciente de lo anotado.
  workouts(): Workout[] {
    const byKey = new Map<string, Workout>();
    const get = (week: number, day: number, round: number) => {
      const key = [week, day, round].join("|");
      const w = byKey.get(key) ?? { week, day, round, date: "", exercises: [], sets: 0, volume: 0 };
      byKey.set(key, w);
      return w;
    };
    const itemOf = (w: Workout, exercise: Exercise) => {
      let item = w.exercises.find((x) => x.exercise.id === exercise.id);
      if (!item) { item = { exercise, sets: [] }; w.exercises.push(item); }
      return item;
    };
    Object.entries(this.model.snapshot.entries).forEach(([k, entry]) => {
      if (!hasAny(entry)) return;
      const [week, day, id, set] = parseKey(k);
      const exercise = this.model.findExercise(id);
      if (!exercise) return;
      const w = get(week, day, roundOf(k, 4));
      itemOf(w, exercise).sets.push({ set, entry });
      if (entry.date && entry.date > w.date) w.date = entry.date;
      // Las series de trabajo (1–10) cuentan; el calentamiento no.
      if (set <= 10 && isLogged(entry)) {
        w.sets++;
        w.volume += (Number(entry.weight) || 0) * (Number(entry.reps) || 0);
      }
    });
    this.model.checkedDates().forEach(({ week, day, round, id, date }) => {
      const exercise = this.model.findExercise(id);
      if (!exercise) return;
      const w = get(week, day, round);
      itemOf(w, exercise);
      if (date > w.date) w.date = date;
    });
    const order = new Map(this.model.routine.map((x, i) => [x.id, i]));
    return Array.from(byKey.values())
      .filter((w) => w.date)
      .map((w) => ({
        ...w,
        volume: Math.round(w.volume),
        exercises: w.exercises
          .sort((a, b) => (order.get(a.exercise.id) ?? 0) - (order.get(b.exercise.id) ?? 0))
          .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.set - b.set) })),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.week - a.week || b.round - a.round));
  }

  // Días de rutina hechos en cada fecha real (series anotadas o ejercicios marcados con el tick).
  activity(): Map<string, Set<number>> {
    const byDate = new Map<string, Set<number>>();
    const add = (date: string, day: number) => {
      if (!date) return;
      const days = byDate.get(date) ?? new Set<number>();
      days.add(day);
      byDate.set(date, days);
    };
    Object.entries(this.model.snapshot.entries).forEach(([k, entry]) => {
      if (entry.date && isLogged(entry)) add(entry.date, parseKey(k)[1]);
    });
    this.model.checkedDates().forEach(({ day, date }) => add(date, day));
    return byDate;
  }
}
