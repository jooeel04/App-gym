import { readFileSync } from "node:fs";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { ProgressView } from "./progress-view";
import { RoutineView } from "./routine-view";
import { SettingsView } from "./settings-view";

// Spec interfaz R3: sin etiquetas de adorno encima de los títulos.
describe("Interfaz · títulos sin adornos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it.each([
    ["Rutina", <RoutineView key="r" />, "Tu plan"],
    ["Progreso", <ProgressView key="p" />, "Tu avance"],
    ["Ajustes", <SettingsView key="a" />, "Tu app"],
  ])("%s solo lleva su título", (title, view, decoration) => {
    renderWithWorkout(view);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.queryByText(decoration, { exact: false })).not.toBeInTheDocument();
  });
});

// Spec interfaz R3 y R4, en el CSS: las etiquetas no van en mayúsculas y los números del
// entreno usan la letra de cifras (`--font-num`, cargada en el layout).
describe("Interfaz · tipografía", () => {
  const css = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (selector: string) => {
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel]) => sel.split(",").map((s) => s.trim()).includes(selector));
    return blocks.map(([, , body]) => body).join(";");
  };
  // Valor que gana: la última declaración de esa propiedad.
  const last = (selector: string, prop: string) => [...rule(selector).matchAll(new RegExp(prop + ":\\s*([^;]+)", "g"))].pop()?.[1].trim();

  it("la fecha de Hoy no va en mayúsculas", () => {
    expect(last(".eyebrow", "text-transform")).toBe("none");
  });

  it.each([".stepper-val input", ".rest-text strong", ".summary-grid strong", ".set-chip b", ".hero-ring span"])("%s usa la letra de cifras", (selector) => {
    expect(rule(selector)).toMatch(/font-family:\s*var\(--font-num\)/);
    expect(rule(selector)).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("el layout carga la letra de cifras", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/variable:\s*"--font-num"/);
  });
});
