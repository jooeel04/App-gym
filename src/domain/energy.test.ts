import { describe, expect, it } from "vitest";
import { estimateKcal, intensityOf } from "./energy";

// Spec hoy R31: calorías estimadas con METs (MET × peso × horas).
describe("estimateKcal · calorías estimadas de un ejercicio", () => {
  it("4 series de sentadilla con 2 min de descanso, a 75 kg: unas 80 kcal", () => {
    // 4 × (40 s + 120 s) = 640 s; 6 × 75 × 640 / 3600 = 80.
    expect(estimateKcal({ name: "Sentadilla con barra", sets: 4 }, { restSeconds: 120, bodyWeight: 75 })).toBe(80);
  });

  it("más series o más peso corporal, más calorías", () => {
    const base = estimateKcal({ name: "Press banca con barra", sets: 3 }, { restSeconds: 90, bodyWeight: 70 });
    expect(estimateKcal({ name: "Press banca con barra", sets: 4 }, { restSeconds: 90, bodyWeight: 70 })).toBeGreaterThan(base);
    expect(estimateKcal({ name: "Press banca con barra", sets: 3 }, { restSeconds: 90, bodyWeight: 90 })).toBeGreaterThan(base);
  });

  it("un ejercicio grande gasta más que uno aislado con las mismas series", () => {
    const ctx = { restSeconds: 90, bodyWeight: 75 };
    expect(estimateKcal({ name: "Peso muerto rumano", sets: 3 }, ctx)).toBeGreaterThan(estimateKcal({ name: "Curl de bíceps con barra", sets: 3 }, ctx));
  });

  it("sin series no hay calorías", () => {
    expect(estimateKcal({ name: "Sentadilla con barra", sets: 0 }, { restSeconds: 90, bodyWeight: 75 })).toBe(0);
  });
});

describe("intensityOf · cuánto músculo mueve, por el nombre", () => {
  it("grandes, compuestos y aislados", () => {
    expect(intensityOf("Sentadilla búlgara contralateral")).toBe("big");
    expect(intensityOf("Hip thrust con barra")).toBe("big");
    expect(intensityOf("Press militar con mancuernas")).toBe("compound");
    expect(intensityOf("Remo en polea baja")).toBe("compound");
    expect(intensityOf("Press francés con barra Z")).toBe("isolation");
    expect(intensityOf("Curl femoral tumbado")).toBe("isolation");
    expect(intensityOf("Elevaciones laterales con mancuernas")).toBe("isolation");
    expect(intensityOf("Mi ejercicio raro")).toBe("compound");
  });
});
