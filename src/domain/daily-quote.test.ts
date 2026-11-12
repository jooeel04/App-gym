import { describe, expect, it } from "vitest";
import { QUOTES, randomQuote } from "./daily-quote";

// Spec hoy R35: una frase al azar al abrir la app, distinta de la de la vez anterior.
describe("randomQuote · la frase al abrir la app", () => {
  it("elige con el azar que le den", () => {
    expect(randomQuote(() => 0)).toBe(QUOTES[0]);
    expect(randomQuote(() => 0.999)).toBe(QUOTES[QUOTES.length - 1]);
  });

  it("nunca repite la de la vez anterior", () => {
    for (let i = 0; i < QUOTES.length; i++) {
      const r = i / QUOTES.length;
      const previous = randomQuote(() => r);
      expect(randomQuote(() => r, previous)).not.toBe(previous);
    }
  });

  it("con una anterior que ya no existe, elige normal", () => {
    expect(randomQuote(() => 0, "Una frase que ya no está")).toBe(QUOTES[0]);
  });

  it("son cortas: caben en una línea del móvil (38 letras como mucho)", () => {
    for (const q of QUOTES) expect(q.length).toBeLessThanOrEqual(38);
  });
});
