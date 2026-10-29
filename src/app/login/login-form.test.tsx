import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm, NewPasswordForm } from "./login-form";

// Las Server Actions no se ejecutan en estas pruebas.
vi.mock("./actions", () => ({ authenticate: vi.fn(async () => ({})), requestPasswordReset: vi.fn(async () => ({})) }));

describe("Acceso a la cuenta", () => {
  it("la contraseña se puede mostrar y volver a ocultar", () => {
    render(<LoginForm confirmationFailed={false} />);
    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    // Botón conmutador: el nombre no cambia, cambia su estado (así lo anuncia el lector).
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Mostrar contraseña");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("el botón del ojo no envía el formulario", () => {
    render(<LoginForm confirmationFailed={false} />);
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute("type", "button");
  });

  it("mantiene lo que necesitan los gestores de contraseñas", () => {
    render(<LoginForm confirmationFailed={false} />);
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("name", "password");
  });

  it("al crear una contraseña nueva, cada campo tiene su propio botón para verla", () => {
    render(<NewPasswordForm action={vi.fn(async () => ({}))} />);
    const toggles = screen.getAllByRole("button", { name: "Mostrar contraseña" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[1]);
    expect(screen.getByLabelText("Repite la contraseña")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Contraseña nueva")).toHaveAttribute("type", "password");
  });

  it("el botón Ir del teclado entra (no crea cuenta): «Entrar» es el primer botón de enviar", () => {
    render(<LoginForm confirmationFailed={false} />);
    const form = screen.getByRole("button", { name: "Entrar" }).closest("form")!;
    expect(form.querySelector<HTMLButtonElement>('button[type="submit"]')?.value).toBe("signin");
  });
});
