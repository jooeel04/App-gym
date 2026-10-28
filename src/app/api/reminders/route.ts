import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { DAY_NAMES } from "@/domain/snapshot";
import { VAPID_PUBLIC_KEY } from "@/lib/push";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Envío de los recordatorios diarios. Lo llama Supabase (pg_cron) cada 5 minutos con
// su secreto en la cabecera Authorization. No usa la clave secreta de Supabase: el
// secreto lo comprueba la propia base de datos en due_reminders(), que devuelve los
// dispositivos a los que les toca el aviso y la clave privada VAPID para firmarlo.

interface Due {
  endpoint: string;
  p256dh: string;
  auth: string;
  routine_day: number | null;
  vapid_private: string | null;
}

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!isSupabaseConfigured || !/^[0-9a-f]{64}$/.test(secret)) return new Response("Forbidden", { status: 403 });

  const db = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("due_reminders", { p_secret: secret });
  if (error) return new Response("Forbidden", { status: 403 });

  const due = (data ?? []) as Due[];
  let sent = 0;
  for (const d of due) {
    if (!d.vapid_private) return Response.json({ sent, error: "Falta la clave privada VAPID en private.settings" }, { status: 500 });
    const name = d.routine_day ? DAY_NAMES[d.routine_day] : null;
    const payload = JSON.stringify({
      title: name ? "Hoy toca " + name : "¿Entrenas hoy?",
      body: name ? "Abre RUTINA y empieza tu entreno." : "Abre RUTINA y anota tu entreno de hoy.",
      url: "/entrenar",
    });
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
        vapidDetails: { subject: "https://app-gym-swart.vercel.app", publicKey: VAPID_PUBLIC_KEY, privateKey: d.vapid_private },
        TTL: 60 * 60 * 2,
        urgency: "normal",
      });
      sent++;
    } catch (e) {
      // El móvil ya no acepta avisos (se desinstaló la app o se quitó el permiso).
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.rpc("drop_push_subscription", { p_secret: secret, p_endpoint: d.endpoint });
    }
  }
  return Response.json({ sent });
}
