import { describe, expect, it } from "vitest";
import { equipmentOf, nextLoad } from "./equipment";

const CURL = "Curl de bíceps con mancuernas";

describe("equipmentOf · el material sale del nombre", () => {
  it("reconoce mancuernas, barra, kettlebell y lo demás como máquina", () => {
    expect(equipmentOf(CURL)).toBe("dumbbell");
    expect(equipmentOf("Sentadilla goblet")).toBe("dumbbell");
    expect(equipmentOf("Press banca con barra")).toBe("barbell");
    expect(equipmentOf("Peso muerto rumano")).toBe("barbell");
    expect(equipmentOf("Swing con pesa rusa")).toBe("kettlebell");
    expect(equipmentOf("Dominadas en barra fija")).toBe("stack");
    expect(equipmentOf("Curl en polea baja")).toBe("stack");
  });
});

describe("nextLoad · pesos que existen (spec hoy R25)", () => {
  it("en mancuernas, un peso fuera de la escala va al siguiente o al anterior que existe", () => {
    expect(nextLoad(CURL, 15, 1)).toBe(16);
    expect(nextLoad(CURL, 15, -1)).toBe(14);
    expect(nextLoad(CURL, 16, 1)).toBe(18);
  });

  it("las mancuernas no bajan de 4 kg ni suben de 60", () => {
    expect(nextLoad(CURL, 4, -1)).toBe(4);
    expect(nextLoad(CURL, 0, 1)).toBe(4);
    expect(nextLoad(CURL, 60, 1)).toBe(60);
  });

  it("en polea no baja de 0", () => {
    expect(nextLoad("Curl en polea baja", 1, -1)).toBe(0);
  });
});
