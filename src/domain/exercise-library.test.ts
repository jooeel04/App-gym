import { describe, expect, it } from "vitest";
import { exerciseGroup, EXERCISE_GROUPS } from "./exercise-library";

describe("Grupo de cada ejercicio (para dividir el ranking)", () => {
  it("por su músculo principal, de la biblioteca o por palabras clave", () => {
    expect(exerciseGroup("Press banca con barra")).toBe("Pecho");
    expect(exerciseGroup("Jalón al pecho")).toBe("Espalda");
    expect(exerciseGroup("Peso muerto rumano")).toBe("Pierna");
    expect(exerciseGroup("sentadilla búlgara")).toBe("Pierna");
    expect(exerciseGroup("Press militar")).toBe("Hombro");
    expect(exerciseGroup("Curl martillo")).toBe("Brazos");
    expect(exerciseGroup("Crunch en polea alta")).toBe("Abdomen");
    expect(exerciseGroup("Mi ejercicio raro")).toBe("Otros");
  });

  it("los grupos van en un orden fijo", () => {
    expect(EXERCISE_GROUPS).toEqual(["Pecho", "Espalda", "Pierna", "Hombro", "Brazos", "Abdomen", "Otros"]);
  });
});
