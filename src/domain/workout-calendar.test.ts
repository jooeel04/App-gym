import { describe, expect, it } from "vitest";
import type { WorkoutRepository } from "@/repositories/workout-repository";
import { freshSnapshot, PRESS } from "../../tests/workout-fixture";
import { BASE_ROUTINE } from "./base-routine";
import { WorkoutCalendar } from "./workout-calendar";
import { WorkoutModel } from "./workout-model";

const memory: WorkoutRepository = { load: async () => null, apply: async () => {}, flush: async () => {} };

// Spec rutina R5: un día de rutina en varios días de la semana. La cuenta empieza el lunes
// 26 oct 2026 (semana 1); Torso (día 1) va el lunes y el jueves.
describe("Un día de rutina en varios días de la semana", () => {
  const setup = () => {
    const snap = freshSnapshot();
    snap.schedule = { 1: [1, 4], 2: [2], 3: [3], 4: [5], 5: [] };
    const model = new WorkoutModel(memory, BASE_ROUTINE, snap);
    return { model, calendar: new WorkoutCalendar(model) };
  };

  it("el jueves toca Torso por 2.ª vez; el lunes, la 1.ª (R5)", () => {
    const { calendar } = setup();
    expect(calendar.sessionsOn("2026-10-26")).toEqual([{ week: 1, day: 1, round: 1, date: "2026-10-26" }]);
    expect(calendar.sessionsOn("2026-10-29")).toEqual([{ week: 1, day: 1, round: 2, date: "2026-10-29" }]);
    expect(calendar.plannedDate(1, 1, 2)).toBe("2026-10-29");
    expect(calendar.focusFor("2026-10-29")).toEqual({ week: 1, day: 1, round: 2 });
  });

  it("la 2.ª vez cuenta para el plan de la semana y, si falta, sale en pendientes (R5)", () => {
    const { model, calendar } = setup();
    // Los días con día fijo (Torso, Pierna, Empujes, Tirones): 4 de los 5 entrenos del plan.
    [1, 2, 3, 4].forEach((d) => model.exercisesOfDay(d).forEach((x) => model.toggleExerciseChecked(1, d, x.id, "2026-10-26")));
    [1, 2, 3, 4].forEach((d) => model.syncDayCompleted(1, d));
    expect(calendar.streak("2026-11-01").current).toBe(0);
    expect(calendar.missedSessions("2026-11-01")).toEqual([{ week: 1, day: 1, round: 2, date: "2026-10-29" }]);
    model.setEntryField(1, 1, PRESS.id, 1, "reps", "8", "2026-10-29", 2);
    expect(calendar.missedSessions("2026-11-01")).toEqual([]);
    BASE_ROUTINE.filter((x) => x.day === 1).forEach((x) => model.toggleExerciseChecked(1, 1, x.id, "2026-10-29", 2));
    model.syncDayCompleted(1, 1, 2);
    expect(calendar.streak("2026-11-01")).toMatchObject({ current: 1, weekDone: 5, weekTotal: 5 });
  });
});

// Spec hoy R30: la racha cuenta entrenos por semana (tantos como días tiene el plan), sean
// de la rutina que sean. La cuenta empieza el lunes 26 oct 2026 (semana 1).
describe("Racha de semanas: cuenta los entrenos, no qué día se hizo", () => {
  const setup = () => {
    const snap = freshSnapshot();
    // Lunes a viernes, un día de rutina cada uno.
    snap.schedule = { 1: [1], 2: [2], 3: [3], 4: [4], 5: [5] };
    const model = new WorkoutModel(memory, BASE_ROUTINE, snap);
    const doDay = (w: number, d: number, date: string, r = 1) => {
      model.exercisesOfDay(d).forEach((x) => model.toggleExerciseChecked(w, d, x.id, date, r));
      model.syncDayCompleted(w, d, r);
    };
    return { model, calendar: new WorkoutCalendar(model), doDay };
  };

  it("una semana con 5 entrenos cuenta aunque se repita un día y falte otro (R30)", () => {
    const { calendar, doDay } = setup();
    // Sin Pierna (día 2): Hombros (5) y Torso (1) por 2.ª vez.
    doDay(1, 1, "2026-10-26");
    doDay(1, 3, "2026-10-28");
    doDay(1, 4, "2026-10-29");
    doDay(1, 5, "2026-10-30");
    expect(calendar.streak("2026-10-30")).toMatchObject({ current: 0, weekDone: 4, weekTotal: 5 });
    doDay(1, 5, "2026-10-31", 2);
    expect(calendar.streak("2026-10-31")).toMatchObject({ current: 1, weekDone: 5, weekTotal: 5 });
    doDay(1, 1, "2026-11-01", 2);
    // «Llevas X de Y» no pasa de Y.
    expect(calendar.streak("2026-11-01")).toMatchObject({ current: 1, weekDone: 5 });
  });

  it("descansar al empezar la semana no rompe la racha hasta que la semana acaba (R30)", () => {
    const { calendar, doDay } = setup();
    [1, 2, 3, 4, 5].forEach((d, i) => doDay(1, d, "2026-10-2" + (6 + i)));
    // Semana 2: lunes y martes sin ir; el miércoles se recupera uno.
    doDay(2, 5, "2026-11-04");
    expect(calendar.streak("2026-11-04").current).toBe(1);
    expect(calendar.streak("2026-11-08").current).toBe(1);
    // Acabó la semana 2 con 1 de 5: el lunes siguiente la racha se pierde.
    expect(calendar.streak("2026-11-09").current).toBe(0);
  });
});
