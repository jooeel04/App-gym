import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyDisplayPrefs, currentTheme, getTextSize, getThemePref, setTextSize, setTheme, watchSystemTheme } from "./theme";

// Simula el modo claro u oscuro del móvil.
let systemLight = false;
let listeners: (() => void)[] = [];
function mockSystem() {
  window.matchMedia = ((query: string) => ({
    get matches() { return query.includes("light") ? systemLight : !systemLight; },
    media: query, onchange: null,
    addEventListener: (_: string, fn: () => void) => { listeners.push(fn); },
    removeEventListener: (_: string, fn: () => void) => { listeners = listeners.filter((l) => l !== fn); },
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("Tema · sigue al modo claro u oscuro del móvil", () => {
  beforeEach(() => { systemLight = false; listeners = []; mockSystem(); localStorage.clear(); delete document.documentElement.dataset.theme; });
  afterEach(() => vi.restoreAllMocks());

  it("por defecto es automático: móvil en claro → app en claro", () => {
    systemLight = true;
    applyDisplayPrefs();
    expect(getThemePref()).toBe("auto");
    expect(currentTheme()).toBe("light");
  });

  it("si el móvil cambia de modo con la app abierta, la app cambia también", () => {
    applyDisplayPrefs();
    const stop = watchSystemTheme();
    expect(currentTheme()).toBe("dark");
    systemLight = true;
    listeners.forEach((l) => l());
    expect(currentTheme()).toBe("light");
    stop();
  });

  it("si eliges Oscuro o Claro en Ajustes, se queda así aunque el móvil cambie", () => {
    systemLight = true;
    setTheme("dark");
    const stop = watchSystemTheme();
    listeners.forEach((l) => l());
    expect(currentTheme()).toBe("dark");
    expect(getThemePref()).toBe("dark");
    stop();
  });
});

describe("Tamaño de letra", () => {
  beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.text; });

  it("normal por defecto; al elegir grande se marca en la página y se recuerda", () => {
    expect(getTextSize()).toBe("normal");
    setTextSize("grande");
    expect(document.documentElement.dataset.text).toBe("grande");
    expect(getTextSize()).toBe("grande");
    setTextSize("normal");
    expect(document.documentElement.dataset.text).toBeUndefined();
  });
});
