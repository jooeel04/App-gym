import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Las pruebas del servidor (`@vitest-environment node`) no tienen navegador simulado.
if (typeof window !== "undefined") {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // jsdom no trae estas APIs del navegador que usan los componentes.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}
