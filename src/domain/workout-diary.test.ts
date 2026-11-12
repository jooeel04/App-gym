import { describe, expect, it } from "vitest";
import type { WorkoutRepository } from "@/repositories/workout-repository";
import { DOMINADAS, historySnapshot, PRESS } from "../../tests/workout-fixture";
import { BASE_ROUTINE } from "./base-routine";
import { WorkoutCalendar } from "./workout-calendar";
import { WorkoutDiary } from "./workout-diary";
import { WorkoutModel } from "./workout-model";

const memory: WorkoutRepository = { load: async () => null, apply: async () => {}, flush: async () => {} };

function setup() {
  const model = new WorkoutModel(memory, BASE_ROUTINE, historySnapshot());
  return { model, diary: new WorkoutDiary(model, new WorkoutCalendar(model)) };
}

// Spec progreso R10: cada entreno con sus series y kilos (lo que enseña el calendario al tocar un día).
describe("Historial de entrenos", () => {
  it("junta cada entreno con su fecha, series y kilos, del más reciente al más antiguo (R10)", () => {
    const { model, diary } = setup();
    model.setEntryField(3, 1, PRESS.id, 1, "reps", "6", "2026-10-22", 2);
    const list = diary.workouts();
    expect(list.map((w) => [w.week, w.day, w.round, w.date])).toEqual([
      [3, 1, 2, "2026-10-22"], [3, 1, 1, "2026-10-19"], [2, 1, 1, "2026-10-12"], [1, 1, 1, "2026-10-05"],
    ]);
    const week3 = list[1];
    // Press 55×8 ×3, remo 60×10 ×3 y dominadas 6 y 5 (sin carga).
    expect(week3.sets).toBe(8);
    expect(week3.volume).toBe(55 * 8 * 3 + 60 * 10 * 3);
    expect(week3.exercises.map((x) => x.exercise.id)).toEqual(expect.arrayContaining([PRESS.id, DOMINADAS.id]));
  });
});
