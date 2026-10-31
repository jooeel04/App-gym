import { fireEvent, render, screen } from "@testing-library/react";
import { signInWithGoogle } from "@/app/actions/account";
import { describe, expect, it, vi } from "vitest";
import { LoginForm, NewPasswordForm } from "./login-form";

// Las Server Actions no se ejecutan en estas pruebas.
vi.mock("./actions", () => ({ authenticate: vi.fn(async () => ({})), requestPasswordReset: vi.fn(async () => ({})) }));
// Entrar con Google se queda "abriendo" (no hay Google en las pruebas).
vi.mock("@/app/actions/account", () => ({ signInWithGoogle: vi.fn(() => new Promise(() => {})) }));

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

// Spec ajustes G1, G4, G5, G7.
describe("Acceso · entrar con Google", () => {
  it("«Continuar con Google» va arriba, antes del formulario del correo", () => {
    render(<LoginForm confirmationFailed={false} />);
    const google = screen.getByRole("button", { name: "Continuar con Google" });
    const email = screen.getByLabelText("Correo electrónico");
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("o con tu correo")).toBeInTheDocument();
  });

  it("explica qué hacer si la cuenta es de otro correo", () => {
    render(<LoginForm confirmationFailed={false} />);
    expect(screen.getByText(/Ya tienes cuenta con otro correo/)).toHaveTextContent("Entra con él y conecta Google desde Ajustes");
  });

  it("mientras se abre Google no se puede pulsar otra vez", async () => {
    render(<LoginForm confirmationFailed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    expect(await screen.findByRole("button", { name: "Abriendo Google…" })).toBeDisabled();
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("si Google falló, lo dice con su propio aviso", () => {
    render(<LoginForm confirmationFailed={false} googleFailed />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo entrar con Google. Inténtalo de nuevo.");
  });
});
