// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: true, supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "pk" }));

const { POST } = await import("./route");
const TOKEN = "A".repeat(43);
const call = (body: unknown, token = TOKEN) => POST(new Request("https://app/api/reloj", {
  method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body),
}));

// Spec ajustes R10: el buzón del atajo de iPhone.
describe("/api/reloj · kcal del Apple Watch desde el atajo", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: true, error: null }); });

  it("con una clave válida guarda las kcal (redondeadas) de esa fecha", async () => {
    const res = await call({ kcal: 345.7, date: "2026-11-12" });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("log_watch_kcal", { p_token: TOKEN, p_date: "2026-11-12", p_kcal: 346 });
  });

  it("sin fecha, usa la de hoy en España", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T23:30:00Z")); // ya es 13 en España
    await call({ kcal: 300 });
    vi.useRealTimers();
    expect(rpc).toHaveBeenCalledWith("log_watch_kcal", expect.objectContaining({ p_date: "2026-11-13" }));
  });

  it("también acepta las kcal como texto (Atajos a veces manda «345,7»)", async () => {
    await call({ kcal: "345,7", date: "2026-11-12" });
    expect(rpc).toHaveBeenCalledWith("log_watch_kcal", expect.objectContaining({ p_kcal: 346 }));
  });

  it("una clave que no existe responde 401", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await call({ kcal: 300 })).status).toBe(401);
  });

  it("sin clave o con un formato raro responde 401 sin preguntar a la base de datos", async () => {
    expect((await call({ kcal: 300 }, "corta")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("kcal fuera de 1–9999 o fecha rara responde 400", async () => {
    for (const body of [{ kcal: 0 }, { kcal: 10000 }, { kcal: "mucho" }, {}, { kcal: 300, date: "12/11/2026" }]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
