import { addDays, mondayOf } from "./calendar";
import type { WorkoutCalendar } from "./workout-calendar";
import type { WorkoutDiary } from "./workout-diary";

export interface StripDay {
  date: string;
  done: number[]; // días de rutina hechos esa fecha
  planned: number[]; // días de rutina que tocaban esa fecha
  today: boolean;
}

// La semana de hoy, de lunes a domingo (spec hoy R33): lo que se hizo y lo que tocaba cada día.
export function weekStrip(today: string, calendar: WorkoutCalendar, diary: WorkoutDiary): StripDay[] {
  const monday = mondayOf(today);
  const activity = diary.activity();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return {
      date,
      done: Array.from(activity.get(date) ?? []).sort((a, b) => a - b),
      planned: calendar.sessionsOn(date).map((s) => s.day),
      today: date === today,
    };
  });
}
