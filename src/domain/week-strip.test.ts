import { describe, expect, it } from "vitest";
import type { WorkoutRepository } from "@/repositories/workout-repository";
import { freshSnapshot } from "../../tests/workout-fixture";
import { BASE_ROUTINE } from "./base-routine";
import { WorkoutCalendar } from "./workout-calendar";
import { WorkoutDiary } from "./workout-diary";
import { WorkoutModel } from "./workout-model";
import { weekStrip } from "./week-strip";

const memory: WorkoutRepository = { load: async () => null, apply: async () => {}, flush: async () => {} };

// Spec hoy R33: la semana de lunes a domingo con lo hecho, lo que falta y el descanso. La
// cuenta empieza el lunes 26 oct 2026; Torso el lunes, Pierna el martes, Empujes el jueves.
describe("weekStrip · esta semana", () => {
  it("cada día dice qué se hizo, qué tocaba y si es hoy", () => {
    const snap = freshSnapshot();
    snap.schedule = { 1: [1], 2: [2], 3: [4], 4: [], 5: [] };
    const model = new WorkoutModel(memory, BASE_ROUTINE, snap);
    const calendar = new WorkoutCalendar(model);
    // Lunes: Torso hecho. Martes: Pierna no.
    model.setEntryField(1, 1, BASE_ROUTINE[0].id, 1, "reps", "8", "2026-10-26");
    const week = weekStrip("2026-10-28", calendar, new WorkoutDiary(model, calendar));
    expect(week.map((d) => d.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(week[0]).toMatchObject({ done: [1], planned: [1], today: false });
    expect(week[1]).toMatchObject({ done: [], planned: [2] });
    expect(week[2]).toMatchObject({ done: [], planned: [], today: true });
    expect(week[3]).toMatchObject({ done: [], planned: [3] });
  });
});
