import { describe, expect, it } from "vitest";
import { progressTrend } from "./progression";
import type { ExerciseSession } from "./workout-stats";

const session = (week: number, sets: [number | null, number][], date = "2026-10-0" + week): ExerciseSession => {
  const results = sets.map(([weight, reps], i) => ({ set: i + 1, weight, reps }));
  const e1rm = Math.max(0, ...results.map((r) => (r.weight && r.reps ? r.weight * (1 + r.reps / 30) : 0)));
  return {
    week, date, sets: results,
    topWeight: results.some((r) => r.weight !== null) ? Math.max(...results.map((r) => r.weight ?? 0)) : null,
    reps: results.reduce((n, r) => n + r.reps, 0),
    volume: results.reduce((n, r) => n + (r.weight ?? 0) * r.reps, 0),
    e1rm,
  };
};

describe("progressTrend", () => {
  it("sin sesiones no hay tendencia", () => {
    expect(progressTrend([])).toBeNull();
  });

  it("con carga sigue la fuerza (1RM estimado, redondeado a 0,5 kg) y su cambio", () => {
    const trend = progressTrend([session(1, [[50, 8], [50, 8]]), session(2, [[55, 8], [55, 6]])])!;
    expect(trend.kind).toBe("strength");
    expect(trend.points.map((p) => p.value)).toEqual([63.5, 69.5]);
    expect(trend.last.value).toBe(69.5);
    expect(trend.change).toBe(6);
    // La mejor serie de cada sesión, para enseñar "55 kg × 8".
    expect(trend.last.best).toEqual({ set: 1, weight: 55, reps: 8 });
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

  it("si alguna sesión tiene carga, la tendencia es de fuerza y omite las que no", () => {
    const trend = progressTrend([session(1, [[null, 10]]), session(2, [[20, 10]])])!;
    expect(trend.kind).toBe("strength");
    expect(trend.points).toHaveLength(1);
    expect(trend.points[0].week).toBe(2);
  });
});
