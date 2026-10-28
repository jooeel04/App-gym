// Tema de la app (oscuro o claro), elegido en Ajustes y guardado en este dispositivo.

export type Theme = "dark" | "light";

const THEME_KEY = "rutina:theme";
const THEME_EVENT = "rutina-theme";
const BAR_COLOR: Record<Theme, string> = { dark: "#000000", light: "#f3f5f9" };

// Se ejecuta en <head> antes de pintar la página para no ver un destello del otro tema.
export const THEME_SCRIPT =
  `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// Color de la barra del sistema (barra de estado del móvil) acorde al tema.
export function syncThemeBar() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[currentTheme()]);
}

export function setTheme(theme: Theme) {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin almacenamiento el tema dura hasta cerrar la app.
  }
  syncThemeBar();
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}
