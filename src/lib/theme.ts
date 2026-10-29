// Apariencia de la app en este dispositivo: tema (automático según el móvil, oscuro o
// claro) y tamaño de letra. Se guardan en el dispositivo, no en la cuenta.

export type Theme = "dark" | "light";
export type ThemePref = "auto" | Theme;
export type TextSize = "pequena" | "normal" | "grande" | "muy-grande";

// Clave nueva (antes "rutina:theme"): así todos empiezan en automático.
const THEME_KEY = "rutina:tema";
const TEXT_KEY = "rutina:letra";
const THEME_EVENT = "rutina-theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";
const BAR_COLOR: Record<Theme, string> = { dark: "#000000", light: "#f3f5f9" };

// Se ejecuta en <head> antes de pintar la página para no ver un destello del otro tema.
export const THEME_SCRIPT =
  `try{var d=document.documentElement,p=localStorage.getItem("${THEME_KEY}")||"auto";` +
  `if(p==="light"||(p==="auto"&&matchMedia("${LIGHT_QUERY}").matches))d.dataset.theme="light";` +
  `var t=localStorage.getItem("${TEXT_KEY}");if(t==="pequena"||t==="grande"||t==="muy-grande")d.dataset.text=t}catch(e){}`;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la preferencia dura hasta cerrar la app.
  }
}

export function getThemePref(): ThemePref {
  const saved = read(THEME_KEY);
  return saved === "dark" || saved === "light" ? saved : "auto";
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const systemTheme = (): Theme => (window.matchMedia?.(LIGHT_QUERY).matches ? "light" : "dark");

// Color de la barra del sistema (barra de estado del móvil) acorde al tema.
export function syncThemeBar() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[currentTheme()]);
}

// Pone en la página el tema y el tamaño de letra guardados (o el del móvil, en automático).
export function applyDisplayPrefs() {
  const pref = getThemePref();
  const theme = pref === "auto" ? systemTheme() : pref;
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  const size = getTextSize();
  if (size === "normal") delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = size;
  syncThemeBar();
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function setTheme(pref: ThemePref) {
  write(THEME_KEY, pref);
  applyDisplayPrefs();
}

// En automático, cambia la app en cuanto el móvil pasa a modo claro u oscuro.
export function watchSystemTheme() {
  const media = window.matchMedia?.(LIGHT_QUERY);
  if (!media?.addEventListener) return () => {};
  const onChange = () => { if (getThemePref() === "auto") applyDisplayPrefs(); };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function getTextSize(): TextSize {
  const saved = read(TEXT_KEY);
  return saved === "pequena" || saved === "grande" || saved === "muy-grande" ? saved : "normal";
}

export function setTextSize(size: TextSize) {
  write(TEXT_KEY, size);
  applyDisplayPrefs();
}

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}
