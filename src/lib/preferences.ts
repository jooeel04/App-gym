// Preferencias de este dispositivo (no se guardan en la cuenta).

// Cómo avisa el móvil al acabar el descanso.
export type RestAlert = "both" | "vibrate" | "sound" | "off";

export interface RestPrefs {
  enabled: boolean;
  seconds: number;
  alert: RestAlert;
  // Segundos antes del final en que llega el aviso (0 = al terminar).
  before: number;
}

const REST_KEY = "rutina:rest";
const PREFS_EVENT = "rutina-prefs";
export const DEFAULT_REST: RestPrefs = { enabled: true, seconds: 90, alert: "both", before: 0 };
export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];
export const ALERT_OPTIONS: { value: RestAlert; label: string }[] = [
  { value: "both", label: "Vibrar y sonar" },
  { value: "vibrate", label: "Solo vibrar" },
  { value: "sound", label: "Solo sonido" },
  { value: "off", label: "Sin aviso" },
];
export const BEFORE_OPTIONS = [0, 10, 30];

let cached: RestPrefs | null = null;

export function getRestPrefs(): RestPrefs {
  if (cached) return cached;
  try {
    const saved = JSON.parse(localStorage.getItem(REST_KEY) ?? "null") as Partial<RestPrefs> | null;
    cached = { ...DEFAULT_REST, ...saved };
  } catch {
    cached = DEFAULT_REST;
  }
  return cached;
}

export function setRestPrefs(prefs: RestPrefs) {
  cached = prefs;
  try {
    localStorage.setItem(REST_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento la preferencia dura hasta cerrar la app.
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function subscribePrefs(onChange: () => void) {
  window.addEventListener(PREFS_EVENT, onChange);
  return () => window.removeEventListener(PREFS_EVENT, onChange);
}

// 90 → "1:30"; 30 → "30 s".
export const formatRest = (s: number) => (s < 60 ? s + " s" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));

// Calculadora de discos: la barra y los discos que hay en tu gym.
export interface PlatePrefs {
  bar: number;
  plates: number[];
}

const PLATES_KEY = "rutina:discos";
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BAR_OPTIONS = [20, 15, 10, 0];
export const DEFAULT_PLATES: PlatePrefs = { bar: 20, plates: ALL_PLATES };

let cachedPlates: PlatePrefs | null = null;

export function getPlatePrefs(): PlatePrefs {
  if (cachedPlates) return cachedPlates;
  try {
    const saved = JSON.parse(localStorage.getItem(PLATES_KEY) ?? "null") as Partial<PlatePrefs> | null;
    const plates = Array.isArray(saved?.plates) ? ALL_PLATES.filter((p) => saved.plates!.includes(p)) : ALL_PLATES;
    cachedPlates = { bar: BAR_OPTIONS.includes(Number(saved?.bar)) ? Number(saved?.bar) : DEFAULT_PLATES.bar, plates: plates.length ? plates : ALL_PLATES };
  } catch {
    cachedPlates = DEFAULT_PLATES;
  }
  return cachedPlates;
}

export function setPlatePrefs(prefs: PlatePrefs) {
  cachedPlates = { bar: prefs.bar, plates: ALL_PLATES.filter((p) => prefs.plates.includes(p)) };
  try {
    localStorage.setItem(PLATES_KEY, JSON.stringify(cachedPlates));
  } catch {
    // Sin almacenamiento la preferencia dura hasta cerrar la app.
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
