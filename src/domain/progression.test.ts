import { describe, expect, it } from "vitest";
import { progressTrend, suggestNext } from "./progression";
import type { Exercise } from "./types";
import type { ExerciseSession } from "./workout-stats";

const session = (week: number, sets: [number | null, number][], date = "2026-10-0" + week): ExerciseSession => {
  const results = sets.map(([weight, reps], i) => ({ set: i + 1, weight, reps }));
  return {
    week, round: 1, date, sets: results,
    topWeight: results.some((r) => r.weight !== null) ? Math.max(...results.map((r) => r.weight ?? 0)) : null,
    reps: results.reduce((n, r) => n + r.reps, 0),
    volume: results.reduce((n, r) => n + (r.weight ?? 0) * r.reps, 0),
  };
};

describe("progressTrend", () => {
  it("sin sesiones no hay tendencia", () => {
    expect(progressTrend([])).toBeNull();
  });

  it("con carga sigue el peso máximo de cada día y su cambio (progreso R2)", () => {
    const trend = progressTrend([session(1, [[50, 8], [47.5, 10]]), session(2, [[55, 6], [52.5, 8]])])!;
    expect(trend.kind).toBe("weight");
    expect(trend.points.map((p) => p.value)).toEqual([50, 55]);
    expect(trend.last.value).toBe(55);
    expect(trend.change).toBe(5);
    // La serie que consiguió ese peso, para enseñar "55 kg × 6".
    expect(trend.last.best).toEqual({ set: 1, weight: 55, reps: 6 });
  });

  it("sin carga (peso corporal) sigue las repeticiones de la mejor serie", () => {
    const trend = progressTrend([session(1, [[null, 4], [null, 3]]), session(2, [[null, 6], [null, 5]])])!;
    expect(trend.kind).toBe("reps");
    expect(trend.points.map((p) => p.value)).toEqual([4, 6]);
    expect(trend.change).toBe(2);
    expect(trend.last.best).toEqual({ set: 1, weight: null, reps: 6 });
  });

  it("con una sola sesión no hay cambio que comparar", () => {
    expect(progressTrend([session(1, [[40, 10]])])!.change).toBeNull();
  });

  it("si alguna sesión tiene carga, la tendencia es de peso y omite las que no", () => {
    const trend = progressTrend([session(1, [[null, 10]]), session(2, [[20, 10]])])!;
    expect(trend.kind).toBe("weight");
    expect(trend.points).toHaveLength(1);
    expect(trend.points[0].week).toBe(2);
  });
});

// Un ejercicio de 3 series de 8–12; la última vez, todas al máximo con `kg`: toca subir.
const exercise = (name: string): Exercise => ({ id: 1, day: 1, group: "", name, note: "", prescription: "", sets: 3, target: "8–12", optionalLast: false });
const allMax = (kg: number) => session(1, [[kg, 12], [kg, 12], [kg, 12]]);

describe("suggestNext · el salto depende del material (spec hoy R23–R24)", () => {
  it("con mancuernas sube de 2 en 2 kg: de 16 a 18, nunca a 17,5 (R23)", () => {
    const tip = suggestNext(exercise("Curl de bíceps con mancuernas"), allMax(16))!;
    expect(tip.kind).toBe("increase");
    expect(tip.weight).toBe(18);
    expect(tip.text).toContain("Sube a 18 kg");
  });

  it("en polea o máquina sube de 2,5 en 2,5 kg (R24)", () => {
    expect(suggestNext(exercise("Curl en polea baja"), allMax(16))!.weight).toBe(18.5);
    expect(suggestNext(exercise("Extensión de cuádriceps"), allMax(20))!.weight).toBe(22.5);
  });

  it("con barra, el doble del disco más pequeño del gym (R24)", () => {
    expect(suggestNext(exercise("Press banca con barra"), allMax(60))!.weight).toBe(62.5);
    expect(suggestNext(exercise("Press banca con barra"), allMax(60), 2.5)!.weight).toBe(65);
  });
});
