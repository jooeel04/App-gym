// Permisos que necesita la app para avisar del descanso:
// - Notificaciones: el aviso llega aunque la app esté en segundo plano.
// - Sonido: iOS solo deja sonar audio después de un toque (unlockAudio).
// - Almacenamiento persistente: el navegador no borra los datos guardados sin conexión.
// Los navegadores solo dejan pedirlos al tocar un botón, así que se llama desde uno.

import { unlockAudio } from "./alerts";

export type NotifyState = "granted" | "denied" | "default" | "unsupported";

const PERMISSION_EVENT = "rutina-permission";

export function notifyState(): NotifyState {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export function subscribePermission(onChange: () => void) {
  window.addEventListener(PERMISSION_EVENT, onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener(PERMISSION_EVENT, onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// iPhone/iPad: las notificaciones web solo existen con la app añadida a la pantalla de inicio.
export function needsHomeScreen() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

// Pide todo lo necesario. Llamar dentro del toque de un botón.
export async function requestPermissions(): Promise<NotifyState> {
  unlockAudio();
  navigator.storage?.persist?.().catch(() => {});
  if (notifyState() !== "default") return notifyState();
  try {
    await Notification.requestPermission();
  } catch {
    // Navegadores antiguos: sin promesa; el estado se vuelve a leer abajo.
  }
  window.dispatchEvent(new Event(PERMISSION_EVENT));
  return notifyState();
}

// Notificación del sistema (con la app en segundo plano). Devuelve si se mostró.
export async function showNotification(title: string, body: string) {
  if (notifyState() !== "granted") return false;
  // `vibrate` y `renotify` funcionan en Android aunque no estén en los tipos de TypeScript.
  const options = { body, tag: "rutina-rest", renotify: true, icon: "/fitgym-192.png", badge: "/fitgym-192.png", vibrate: [250, 120, 250, 120, 400] } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
