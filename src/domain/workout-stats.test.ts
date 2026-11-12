import { describe, expect, it } from "vitest";
import type { WorkoutRepository } from "@/repositories/workout-repository";
import { historySnapshot, PRESS } from "../../tests/workout-fixture";
import { BASE_ROUTINE } from "./base-routine";
import { WorkoutModel } from "./workout-model";
import { WorkoutStats } from "./workout-stats";

const memory: WorkoutRepository = { load: async () => null, apply: async () => {}, flush: async () => {} };

function setup() {
  const model = new WorkoutModel(memory, BASE_ROUTINE, historySnapshot());
  return { model, stats: new WorkoutStats(model) };
}

describe("Varias tandas del mismo día (datos R1)", () => {
  it("una clave antigua es la 1.ª vez y la 2.ª vez se guarda aparte", () => {
    const { model } = setup();
    expect(model.getEntry(3, 1, PRESS.id, 1, 1)).toMatchObject({ weight: "55", reps: "8" });
    expect(model.getEntry(3, 1, PRESS.id, 1, 2)).toEqual({});
    model.setEntryField(3, 1, PRESS.id, 1, "weight", "57.5", "2026-10-21", 2);
    expect(model.getEntry(3, 1, PRESS.id, 1, 2)).toMatchObject({ weight: "57.5", date: "2026-10-21" });
    expect(model.getEntry(3, 1, PRESS.id, 1, 1)).toMatchObject({ weight: "55" });
  });
});

describe("Récords por peso máximo (progreso R4)", () => {
  it("el récord es la serie más pesada, también de una tanda repetida", () => {
    const { model, stats } = setup();
    expect(stats.record(PRESS)?.heaviest).toMatchObject({ weight: 55, reps: 8 });
    model.setEntryField(3, 1, PRESS.id, 2, "weight", "57.5", "2026-10-21", 2);
    model.setEntryField(3, 1, PRESS.id, 2, "reps", "3", "2026-10-21", 2);
    expect(stats.record(PRESS)?.heaviest).toMatchObject({ weight: 57.5, reps: 3, date: "2026-10-21" });
    // Sin contar esa misma serie, el récord anterior era 55 kg.
    expect(stats.record(PRESS, "3|2|2")?.heaviest.weight).toBe(55);
  });
});

describe("El récord cuenta todas las series del día (progreso R5)", () => {
  it("es el día de más peso con sus series; a igual peso, el de más repeticiones en total", () => {
    const { model, stats } = setup();
    // Semana 3: 55×8 tres veces (24 reps). Tanda repetida: 55×10, 50×12 y 50×12 (34 reps).
    [["55", "10"], ["50", "12"], ["50", "12"]].forEach(([kg, reps], i) => {
      model.setEntryField(3, 1, PRESS.id, i + 1, "weight", kg, "2026-10-22", 2);
      model.setEntryField(3, 1, PRESS.id, i + 1, "reps", reps, "2026-10-22", 2);
    });
    const record = stats.record(PRESS)!;
    expect(record.heaviest).toMatchObject({ weight: 55, reps: 10, date: "2026-10-22" });
    expect(record.sets.map((s) => [s.weight, s.reps])).toEqual([[55, 10], [50, 12], [50, 12]]);
    expect(record.totalReps).toBe(34);
  });
});

describe("La última vez (hoy R17)", () => {
  it("es la tanda anterior, aunque sea de la misma semana", () => {
    const { model, stats } = setup();
    expect(stats.lastBefore(PRESS, 3, 2)?.topWeight).toBe(55);
    model.setEntryField(3, 1, PRESS.id, 1, "weight", "57.5", "2026-10-21", 2);
    model.setEntryField(3, 1, PRESS.id, 1, "reps", "6", "2026-10-21", 2);
    expect(stats.session(PRESS, 3, 2)?.topWeight).toBe(57.5);
    expect(stats.lastBefore(PRESS, 3, 3)?.topWeight).toBe(57.5);
    expect(stats.lastBefore(PRESS, 4)?.topWeight).toBe(57.5);
    expect(stats.exerciseHistory(PRESS).map((s) => [s.week, s.round])).toEqual([[1, 1], [2, 1], [3, 1], [3, 2]]);
  });
});
