// Clave pública VAPID: identifica a la app ante el servicio de notificaciones del
// móvil. Es pública (va al navegador); la privada está solo en Supabase
// (private.settings, clave 'vapid_private').
export const VAPID_PUBLIC_KEY = "BMADSPK1coZQT5q26cy44GSmVm1wrWCB5AcrRW2a8p0aTSx87evcIttEY_aQEsW2Hlm3IV-nnREDPDpPL50B02Q";

export type ReminderMode = "daily" | "training" | "custom";

export interface ReminderSettings {
  enabled: boolean;
  time: string; // "HH:MM"
  mode: ReminderMode;
  weekdays: number[]; // 1 = lunes … 7 = domingo (modo "custom")
  skipIfTrained: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: "18:00", mode: "training", weekdays: [1, 2, 3, 4, 5], skipIfTrained: true };

// Clave en base64url → bytes, como la pide pushManager.subscribe.
function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Suscribe este dispositivo a las notificaciones push (hace falta el permiso de
// notificaciones). Devuelve null si el navegador no lo permite.
export async function subscribeThisDevice(): Promise<PushSubscriptionData | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}
