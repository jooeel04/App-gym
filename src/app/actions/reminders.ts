"use server";

import { DEFAULT_REMINDER, type PushSubscriptionData, type ReminderSettings } from "@/lib/push";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

// Recordatorio diario: guardar la configuración y el dispositivo que recibe el aviso.
// Todo con la sesión del usuario (RLS: cada uno solo ve lo suyo).

export interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const fail = (error: string) => ({ ok: false, error });
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isMode = (v: unknown): v is ReminderSettings["mode"] => v === "daily" || v === "training" || v === "custom";

function isTimezone(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

function isSubscription(v: unknown): v is PushSubscriptionData {
  const s = v as PushSubscriptionData;
  return !!s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && s.endpoint.length <= 1000
    && typeof s.p256dh === "string" && s.p256dh.length <= 200 && typeof s.auth === "string" && s.auth.length <= 100;
}

async function session() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesión caducada: vuelve a iniciar sesión");
  return { user, db: await createSupabaseServerClient() };
}

export async function getReminder(): Promise<Result<ReminderSettings>> {
  const { db } = await session();
  const { data, error } = await db.from("reminders").select("enabled, time_of_day, mode, weekdays, skip_if_trained").maybeSingle();
  if (error) return fail("No se pudo cargar el recordatorio.");
  if (!data) return { ok: true, data: DEFAULT_REMINDER };
  return {
    ok: true,
    data: { enabled: data.enabled, time: String(data.time_of_day).slice(0, 5), mode: data.mode, weekdays: data.weekdays, skipIfTrained: data.skip_if_trained },
  };
}

// Guarda (o renueva) el dispositivo que recibe el aviso. Lo llama la app al abrirse,
// porque el navegador cambia la suscripción de vez en cuando.
export async function registerDevice(subscription: unknown): Promise<Result<null>> {
  if (!isSubscription(subscription)) return fail("El dispositivo no es válido.");
  const { user, db } = await session();
  return storeDevice(db, user.id, subscription);
}

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
async function storeDevice(db: Db, userId: string, subscription: PushSubscriptionData): Promise<Result<null>> {
  // Un mismo dispositivo puede haber estado en otra cuenta: se borra y se vuelve a crear.
  await db.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  const { error } = await db.from("push_subscriptions").upsert({ endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, user_id: userId });
  return error ? fail("No se pudo activar el aviso en este móvil (puede que esté guardado en otra cuenta).") : { ok: true, data: null };
}

// Guarda la configuración; si llega `subscription`, también este dispositivo.
export async function saveReminder(settings: unknown, timezone: unknown, subscription?: unknown): Promise<Result<null>> {
  const s = settings as ReminderSettings;
  if (!s || typeof s.enabled !== "boolean" || !isTime(s.time) || !isMode(s.mode) || typeof s.skipIfTrained !== "boolean"
    || !Array.isArray(s.weekdays) || s.weekdays.length > 7 || !s.weekdays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    return fail("La configuración no es válida.");
  }
  if (!isTimezone(timezone)) return fail("Zona horaria no válida.");
  if (subscription !== undefined && !isSubscription(subscription)) return fail("El dispositivo no es válido.");
  if (s.mode === "custom" && s.weekdays.length === 0) return fail("Elige al menos un día.");

  const { user, db } = await session();
  if (subscription) {
    const stored = await storeDevice(db, user.id, subscription);
    if (!stored.ok) return stored;
  }
  const { error } = await db.from("reminders").upsert({
    user_id: user.id,
    enabled: s.enabled,
    time_of_day: s.time,
    mode: s.mode,
    weekdays: [...new Set(s.weekdays)].sort((a, b) => a - b),
    skip_if_trained: s.skipIfTrained,
    timezone,
  });
  if (error) return fail(error.code === "42P01" || error.code === "PGRST205" ? "Falta preparar la base de datos para los recordatorios." : "No se pudo guardar el recordatorio.");
  return { ok: true, data: null };
}
