import { describe, expect, it, vi } from "vitest";
import type { WorkoutRepository } from "@/repositories/workout-repository";
import { historySnapshot, PRESS } from "../../tests/workout-fixture";
import { BASE_ROUTINE } from "./base-routine";
import { entryKey } from "./snapshot";
import type { WorkoutChange } from "./types";
import { WorkoutModel } from "./workout-model";

function setup(snapshot = historySnapshot()) {
  const changes: WorkoutChange[] = [];
  const repository: WorkoutRepository = { load: async () => null, apply: vi.fn(async (c: WorkoutChange) => { changes.push(c); }), flush: async () => {} };
  return { model: new WorkoutModel(repository, BASE_ROUTINE, snapshot), changes };
}

// Spec rutina R1–R3: días de rutina propios.
describe("Tus días de rutina", () => {
  it("empieza con los 5 de siempre; «Añadir día» crea uno vacío con su nombre y como mucho hay 7 (R1)", () => {
    const { model } = setup();
    expect(model.days).toEqual([1, 2, 3, 4, 5]);
    expect(model.dayName(1)).toBe("Torso");
    expect(model.addDay("  Full body ")).toBe(6);
    expect(model.days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(model.dayName(6)).toBe("Full body");
    expect(model.exercisesOfDay(6)).toEqual([]);
    expect(model.addDay("Cardio")).toBe(7);
    expect(model.addDay("Otro")).toBeNull();
    expect(model.addDay("   ")).toBeNull();
  });

  it("«Cambiar nombre» cambia el nombre del día (R2)", () => {
    const { model, changes } = setup();
    model.renameDay(1, "Pecho y espalda");
    expect(model.dayName(1)).toBe("Pecho y espalda");
    expect(changes.at(-1)).toMatchObject({ type: "dayNames", dayNames: { 1: "Pecho y espalda", 2: "Pierna" } });
    model.renameDay(1, "  ");
    expect(model.dayName(1)).toBe("Pecho y espalda");
  });

  it("«Eliminar día» borra el día con sus ejercicios, registros y su sitio en el calendario (R3)", () => {
    const { model, changes } = setup();
    model.removeDay(1);
    expect(model.days).toEqual([2, 3, 4, 5]);
    expect(model.exercisesOfDay(1)).toEqual([]);
    expect(model.snapshot.entries[entryKey(1, 1, PRESS.id, 1)]).toBeUndefined();
    expect(Object.keys(model.snapshot.completed).filter((k) => k.split("|")[1] === "1")).toEqual([]);
    expect(model.schedule[1]).toBeUndefined();
    expect(changes.at(-1)).toMatchObject({ type: "dayRemoved", day: 1 });
    // El último día no se puede borrar.
    [2, 3, 4].forEach((d) => model.removeDay(d));
    model.removeDay(5);
    expect(model.days).toEqual([5]);
  });
});
