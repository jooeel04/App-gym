import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/push";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Aviso del fin del descanso. Lo llama Supabase (dispatch_rest_alerts, cada 2 segundos)
// solo cuando hay algún descanso que acaba. Recoge esos avisos (take_rest_alerts, que
// comprueba el secreto) y manda la notificación push: en el iPhone suena y vibra aunque
// la app esté en segundo plano o el móvil bloqueado.

export const maxDuration = 15;

interface RestAlert {
  endpoint: string;
  p256dh: string;
  auth: string;
  kind: "end" | "before";
  before_s: number;
  vapid_private: string | null;
}

export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!isSupabaseConfigured || !/^[0-9a-f]{64}$/.test(secret)) return new Response("Forbidden", { status: 403 });

  const db = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await db.rpc("take_rest_alerts", { p_secret: secret });
  if (res.error) return new Response("Forbidden", { status: 403 });

  let sent = 0;
  await Promise.all(((res.data ?? []) as RestAlert[]).map(async (a) => {
    if (!a.vapid_private) return;
    const payload = JSON.stringify(a.kind === "before"
      ? { title: "Quedan " + a.before_s + " s de descanso", body: "Prepárate para la siguiente serie", url: "/entrenar", tag: "rutina-rest" }
      : { title: "¡Descanso terminado!", body: "A por la siguiente serie", url: "/entrenar", tag: "rutina-rest" });
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
        vapidDetails: { subject: "https://app-gym-swart.vercel.app", publicKey: VAPID_PUBLIC_KEY, privateKey: a.vapid_private },
        // Si no llega en un minuto ya no sirve.
        TTL: 60,
        urgency: "high",
      });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.rpc("drop_push_subscription", { p_secret: secret, p_endpoint: a.endpoint });
    }
  }));
  return Response.json({ sent });
}
