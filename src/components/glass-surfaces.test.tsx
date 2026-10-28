import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlassSurfaces } from "./glass-surfaces";

const RECT = { width: 320, height: 120, top: 0, left: 0, right: 320, bottom: 120, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

function Screen({ label = "Entrar" }: { label?: string }) {
  return (
    <main>
      <section className="chart" data-testid="card"><h2>Calendario</h2></section>
      <section className="hero" data-testid="hero"><h2>Empujes</h2></section>
      <button type="button" className="primary">{label}</button>
      <button type="button" className="peek-row">Press militar</button>
    </main>
  );
}

const glassOf = (el: Element) => el.querySelector(":scope > .glass-slot .glass-layer.on");
const media = (matches: (q: string) => boolean) => vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
  matches: matches(query), media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}));

describe("GlassSurfaces · cristal líquido en tarjetas y botones de toda la app", () => {
  beforeEach(() => { vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RECT); });
  afterEach(() => vi.restoreAllMocks());

  it("pone el cristal en las tarjetas y los botones principales", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("card"))).not.toBeNull());
    expect(glassOf(screen.getByTestId("hero"))).not.toBeNull();
    expect(glassOf(screen.getByRole("button", { name: "Entrar" }))).not.toBeNull();
  });

  it("marca cada tarjeta con cristal para que su CSS lo deje ver (data-glass)", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(screen.getByTestId("card")).toHaveAttribute("data-glass", "on"));
    expect(screen.getByRole("button", { name: "Press militar" })).not.toHaveAttribute("data-glass");
  });

  it("no lo pone en filas de lista ni elementos pequeños", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("card"))).not.toBeNull());
    expect(screen.getByRole("button", { name: "Press militar" }).querySelector(".glass-slot")).toBeNull();
  });

  it("es solo decoración: no cambia lo que anuncia el lector de pantalla", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("card"))).not.toBeNull());
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveTextContent(/^Entrar$/);
    for (const slot of document.querySelectorAll(".glass-slot")) expect(slot).toHaveAttribute("aria-hidden", "true");
  });

  it("si el texto del botón cambia, el cristal sigue ahí", async () => {
    const { rerender } = render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByRole("button", { name: "Entrar" }))).not.toBeNull());
    rerender(<><Screen label="Entrando…" /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByRole("button", { name: "Entrando…" }))).not.toBeNull());
  });

  it("al desaparecer una pantalla no deja restos", async () => {
    const { rerender } = render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(document.querySelectorAll(".glass-slot").length).toBeGreaterThan(0));
    rerender(<GlassSurfaces />);
    await waitFor(() => expect(document.querySelectorAll(".glass-slot")).toHaveLength(0));
  });

  it("si el sistema pide menos transparencia, no pone cristal", async () => {
    media((q) => q.includes("reduced-transparency"));
    render(<><Screen /><GlassSurfaces /></>);
    await new Promise((r) => setTimeout(r, 80));
    expect(document.querySelectorAll(".glass-slot")).toHaveLength(0);
  });
});
