import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec interfaz R2: los iconos son dibujos (icons.tsx), nunca letras o símbolos de texto.
// Mira las pantallas (.tsx); los textos que describen botones (p. ej. Novedades) pueden nombrarlos.
const GLYPHS = /[‹›⌃✎✓＋↺↑↓▲▼−]/;
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(join(dir, e.name)) : /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []);

describe("Interfaz · iconos dibujados", () => {
  it("ninguna pantalla usa símbolos de texto como iconos", () => {
    const offenders = files("src").flatMap((f) => readFileSync(f, "utf8").split("\n")
      .map((line, i) => ({ line: line.trim(), at: f + ":" + (i + 1) }))
      .filter(({ line }) => !line.startsWith("//") && GLYPHS.test(line))
      .map(({ at }) => at));
    expect(offenders).toEqual([]);
  });
});
