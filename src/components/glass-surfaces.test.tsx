import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlassSurfaces } from "./glass-surfaces";

const RECT = { width: 320, height: 120, top: 0, left: 0, right: 320, bottom: 120, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

// Una pantalla con tarjetas y botones normales, y lo que flota: una ventana y el botón del
// hueco de abajo.
function Screen({ label = "Serie hecha" }: { label?: string }) {
  return (
    <main>
      <section className="chart" data-testid="card"><h2>Calendario</h2></section>
      <section className="hero" data-testid="hero"><h2>Empujes</h2></section>
      <button type="button" className="primary">Entrar</button>
      <div className="modal" data-testid="modal"><h2>¿Borrar?</h2></div>
      <button type="button" className="set-done">{label}</button>
    </main>
  );
}

const glassOf = (el: Element) => el.querySelector(":scope > .glass-slot .glass-layer.on");
const media = (matches: (q: string) => boolean) => vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
  matches: matches(query), media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}));

// Spec interfaz R6: el cristal solo va en lo que flota por encima del contenido.
describe("GlassSurfaces · cristal líquido solo en lo que flota", () => {
  beforeEach(() => { vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RECT); });
  afterEach(() => vi.restoreAllMocks());

  it("pone el cristal en las ventanas y en el botón del hueco de abajo (R6)", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("modal"))).not.toBeNull());
    expect(glassOf(screen.getByRole("button", { name: "Serie hecha" }))).not.toBeNull();
    expect(screen.getByTestId("modal")).toHaveAttribute("data-glass", "on");
  });

  it("no lo pone en las tarjetas ni en los botones normales (R6)", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("modal"))).not.toBeNull());
    expect(screen.getByTestId("card").querySelector(".glass-slot")).toBeNull();
    expect(screen.getByTestId("hero").querySelector(".glass-slot")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" }).querySelector(".glass-slot")).toBeNull();
  });

  it("es solo decoración: no cambia lo que anuncia el lector de pantalla", async () => {
    render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByTestId("modal"))).not.toBeNull());
    expect(screen.getByRole("button", { name: "Serie hecha" })).toHaveTextContent(/^Serie hecha$/);
    for (const slot of document.querySelectorAll(".glass-slot")) expect(slot).toHaveAttribute("aria-hidden", "true");
  });

  it("si el texto del botón cambia, el cristal sigue ahí", async () => {
    const { rerender } = render(<><Screen /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByRole("button", { name: "Serie hecha" }))).not.toBeNull());
    rerender(<><Screen label="Guardar cambios" /><GlassSurfaces /></>);
    await waitFor(() => expect(glassOf(screen.getByRole("button", { name: "Guardar cambios" }))).not.toBeNull());
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

  it("no pone el cristal en la pestaña que asoma al deslizar, hasta que se queda quieta", async () => {
    render(
      <>
        <div className="page"><div className="modal" data-testid="actual"><h2>Hoy</h2></div></div>
        <div className="page peek" data-testid="pagina"><div className="modal" data-testid="vecina"><h2>Rutina</h2></div></div>
        <GlassSurfaces />
      </>,
    );
    await waitFor(() => expect(glassOf(screen.getByTestId("actual"))).not.toBeNull());
    expect(screen.getByTestId("vecina").querySelector(".glass-slot")).toBeNull();
    // Termina el cambio de pestaña: la vecina pasa a ser la actual.
    screen.getByTestId("pagina").classList.remove("peek");
    window.dispatchEvent(new Event("rutina-tab-settled"));
    await waitFor(() => expect(glassOf(screen.getByTestId("vecina"))).not.toBeNull());
  });
});
