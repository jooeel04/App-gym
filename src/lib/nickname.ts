// Nombre o apodo con el que la app se dirige a cada persona. Se guarda en el dispositivo
// (para tenerlo al instante y sin conexión) y, con cuenta, también en ella (profiles).

const EVENT = "rutina-nickname";
const keyFor = (account: string | null) => "rutina:nickname:" + (account ?? "local");

export function readNickname(account: string | null): string | null {
  try {
    return localStorage.getItem(keyFor(account))?.trim() || null;
  } catch {
    return null;
  }
}

export function storeNickname(account: string | null, name: string) {
  try {
    localStorage.setItem(keyFor(account), name);
  } catch {
    // Sin almacenamiento se usa mientras la app esté abierta.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeNickname(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// Apodo válido: sin espacios de sobra, de 1 a 30 letras.
export const cleanNickname = (v: string) => v.trim().replace(/\s+/g, " ").slice(0, 30);

// Cambio de apodo hecho sin conexión que aún no ha llegado a la cuenta: al abrir la app
// se sube el del dispositivo (y no se pisa con el antiguo de la cuenta).
const dirtyKey = (account: string | null) => keyFor(account) + ":pendiente";
export function nicknamePending(account: string | null) {
  try {
    return localStorage.getItem(dirtyKey(account)) === "1";
  } catch {
    return false;
  }
}
export function setNicknamePending(account: string | null, pending: boolean) {
  try {
    if (pending) localStorage.setItem(dirtyKey(account), "1");
    else localStorage.removeItem(dirtyKey(account));
  } catch {
    // Sin almacenamiento no se recuerda.
  }
}
