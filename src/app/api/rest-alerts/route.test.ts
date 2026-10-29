// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: true, supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "pk" }));
const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

const { POST } = await import("./route");
const SECRET = "a".repeat(64);
const call = (secret = SECRET) => POST(new Request("https://app/api/rest-alerts", { method: "POST", headers: { authorization: "Bearer " + secret } }));
const alert = (kind: string, before = 0) => ({ endpoint: "https://push/1", p256dh: "k", auth: "a", kind, before_s: before, vapid_private: "priv" });

describe("/api/rest-alerts · aviso del fin del descanso", () => {
  beforeEach(() => { rpc.mockReset(); sendNotification.mockReset(); });

  it("manda «Descanso terminado» con prioridad alta y la etiqueta del descanso", async () => {
    rpc.mockResolvedValue({ data: [alert("end")], error: null });
    const res = await call();
    expect(await res.json()).toEqual({ sent: 1 });
    const [sub, payload, options] = sendNotification.mock.calls[0];
    expect(sub).toEqual({ endpoint: "https://push/1", keys: { p256dh: "k", auth: "a" } });
    expect(JSON.parse(payload)).toMatchObject({ title: "¡Descanso terminado!", tag: "rutina-rest" });
    expect(options).toMatchObject({ urgency: "high" });
  });

  it("el aviso de antes dice cuánto queda", async () => {
    rpc.mockResolvedValue({ data: [alert("before", 10)], error: null });
    await call();
    expect(JSON.parse(sendNotification.mock.calls[0][1]).title).toBe("Quedan 10 s de descanso");
  });

  it("con otra clave responde 403", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect((await call("b".repeat(64))).status).toBe(403);
  });

  it("si el móvil ya no acepta avisos, lo borra", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "take_rest_alerts" ? { data: [alert("end")], error: null } : { data: null, error: null }));
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await call();
    expect(rpc).toHaveBeenCalledWith("drop_push_subscription", { p_secret: SECRET, p_endpoint: "https://push/1" });
  });
});
