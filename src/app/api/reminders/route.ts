import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { DAY_NAMES } from "@/domain/snapshot";
import { VAPID_PUBLIC_KEY } from "@/lib/push";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Envío de los recordatorios diarios. Lo llama Supabase (pg_cron) cada 5 minutos con
// su secreto en la cabecera Authorization. No usa la clave secreta de Supabase: el
// secreto lo comprueba la propia base de datos en pending_reminders(), que devuelve los
// dispositivos a los que les toca el aviso y la clave privada VAPID para firmarlo.
// Solo se marcan como enviados (mark_reminders_sent) los avisos que de verdad salieron:
// si uno falla, se reintenta en la siguiente vuelta (durante 2 horas desde su hora).
// Si la base de datos aún no tiene la migración 20261105 (sin pending_reminders), se usa
// due_reminders(), que marca al pedir la lista, como antes.

export const maxDuration = 30;

interface Due {
  user_id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  routine_day: number | null;
  vapid_private: string | null;
  is_test?: boolean; // aviso de prueba pedido desde Ajustes
}

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!isSupabaseConfigured || !/^[0-9a-f]{64}$/.test(secret)) return new Response("Forbidden", { status: 403 });

  const db = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let res = await db.rpc("pending_reminders", { p_secret: secret });
  const legacy = !!res.error && (res.error.code === "PGRST202" || res.error.code === "42883");
  if (legacy) res = await db.rpc("due_reminders", { p_secret: secret });
  if (res.error) return new Response("Forbidden", { status: 403 });

  const due = (res.data ?? []) as Due[];
  const delivered = new Set<string>();
  // Resultado de cada envío, para ver en Ajustes por qué no llega (null = salió bien).
  // Con varios móviles, basta con que llegue a uno.
  const log = new Map<string, string | null>();
  let sent = 0;
  for (const d of due) {
    if (!d.vapid_private) return Response.json({ sent, error: "Falta la clave privada VAPID en private.settings" }, { status: 500 });
    const name = d.routine_day ? DAY_NAMES[d.routine_day] : null;
    const payload = JSON.stringify(d.is_test
      ? { title: "Prueba de FitGym", body: "¡Funciona! Así te llegará el recordatorio para entrenar.", url: "/ajustes" }
      : {
          title: name ? "Hoy toca " + name : "¿Entrenas hoy?",
          body: name ? "Abre FitGym y empieza tu entreno." : "Abre FitGym y anota tu entreno de hoy.",
          url: "/entrenar",
        });
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
        vapidDetails: { subject: "https://app-gym-swart.vercel.app", publicKey: VAPID_PUBLIC_KEY, privateKey: d.vapid_private },
        TTL: 60 * 60 * 2,
        // Alta: el iPhone y Android lo entregan enseguida aunque estén ahorrando batería.
        urgency: "high",
      });
      sent++;
      if (d.user_id) { delivered.add(d.user_id); log.set(d.user_id, null); }
    } catch (e) {
      // El móvil ya no acepta avisos (se desinstaló la app, se quitó el permiso o caducó su
      // suscripción): se borra. La app lo vuelve a registrar al abrirse.
      const { statusCode: status, body, message } = e as { statusCode?: number; body?: string; message?: string };
      if (d.user_id && !delivered.has(d.user_id)) log.set(d.user_id, (status ? status + " " + (body ?? "").trim() : message ?? "Error").trim().slice(0, 300));
      if (status === 404 || status === 410) await db.rpc("drop_push_subscription", { p_secret: secret, p_endpoint: d.endpoint });
    }
  }
  if (!legacy && delivered.size) await db.rpc("mark_reminders_sent", { p_secret: secret, p_users: [...delivered] });
  // Sin la migración 20261108 no existe: no pasa nada.
  if (!legacy && log.size) await db.rpc("log_reminder_attempts", { p_secret: secret, p_log: [...log].map(([user_id, error]) => ({ user_id, error })) });
  return Response.json({ sent });
}
