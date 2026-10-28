// Preferencias de este dispositivo (no se guardan en la cuenta).

export interface RestPrefs {
  enabled: boolean;
  seconds: number;
}

const REST_KEY = "rutina:rest";
const PREFS_EVENT = "rutina-prefs";
export const DEFAULT_REST: RestPrefs = { enabled: true, seconds: 90 };
export const REST_OPTIONS = [60, 90, 120, 150, 180];

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
