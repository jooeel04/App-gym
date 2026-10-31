import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec ajustes G2, G7: la app pide a Supabase entrar con Google (o conectarlo a la cuenta
// abierta) y vuelve por /auth/google. El viaje real a Google no se prueba aquí.
const auth = {
  signInWithOAuth: vi.fn(),
  linkIdentity: vi.fn(),
  getUserIdentities: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://app.test" }) }));
const redirect = vi.fn((url: string) => { throw new Error("REDIRECT " + url); });
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { googleStatus, linkGoogle, signInWithGoogle } = await import("./account");

describe("Entrar con Google", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre Google y pide volver a /auth/google", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://google.test/elige" }, error: null });
    await expect(signInWithGoogle()).rejects.toThrow("REDIRECT https://google.test/elige");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://app.test/auth/google" } });
  });

  it("si Supabase no puede, vuelve al acceso con el aviso de Google", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { code: "validation_failed" } });
    await expect(signInWithGoogle()).rejects.toThrow("REDIRECT /login?error=google");
  });
});

describe("Conectar Google a la cuenta abierta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enlaza Google a esta cuenta y vuelve a Ajustes", async () => {
    auth.linkIdentity.mockResolvedValue({ data: { url: "https://google.test/elige" }, error: null });
    await expect(linkGoogle()).rejects.toThrow("REDIRECT https://google.test/elige");
    expect(auth.linkIdentity).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://app.test/auth/google?next=/ajustes" } });
  });

  it("si no está activado en Supabase lo dice claro", async () => {
    auth.linkIdentity.mockResolvedValue({ data: { url: null }, error: { code: "manual_linking_disabled" } });
    await expect(linkGoogle()).resolves.toEqual({ error: "Conectar Google aún no está activado. Inténtalo más tarde." });
  });

  it("sabe si la cuenta ya tiene Google", async () => {
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [{ provider: "email" }, { provider: "google" }] }, error: null });
    await expect(googleStatus()).resolves.toEqual({ linked: true });
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [{ provider: "email" }] }, error: null });
    await expect(googleStatus()).resolves.toEqual({ linked: false });
  });
});
