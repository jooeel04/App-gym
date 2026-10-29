// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { signUp: vi.fn(), signInWithPassword: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "https://app.test" }) }));
const redirect = vi.fn((to: string) => { throw new Error("REDIRECT " + to); });
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const { authenticate } = await import("./actions");

const form = (intent: string) => {
  const f = new FormData();
  f.set("email", "joel@test.com");
  f.set("password", "secreto1");
  f.set("intent", intent);
  return f;
};

describe("Login · si la cuenta ya existe, entra en vez de dar error", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("«Crear cuenta» con un correo que ya tiene cuenta y la contraseña buena: entra", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists" } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(authenticate({}, form("signup"))).rejects.toThrow("REDIRECT");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "joel@test.com", password: "secreto1" });
    expect(redirect).toHaveBeenCalledWith("/entrenar");
  });

  it("Supabase a veces no da error pero devuelve la cuenta sin identidades (ya existía): entra", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(authenticate({}, form("signup"))).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrenar");
  });

  it("si la contraseña no es la de esa cuenta, lo explica", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists" } });
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const res = await authenticate({}, form("signup"));
    expect(res.error).toMatch(/Ya tienes cuenta con ese correo/);
    expect(redirect).not.toHaveBeenCalled();
  });
});
