import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec datos R2: la Server Action acepta la vez (`round`) de 1 a 20 y rechaza lo demás.
const repository = { apply: vi.fn(async () => {}), flush: vi.fn(async () => {}) };
vi.mock("@/lib/workout-data", () => ({ getUserRepository: async () => ({ repository }) }));

const { applyWorkoutChanges } = await import("./workout");

const entry = (round?: unknown) => ({ type: "entry", week: 3, day: 1, round, exerciseId: 0, set: 1, entry: { weight: "50", reps: "8", date: "2026-10-21" } });

describe("Guardar series de una tanda repetida", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta la 2.ª vez y los cambios sin vez (la 1.ª)", async () => {
    await applyWorkoutChanges([entry(2), entry(), { type: "completed", week: 3, day: 1, round: 2, done: true }], null);
    expect(repository.apply).toHaveBeenCalledTimes(3);
  });

  it("rechaza una vez fuera de 1–20", async () => {
    await expect(applyWorkoutChanges([entry(0)], null)).rejects.toThrow("Cambios no válidos");
    await expect(applyWorkoutChanges([entry(21)], null)).rejects.toThrow("Cambios no válidos");
    await expect(applyWorkoutChanges([{ type: "exerciseChecked", week: 3, day: 1, round: 1.5, exerciseId: 0, date: null }], null)).rejects.toThrow("Cambios no válidos");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});

// Spec datos R3: días de rutina propios (1–7) y calendario con varios días de la semana.
describe("Guardar días de rutina propios y el calendario nuevo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta el día 7, nombres, listas de días de la semana y el formato antiguo", async () => {
    await applyWorkoutChanges([
      { type: "entry", week: 1, day: 7, exerciseId: 0, set: 1, entry: null },
      { type: "dayNames", dayNames: { 1: "Torso", 7: "Cardio" } },
      { type: "dayRemoved", day: 2, dayNames: { 1: "Torso" }, schedule: { 1: [1, 4] } },
      { type: "schedule", schedule: { 1: [1, 4], 7: [] }, startDate: null },
      { type: "schedule", schedule: { 1: 1, 2: 0 }, startDate: null },
    ], null);
    expect(repository.apply).toHaveBeenCalledTimes(5);
  });

  it("rechaza días fuera de 1–7, nombres vacíos o largos y días de la semana raros", async () => {
    for (const bad of [
      { type: "entry", week: 1, day: 8, exerciseId: 0, set: 1, entry: null },
      { type: "dayNames", dayNames: { 1: "" } },
      { type: "dayNames", dayNames: { 8: "Extra" } },
      { type: "dayNames", dayNames: { 1: "x".repeat(31) } },
      { type: "dayRemoved", day: 9, dayNames: {}, schedule: {} },
      { type: "schedule", schedule: { 1: [1, 8] }, startDate: null },
    ]) await expect(applyWorkoutChanges([bad], null)).rejects.toThrow("Cambios no válidos");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});
