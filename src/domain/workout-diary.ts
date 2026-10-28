import { hasAny, isLogged, parseKey } from "./snapshot";
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
  // Fecha planificada; si es distinta del día real, la sesión se recuperó o se adelantó.
  plannedDate: string | null;
  exercises: DiaryExercise[];
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
      const sessionKey = week + "|" + day;
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
            const [week, day] = parseKey(key);
            return {
              week,
              day,
              plannedDate: this.calendar.plannedDate(week, day),
              exercises: Array.from(exercises.values())
                .sort((a, b) => (order.get(a.exercise.id) ?? 0) - (order.get(b.exercise.id) ?? 0))
                .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.set - b.set) })),
            };
          })
          .sort((a, b) => a.week - b.week || a.day - b.day),
      }));
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
