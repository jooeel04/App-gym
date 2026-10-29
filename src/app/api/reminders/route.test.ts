// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase y el servicio de notificaciones, simulados.
const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: true, supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "pk" }));
const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

const { POST } = await import("./route");
const SECRET = "a".repeat(64);
const call = () => POST(new Request("https://app/api/reminders", { method: "POST", headers: { authorization: "Bearer " + SECRET } }));
const device = (user: string, endpoint: string) => ({ user_id: user, endpoint, p256dh: "k", auth: "a", routine_day: 3, vapid_private: "priv" });

describe("/api/reminders · los avisos se marcan como enviados solo si llegan", () => {
  beforeEach(() => { rpc.mockReset(); sendNotification.mockReset(); });

  it("marca como enviados solo a quien le llegó; el que falló se reintenta en la siguiente vuelta", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "pending_reminders"
      ? { data: [device("u1", "https://push/1"), device("u2", "https://push/2")], error: null }
      : { data: null, error: null }));
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === "https://push/2") throw Object.assign(new Error("caído"), { statusCode: 503 });
    });
    const res = await call();
    expect(await res.json()).toMatchObject({ sent: 1 });
    expect(rpc).toHaveBeenCalledWith("mark_reminders_sent", { p_secret: SECRET, p_users: ["u1"] });
  });

  it("borra el móvil que ya no acepta avisos (410) y no lo cuenta como enviado", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "pending_reminders" ? { data: [device("u1", "https://push/viejo")], error: null } : { data: null, error: null }));
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await call();
    expect(rpc).toHaveBeenCalledWith("drop_push_subscription", { p_secret: SECRET, p_endpoint: "https://push/viejo" });
    expect(rpc).not.toHaveBeenCalledWith("mark_reminders_sent", expect.anything());
  });

  it("manda el aviso con prioridad alta (el iPhone no lo retrasa)", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "pending_reminders" ? { data: [device("u1", "https://push/1")], error: null } : { data: null, error: null }));
    await call();
    expect(sendNotification.mock.calls[0][2]).toMatchObject({ urgency: "high" });
  });

  it("sin la migración nueva sigue funcionando como antes (due_reminders)", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "pending_reminders"
      ? { data: null, error: { code: "PGRST202", message: "no existe" } }
      : fn === "due_reminders" ? { data: [{ ...device("u1", "https://push/1"), user_id: undefined }], error: null } : { data: null, error: null }));
    const res = await call();
    expect(await res.json()).toMatchObject({ sent: 1 });
  });

  it("con otra clave responde 403", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    const res = await POST(new Request("https://app/api/reminders", { method: "POST", headers: { authorization: "Bearer " + "b".repeat(64) } }));
    expect(res.status).toBe(403);
  });
});
