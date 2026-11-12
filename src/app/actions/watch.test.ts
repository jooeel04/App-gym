// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase simulado: lo que se escribe en programs (con la sesión de la persona).
const update = vi.fn();
const select = vi.fn();
const db = {
  from: () => ({
    update: (row: unknown) => { update(row); return { eq: () => ({ select: async () => ({ data: [{ id: "p1" }], error: null }) }) }; },
    select: (cols: string) => { select(cols); return { maybeSingle: async () => ({ data: { watch_token_hash: "a".repeat(64) }, error: null }) }; },
  }),
};
let user: { id: string; email: string } | null = { id: "u1", email: "x@y.z" };
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => db, getCurrentUser: async () => user }));

const { createWatchToken, deleteWatchToken, watchTokenStatus } = await import("./watch");

// Spec ajustes R9: la clave del atajo de iPhone.
describe("Clave del atajo de iPhone", () => {
  beforeEach(() => { vi.clearAllMocks(); user = { id: "u1", email: "x@y.z" }; });

  it("«Crear mi clave» devuelve una clave nueva y guarda solo su SHA-256", async () => {
    const res = await createWatchToken();
    expect(res.ok).toBe(true);
    expect(res.data).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const hash = createHash("sha256").update(res.data!).digest("hex");
    expect(update).toHaveBeenCalledWith({ watch_token_hash: hash });
    // Cada vez, una distinta.
    expect((await createWatchToken()).data).not.toBe(res.data);
  });

  it("«Borrar clave» la quita", async () => {
    expect((await deleteWatchToken()).ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ watch_token_hash: null });
  });

  it("dice si hay una clave activa, sin enseñarla", async () => {
    expect(await watchTokenStatus()).toEqual({ ok: true, data: true });
  });

  it("sin sesión no hace nada", async () => {
    user = null;
    expect((await createWatchToken()).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
