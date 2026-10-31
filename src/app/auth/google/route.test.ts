import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec ajustes G2, G4, G7: vuelta desde Google (entrar o conectar).
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }) }));
const { GET } = await import("./route");

const back = async (query: string) => {
  const res = await GET(new NextRequest("https://app.test/auth/google" + query));
  const to = new URL(res.headers.get("location")!);
  return to.pathname + to.search;
};

describe("Vuelta desde Google", () => {
  beforeEach(() => vi.clearAllMocks());

  it("con el código abre la sesión y entra en Hoy", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await back("?code=abc")).toBe("/entrenar");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("si se cancela, vuelve al acceso con el aviso de Google (no el de enlace caducado)", async () => {
    expect(await back("?error=access_denied&error_description=cancelado")).toBe("/login?error=google");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("si el código no vale, también avisa de Google", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code_verifier" } });
    expect(await back("?code=abc")).toBe("/login?error=google");
  });

  it("al conectar Google desde Ajustes, vuelve a Ajustes", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await back("?code=abc&next=/ajustes")).toBe("/ajustes?google=conectado");
  });

  it("si ese Google ya tiene otra cuenta, lo dice en Ajustes", async () => {
    expect(await back("?next=/ajustes&error=server_error&error_code=identity_already_exists")).toBe("/ajustes?google=ocupado");
  });

  it("no lleva fuera de la app", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await back("?code=abc&next=//malo.test")).toBe("/entrenar");
  });
});
