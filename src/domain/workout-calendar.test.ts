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

  it("la semana solo está completa con las dos veces, y la que falta sale en pendientes (R5)", () => {
    const { model, calendar } = setup();
    [1, 2, 3, 4, 5].forEach((d) => model.exercisesOfDay(d).forEach((x) => model.toggleExerciseChecked(1, d, x.id, "2026-10-26")));
    [1, 2, 3, 4, 5].forEach((d) => model.syncDayCompleted(1, d));
    expect(calendar.streak("2026-11-01").current).toBe(0);
    expect(calendar.missedSessions("2026-11-01")).toEqual([{ week: 1, day: 1, round: 2, date: "2026-10-29" }]);
    model.setEntryField(1, 1, PRESS.id, 1, "reps", "8", "2026-10-29", 2);
    expect(calendar.missedSessions("2026-11-01")).toEqual([]);
    BASE_ROUTINE.filter((x) => x.day === 1).forEach((x) => model.toggleExerciseChecked(1, 1, x.id, "2026-10-29", 2));
    model.syncDayCompleted(1, 1, 2);
    expect(calendar.streak("2026-11-01")).toMatchObject({ current: 1, weekDone: 5, weekTotal: 5 });
  });
});
