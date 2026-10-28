// Entreno en curso en este dispositivo: qué día se está entrenando y desde cuándo.
// Se guarda en el dispositivo (no en la cuenta) para que siga al recargar la app;
// si empezó hace más de 6 h se da por abandonado.

export interface ActiveWorkout {
  week: number;
  day: number;
  startedAt: number;
}

const KEY = "rutina:active";
const EVENT = "rutina-active";
const MAX_MS = 6 * 3600_000;

let cached: ActiveWorkout | null | undefined;

export function getActiveWorkout(): ActiveWorkout | null {
  if (cached === undefined) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as ActiveWorkout | null;
      cached = saved && saved.week > 0 && saved.day > 0 && saved.startedAt > 0 ? saved : null;
    } catch {
      cached = null;
    }
  }
  if (cached && Date.now() - cached.startedAt > MAX_MS) {
    cached = null;
    try { localStorage.removeItem(KEY); } catch { /* Nada que limpiar. */ }
  }
  return cached;
}

export function setActiveWorkout(active: ActiveWorkout | null) {
  cached = active;
  try {
    if (active) localStorage.setItem(KEY, JSON.stringify(active));
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento el entreno en curso dura hasta cerrar la app.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeActiveWorkout(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
