import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { demoFor } from "./exercise-demos";
import { EXERCISE_LIBRARY } from "./exercise-library";

describe("Demostración de cada ejercicio", () => {
  it("todos los ejercicios de la biblioteca tienen sus dos fotos, y existen", () => {
    for (const x of EXERCISE_LIBRARY) {
      const demo = demoFor(x.name);
      expect(demo, x.name).not.toBeNull();
      for (const src of demo!) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
    }
  });

  it("no importan las mayúsculas ni las tildes; un ejercicio inventado no tiene", () => {
    expect(demoFor("press banca CON barra")?.[0]).toBe("/ejercicios/barbell-bench-press---medium-grip-0.webp");
    expect(demoFor("Jalon prono al pecho")).not.toBeNull();
    expect(demoFor("Mi ejercicio raro")).toBeNull();
  });
});
