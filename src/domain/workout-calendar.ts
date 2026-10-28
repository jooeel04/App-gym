import { addDays, daysBetween, mondayOf, weekdayOf } from "./calendar";
import { DAYS } from "./snapshot";
import type { WorkoutModel } from "./workout-model";

// Un día de rutina de una semana del ciclo, con la fecha en que está planificado.
export interface PlannedSession {
  week: number;
  day: number;
  date: string;
}

// Días que se ofrecen para recuperar.
export const MAKEUP_WINDOW_DAYS = 14;

// Relaciona el ciclo (semana 1…N, día 1…5) con fechas reales a partir de la
// fecha de inicio y del día de la semana asignado a cada día de rutina.
export class WorkoutCalendar {
  constructor(private readonly model: WorkoutModel) {}

  plannedDate(week: number, day: number): string | null {
    const start = this.model.startDate;
    if (!start) return null;
    return addDays(start, (week - 1) * 7 + this.model.weekdayFor(day) - 1);
  }

  // Semana del ciclo en la que cae una fecha (puede quedar fuera de 1…N).
  cycleWeekOf(date: string): number | null {
    const start = this.model.startDate;
    if (!start) return null;
    return Math.floor(daysBetween(start, date) / 7) + 1;
  }

  // Días de rutina planificados para una fecha.
  sessionsOn(date: string): PlannedSession[] {
    const week = this.cycleWeekOf(date);
    if (week === null || week < 1 || week > this.model.weeksCount) return [];
    const weekday = weekdayOf(date);
    return DAYS
      .filter((d) => this.model.weekdayFor(d) === weekday && this.model.exercisesOfDay(d).length > 0)
      .map((day) => ({ week, day, date }));
  }

  // Fecha de inicio por defecto: la semana actual del calendario es la última
  // semana del ciclo con series anotadas (o la 1 si no hay ninguna).
  suggestStartDate(today: string) {
    let lastWeek = 1;
    for (let w = this.model.weeksCount; w > 1; w--) {
      if (DAYS.some((d) => this.model.hasLoggedSets(w, d))) { lastWeek = w; break; }
    }
    return addDays(mondayOf(today), -(lastWeek - 1) * 7);
  }

  // Semana y día de rutina que tocan en una fecha, ajustados al ciclo.
  // En días de descanso devuelve el día de esa semana más cercano por delante.
  focusFor(date: string): { week: number; day: number } | null {
    const raw = this.cycleWeekOf(date);
    if (raw === null) return null;
    const week = Math.min(Math.max(raw, 1), this.model.weeksCount);
    const weekday = weekdayOf(date);
    const days = DAYS.filter((d) => this.model.exercisesOfDay(d).length > 0)
      .sort((a, b) => this.model.weekdayFor(a) - this.model.weekdayFor(b));
    const next = days.find((d) => this.model.weekdayFor(d) >= weekday) ?? days[days.length - 1] ?? 1;
    return { week, day: next };
  }

  isDone(week: number, day: number) {
    return this.model.isDayCompleted(week, day) || this.model.hasLoggedSets(week, day);
  }

  // Rachas: semanas seguidas con todos los días de rutina hechos. La semana en
  // curso suma si ya está completa; si no, no rompe la racha todavía.
  streak(today: string): { current: number; best: number; weekDone: number; weekTotal: number } {
    const days = DAYS.filter((d) => this.model.exercisesOfDay(d).length > 0);
    const complete = (w: number) => days.length > 0 && days.every((d) => this.isDone(w, d));
    const now = Math.min(Math.max(this.cycleWeekOf(today) ?? 1, 1), this.model.weeksCount);
    let current = 0;
    for (let w = complete(now) ? now : now - 1; w >= 1 && complete(w); w--) current++;
    let best = 0, run = 0;
    for (let w = 1; w <= now; w++) {
      run = complete(w) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return { current, best, weekDone: days.filter((d) => this.isDone(now, d)).length, weekTotal: days.length };
  }

  // Días planificados en las últimas dos semanas que no se hicieron.
  missedSessions(today: string, windowDays = MAKEUP_WINDOW_DAYS): PlannedSession[] {
    const missed: PlannedSession[] = [];
    for (let back = windowDays; back >= 1; back--) {
      this.sessionsOn(addDays(today, -back)).forEach((s) => {
        if (!this.isDone(s.week, s.day)) missed.push(s);
      });
    }
    return missed;
  }
}
