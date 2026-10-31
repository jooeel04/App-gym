import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { googleStatus, linkGoogle } from "@/app/actions/account";
import { GoogleRow } from "./google-row";

vi.mock("@/app/actions/account", () => ({
  googleStatus: vi.fn(async () => ({ linked: false })),
  linkGoogle: vi.fn(() => new Promise(() => {})),
}));

// Spec ajustes G7: en Ajustes → Cuenta se conecta Google a la cuenta abierta.
describe("Ajustes · Conectar con Google", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("sin Google, ofrece conectarlo", async () => {
    render(<GoogleRow />);
    fireEvent.click(await screen.findByRole("button", { name: /Conectar con Google/ }));
    expect(linkGoogle).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Abriendo Google…/ })).toBeDisabled();
  });

  it("con Google ya conectado, lo dice y no ofrece el botón", async () => {
    vi.mocked(googleStatus).mockResolvedValueOnce({ linked: true });
    render(<GoogleRow />);
    expect(await screen.findByText("Google conectado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conectar con Google/ })).not.toBeInTheDocument();
  });

  it("si al volver ese Google ya tenía otra cuenta, avisa", async () => {
    window.history.replaceState(null, "", "/ajustes?google=ocupado");
    render(<GoogleRow />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ese Google ya tiene otra cuenta en RUTINA");
    // El aviso se lee una vez: la dirección se limpia.
    expect(window.location.search).toBe("");
  });

  it("si conectar falla, enseña el motivo", async () => {
    vi.mocked(linkGoogle).mockResolvedValueOnce({ error: "Conectar Google aún no está activado. Inténtalo más tarde." });
    render(<GoogleRow />);
    fireEvent.click(await screen.findByRole("button", { name: /Conectar con Google/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("aún no está activado");
  });
});
