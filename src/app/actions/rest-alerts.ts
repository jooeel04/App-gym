"use server";

import type { PushSubscriptionData } from "@/lib/push";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

// Aviso del fin del descanso por notificación push (ver /api/rest-alerts). Con la
// sesión del usuario (RLS: cada uno solo su aviso).

export interface Result {
  ok: boolean;
  error?: string;
}

function isSubscription(v: unknown): v is PushSubscriptionData {
  const s = v as PushSubscriptionData;
  return !!s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && s.endpoint.length <= 1000
    && typeof s.p256dh === "string" && s.p256dh.length <= 200 && typeof s.auth === "string" && s.auth.length <= 100;
}

// Apunta el aviso: dentro de `seconds` segundos, a este móvil. `before` > 0: es el aviso
// de «quedan X s». Sustituye al aviso anterior.
export async function scheduleRestAlert(device: unknown, seconds: unknown, before: unknown): Promise<Result> {
  if (!isSubscription(device)) return { ok: false, error: "El dispositivo no es válido." };
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 1 || seconds > 1200) return { ok: false, error: "Tiempo no válido." };
  if (typeof before !== "number" || !Number.isInteger(before) || before < 0 || before > 60) return { ok: false, error: "Tiempo no válido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  // El móvil tiene que estar apuntado en la cuenta (es de donde salen sus claves).
  await db.from("push_subscriptions").delete().eq("endpoint", device.endpoint);
  const stored = await db.from("push_subscriptions").upsert({ endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth, user_id: user.id });
  if (stored.error) return { ok: false, error: "No se pudo apuntar este móvil." };
  const { error } = await db.from("rest_alerts").upsert({
    user_id: user.id,
    endpoint: device.endpoint,
    due_at: new Date(Date.now() + seconds * 1000).toISOString(),
    kind: before > 0 ? "before" : "end",
    before_s: before,
    claimed_at: null,
  });
  return error ? { ok: false, error: error.code === "42P01" || error.code === "PGRST205" ? "Falta preparar la base de datos para los avisos del descanso." : "No se pudo apuntar el aviso." } : { ok: true };
}

// Se saltó el descanso: ya no hay que avisar.
export async function cancelRestAlert(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sin sesión" };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("rest_alerts").delete().eq("user_id", user.id);
  return error ? { ok: false, error: "No se pudo quitar el aviso." } : { ok: true };
}
