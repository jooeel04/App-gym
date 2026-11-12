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

  it("cada día tiene su color de siempre y se puede elegir otro de la lista (rutina R7)", () => {
    const { model, changes } = setup();
    expect(model.dayColor(1)).toBe("azul");
    expect(model.dayColor(3)).toBe("verde");
    model.setDayColor(3, "rojo");
    expect(model.dayColor(3)).toBe("rojo");
    expect(changes.at(-1)).toEqual({ type: "dayColors", dayColors: { 3: "rojo" } });
    // Un color que no está en la lista no se guarda.
    model.setDayColor(3, "fucsia");
    expect(model.dayColor(3)).toBe("rojo");
  });

  it("al eliminar un día se olvida su color (un día nuevo con ese número sale con el de siempre)", () => {
    const { model, changes } = setup();
    model.setDayColor(1, "rojo");
    model.removeDay(1);
    expect(changes.at(-1)).toMatchObject({ type: "dayRemoved", day: 1, dayColors: {} });
    model.addDay("Nuevo");
    expect(model.dayColor(1)).toBe("azul");
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

// Spec progreso R7: borrar un entreno marcado sin querer.
describe("Borrar un entreno", () => {
  it("quita sus series, ticks y el día completado de esa vez, y nada más", () => {
    const { model, changes } = setup();
    model.setEntryField(3, 1, PRESS.id, 1, "reps", "6", "2026-10-22", 2);
    model.toggleExerciseChecked(3, 1, PRESS.id, "2026-10-22", 2);
    model.removeSession(3, 1, 1);
    expect(model.isDayCompleted(3, 1)).toBe(false);
    expect(model.hasLoggedSets(3, 1, 1)).toBe(false);
    expect(model.hasLoggedSets(3, 1, 2)).toBe(true);
    expect(model.hasLoggedSets(2, 1, 1)).toBe(true);
    expect(changes.at(-1)).toEqual({ type: "sessionRemoved", week: 3, day: 1, round: 1 });
    model.removeSession(3, 1, 2);
    expect(model.isExerciseChecked(3, 1, PRESS.id, 2)).toBe(false);
    expect(model.isDayDone(3, 1)).toBe(false);
  });
});

// Spec progreso R9: cambiar la fecha de un entreno.
describe("Cambiar la fecha de un entreno", () => {
  it("en la misma semana solo cambia la fecha de sus series", () => {
    const { model } = setup();
    model.moveSession(3, 1, 1, "2026-10-21");
    expect(model.getEntry(3, 1, PRESS.id, 1)).toMatchObject({ weight: "55", date: "2026-10-21" });
    expect(model.isDayCompleted(3, 1)).toBe(true);
  });

  it("en otra semana pasa a esa semana, en la primera vez libre, con su día completado", () => {
    const { model, changes } = setup();
    // La semana 2 ya tiene Torso: el de la semana 3 pasa a ser su 2.ª vez.
    model.moveSession(3, 1, 1, "2026-10-14");
    expect(model.hasLoggedSets(3, 1)).toBe(false);
    expect(model.isDayCompleted(3, 1)).toBe(false);
    expect(model.getEntry(2, 1, PRESS.id, 1, 2)).toMatchObject({ weight: "55", date: "2026-10-14" });
    expect(model.getEntry(2, 1, PRESS.id, 1, 1)).toMatchObject({ weight: "52.5" });
    expect(model.isDayCompleted(2, 1, 2)).toBe(true);
    expect(changes.at(-1)).toEqual({ type: "sessionMoved", week: 3, day: 1, round: 1, toWeek: 2, toRound: 2, date: "2026-10-14" });
  });
});
