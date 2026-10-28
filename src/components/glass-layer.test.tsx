import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlassLayer } from "./glass-layer";

// La barra donde va el cristal: 360 × 68 px.
const RECT = { width: 360, height: 68, top: 0, left: 0, right: 360, bottom: 68, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

function Bar() {
  return (
    <nav aria-label="Navegación" data-testid="bar">
      <GlassLayer radius={32} />
      <a href="/entrenar">Hoy</a>
    </nav>
  );
}

const layer = () => screen.getByTestId("bar").querySelector(".glass-layer")!;
const media = (matches: (q: string) => boolean) => vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
  matches: matches(query), media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}));

describe("GlassLayer · cristal líquido de las barras flotantes", () => {
  beforeEach(() => { vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RECT); });
  afterEach(() => vi.restoreAllMocks());

  it("carga el efecto de liquid-glass-react en el navegador, detrás del contenido", async () => {
    render(<Bar />);
    await waitFor(() => expect(layer()).toHaveClass("on"));
    expect(layer().querySelector("filter feDisplacementMap")).not.toBeNull();
    // Es decoración: los lectores de pantalla la ignoran y los botones siguen igual.
    expect(layer()).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Hoy" })).toBeInTheDocument();
  });

  it("el cristal mide lo mismo que su barra y tiene sus esquinas", async () => {
    render(<Bar />);
    await waitFor(() => expect(layer()).toHaveClass("on"));
    const tint = layer().querySelector<HTMLElement>(".glass-tint")!;
    expect(tint.style.width).toBe("360px");
    expect(tint.style.height).toBe("68px");
    expect(layer().querySelector<HTMLElement>(".glass")!.style.borderRadius).toBe("32px");
  });

  it("sin radio indicado, usa las esquinas de su contenedor", async () => {
    render(<div style={{ borderRadius: "22px" }}><GlassLayer /></div>);
    await waitFor(() => expect(document.querySelector(".glass-layer")).toHaveClass("on"));
    expect(document.querySelector<HTMLElement>(".glass-layer .glass")!.style.borderRadius).toBe("22px");
  });

  it("solo se activa cuando está en pantalla (ahorra batería)", async () => {
    let notify: (visible: boolean) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: IntersectionObserverCallback) { notify = (v) => cb([{ isIntersecting: v } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    render(<Bar />);
    await new Promise((r) => setTimeout(r, 50));
    expect(layer()).not.toHaveClass("on");
    notify(true);
    await waitFor(() => expect(layer()).toHaveClass("on"));
    notify(false);
    await waitFor(() => expect(layer()).not.toHaveClass("on"));
    vi.unstubAllGlobals();
  });

  it("si el sistema pide menos transparencia, la barra se queda sólida", async () => {
    media((q) => q.includes("reduced-transparency"));
    render(<Bar />);
    await new Promise((r) => setTimeout(r, 50));
    expect(layer()).not.toHaveClass("on");
    expect(layer().querySelector("filter")).toBeNull();
  });

  it("con contraste alto, también sólida", async () => {
    media((q) => q.includes("prefers-contrast"));
    render(<Bar />);
    await new Promise((r) => setTimeout(r, 50));
    expect(layer().querySelector("filter")).toBeNull();
  });
});
