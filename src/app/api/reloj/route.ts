import { createClient } from "@supabase/supabase-js";
import { isISODate } from "@/domain/calendar";
import { isWatchKcal } from "@/domain/energy";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Buzón del atajo de iPhone (spec ajustes R10): al terminar un entreno del Apple Watch, el
// atajo manda sus kcal con la clave de la cuenta (Authorization: Bearer <clave>) y
// { kcal, date }. No hay sesión: la función SQL log_watch_kcal comprueba la clave (por su
// hash) y guarda las kcal de ese día en watch_energy.

// Clave de createWatchToken: 32 bytes en base64url.
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Hoy en España (el atajo puede no mandar la fecha).
const todayInSpain = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Atajos manda los números como número o como texto («345,7»); se redondean.
const toKcal = (v: unknown) => Math.round(typeof v === "string" ? Number(v.replace(",", ".")) : Number(v));

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!isSupabaseConfigured || !TOKEN.test(token)) return new Response("Clave no válida", { status: 401 });

  const body = (await request.json().catch(() => null)) as { kcal?: unknown; date?: unknown } | null;
  const kcal = toKcal(body?.kcal);
  const date = body?.date === undefined || body.date === "" ? todayInSpain() : body.date;
  if (!isWatchKcal(kcal) || !isISODate(date)) return new Response("Datos no válidos", { status: 400 });

  const db = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await db.rpc("log_watch_kcal", { p_token: token, p_date: date, p_kcal: kcal });
  if (res.error) return new Response("No se pudo guardar", { status: 500 });
  if (res.data !== true) return new Response("Clave no válida", { status: 401 });
  return Response.json({ ok: true, kcal, date });
}
