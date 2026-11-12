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
      { type: "dayRemoved", day: 2, dayNames: { 1: "Torso" }, schedule: { 1: [1, 4] }, dayColors: { 1: "rojo" } },
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
      { type: "dayRemoved", day: 9, dayNames: {}, schedule: {}, dayColors: {} },
      { type: "schedule", schedule: { 1: [1, 8] }, startDate: null },
    ]) await expect(applyWorkoutChanges([bad], null)).rejects.toThrow("Cambios no válidos");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});

// Spec datos R5: el color de cada día, solo de la lista.
describe("Guardar el color de los días", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta colores de la lista en días 1–7", async () => {
    await applyWorkoutChanges([{ type: "dayColors", dayColors: { 1: "rojo", 7: "turquesa" } }, { type: "dayColors", dayColors: {} }], null);
    expect(repository.apply).toHaveBeenCalledTimes(2);
  });

  it("rechaza colores que no están en la lista, días fuera de 1–7 y un día borrado con colores raros", async () => {
    for (const bad of [
      { type: "dayColors", dayColors: { 1: "fucsia" } },
      { type: "dayColors", dayColors: { 8: "rojo" } },
      { type: "dayColors", dayColors: { 1: "#ff0000" } },
      { type: "dayColors", dayColors: null },
      { type: "dayRemoved", day: 2, dayNames: { 1: "Torso" }, schedule: {}, dayColors: { 1: "fucsia" } },
    ]) await expect(applyWorkoutChanges([bad], null)).rejects.toThrow("Cambios no válidos");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});

// Spec datos R6: kcal del reloj por fecha.
describe("Guardar las kcal del reloj", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta de 1 a 9999 kcal (o null) con una fecha válida", async () => {
    await applyWorkoutChanges([
      { type: "watchKcal", date: "2026-10-28", kcal: 320 },
      { type: "watchKcal", date: "2026-10-28", kcal: null },
    ], null);
    expect(repository.apply).toHaveBeenCalledTimes(2);
  });

  it("rechaza kcal fuera de rango, con decimales o fechas raras", async () => {
    for (const bad of [
      { type: "watchKcal", date: "2026-10-28", kcal: 0 },
      { type: "watchKcal", date: "2026-10-28", kcal: 10000 },
      { type: "watchKcal", date: "2026-10-28", kcal: 12.5 },
      { type: "watchKcal", date: "28/10/2026", kcal: 300 },
      { type: "watchKcal", date: "2026-10-28" },
    ]) await expect(applyWorkoutChanges([bad], null)).rejects.toThrow("Cambios no válidos");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});

// Spec datos R4: borrar un entreno entero.
describe("Borrar un entreno", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta una vez válida y rechaza las que no lo son", async () => {
    await applyWorkoutChanges([{ type: "sessionRemoved", week: 3, day: 1, round: 2 }], null);
    expect(repository.apply).toHaveBeenCalledTimes(1);
    for (const bad of [{ week: 0, day: 1, round: 1 }, { week: 3, day: 8, round: 1 }, { week: 3, day: 1, round: 0 }, { week: 3, day: 1 }]) {
      await expect(applyWorkoutChanges([{ type: "sessionRemoved", ...bad }], null)).rejects.toThrow("Cambios no válidos");
    }
  });
});

describe("Mover un entreno a otra fecha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acepta un cambio válido y rechaza semanas, veces o fechas raras (R4)", async () => {
    const ok = { type: "sessionMoved", week: 3, day: 1, round: 1, toWeek: 2, toRound: 2, date: "2026-10-14" };
    await applyWorkoutChanges([ok], null);
    expect(repository.apply).toHaveBeenCalledTimes(1);
    for (const bad of [{ toWeek: 0 }, { toRound: 21 }, { date: "14/10/2026" }, { day: 9 }]) {
      await expect(applyWorkoutChanges([{ ...ok, ...bad }], null)).rejects.toThrow("Cambios no válidos");
    }
  });
});
