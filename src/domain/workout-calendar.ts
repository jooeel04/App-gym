import { addDays, daysBetween, mondayOf, weekdayOf } from "./calendar";
import type { WorkoutModel } from "./workout-model";

// Un día de rutina de una semana del ciclo, con la vez que es en esa semana (un día puede
// ir en varios días de la semana: Torso el lunes es la 1.ª vez y el jueves la 2.ª) y la
// fecha en que está planificado.
export interface PlannedSession {
  week: number;
  day: number;
  round: number;
  date: string;
}

// Días que se ofrecen para recuperar.
export const MAKEUP_WINDOW_DAYS = 14;

// Relaciona el ciclo (semana 1…N, día de rutina y vez) con fechas reales a partir de la
// fecha de inicio y de los días de la semana asignados a cada día de rutina.
export class WorkoutCalendar {
  constructor(private readonly model: WorkoutModel) {}

  // Día de rutina con algún día de la semana asignado (si no, se entrena cuando se quiera).
  isScheduled(day: number) {
    return this.model.weekdaysFor(day).length > 0;
  }

  // Fecha planificada de la vez `round` del día en esa semana (null si no tiene).
  plannedDate(week: number, day: number, round = 1): string | null {
    const start = this.model.startDate;
    const weekday = this.model.weekdaysFor(day)[round - 1];
    if (!start || !weekday) return null;
    return addDays(start, (week - 1) * 7 + weekday - 1);
  }

  // Semana del ciclo en la que cae una fecha (puede quedar fuera de 1…N).
  cycleWeekOf(date: string): number | null {
    const start = this.model.startDate;
    if (!start) return null;
    return Math.floor(daysBetween(start, date) / 7) + 1;
  }

  // Días de rutina (con ejercicios) que tocan cada semana, con su vez y su día de la semana,
  // en orden de la semana.
  private slots() {
    return this.model.days
      .filter((d) => this.model.exercisesOfDay(d).length > 0)
      .flatMap((day) => this.model.weekdaysFor(day).map((weekday, i) => ({ day, round: i + 1, weekday })))
      .sort((a, b) => a.weekday - b.weekday || a.day - b.day);
  }

  // Días de rutina planificados para una fecha.
  sessionsOn(date: string): PlannedSession[] {
    const week = this.cycleWeekOf(date);
    if (week === null || week < 1 || week > this.model.weeksCount) return [];
    const weekday = weekdayOf(date);
    return this.slots().filter((s) => s.weekday === weekday).map(({ day, round }) => ({ week, day, round, date }));
  }

  // Fecha de inicio por defecto: la semana actual del calendario es la última
  // semana del ciclo con series anotadas (o la 1 si no hay ninguna).
  suggestStartDate(today: string) {
    let lastWeek = 1;
    for (let w = this.model.weeksCount; w > 1; w--) {
      if (this.model.days.some((d) => this.model.hasLoggedSets(w, d))) { lastWeek = w; break; }
    }
    return addDays(mondayOf(today), -(lastWeek - 1) * 7);
  }

  // Semana, día de rutina y vez que tocan en una fecha, ajustados al ciclo.
  // En días de descanso devuelve el más cercano de esa semana por delante.
  focusFor(date: string): { week: number; day: number; round: number } | null {
    const raw = this.cycleWeekOf(date);
    if (raw === null) return null;
    const week = Math.min(Math.max(raw, 1), this.model.weeksCount);
    const weekday = weekdayOf(date);
    const slots = this.slots();
    const next = slots.find((s) => s.weekday >= weekday) ?? slots[slots.length - 1];
    return next ? { week, day: next.day, round: next.round } : { week, day: this.model.days[0] ?? 1, round: 1 };
  }

  // La vez `round` del día en esa semana está hecha (completada o con series).
  isDone(week: number, day: number, round = 1) {
    return this.model.isDayCompleted(week, day, round) || this.model.hasLoggedSets(week, day, round);
  }

  // Rachas (spec hoy R30): semanas seguidas con tantos entrenos como veces pide el plan
  // (`slots`), sean del día de rutina que sean (también repeticiones). La semana en curso
  // suma si ya está completa; si no, no rompe la racha todavía.
  streak(today: string): { current: number; best: number; weekDone: number; weekTotal: number } {
    const total = this.slots().length;
    const doneIn = (w: number) => this.model.days
      .reduce((n, d) => n + Array.from({ length: this.model.lastRound(w, d) }, (_, i) => i + 1).filter((r) => this.isDone(w, d, r)).length, 0);
    const complete = (w: number) => total > 0 && doneIn(w) >= total;
    const now = Math.min(Math.max(this.cycleWeekOf(today) ?? 1, 1), this.model.weeksCount);
    let current = 0;
    for (let w = complete(now) ? now : now - 1; w >= 1 && complete(w); w--) current++;
    let best = 0, run = 0;
    for (let w = 1; w <= now; w++) {
      run = complete(w) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return { current, best, weekDone: Math.min(doneIn(now), total), weekTotal: total };
  }

  // Días planificados en las últimas dos semanas que no se hicieron.
  missedSessions(today: string, windowDays = MAKEUP_WINDOW_DAYS): PlannedSession[] {
    const missed: PlannedSession[] = [];
    for (let back = windowDays; back >= 1; back--) {
      this.sessionsOn(addDays(today, -back)).forEach((s) => {
        if (!this.isDone(s.week, s.day, s.round)) missed.push(s);
      });
    }
    return missed;
  }
}
