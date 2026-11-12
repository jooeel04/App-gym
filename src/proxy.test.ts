// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn() }));
const { config } = await import("./proxy");

// El proxy pide sesión en toda la app menos en lo que llaman de fuera sin sesión: los avisos
// (Supabase) y el buzón del atajo de iPhone (spec ajustes R10).
describe("proxy · rutas sin sesión", () => {
  const passes = (path: string) => new RegExp("^" + config.matcher[0] + "$").test(path);

  it("no pide sesión para /api/reloj, /api/reminders ni /api/rest-alerts", () => {
    expect(passes("/api/reloj")).toBe(false);
    expect(passes("/api/reminders")).toBe(false);
    expect(passes("/api/rest-alerts")).toBe(false);
  });

  it("sí la pide en las pantallas de la app", () => {
    expect(passes("/entrenar")).toBe(true);
    expect(passes("/ajustes")).toBe(true);
  });
});
