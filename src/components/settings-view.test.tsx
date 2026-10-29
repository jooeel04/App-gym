import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithWorkout } from "../../tests/workout-fixture";
import { SettingsView } from "./settings-view";
import { PlateCalculator } from "./plate-calculator";

vi.mock("@/app/actions/profile", () => ({ getNickname: vi.fn(async () => ({ ok: true, data: "Joel" })), saveNickname: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/app/actions/reminders", () => ({ getReminder: vi.fn(async () => ({ ok: true, data: null })), saveReminder: vi.fn() }));
const account = vi.hoisted(() => ({
  getLiftPrivacy: vi.fn(async () => ({ ok: true, data: false })),
  saveLiftPrivacy: vi.fn(async (hide: boolean) => ({ ok: true, data: hide })),
  changePassword: vi.fn(async () => ({ ok: true })),
  changeEmail: vi.fn(async () => ({ ok: true })),
  deleteAccount: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/account", () => account);

const open = (label: RegExp) => fireEvent.click(screen.getByRole("button", { name: label }));

describe("Ajustes · apariencia", () => {
  beforeEach(() => { delete document.documentElement.dataset.theme; delete document.documentElement.dataset.text; });

  it("el tema es automático (como el móvil) por defecto, y se puede fijar oscuro o claro", () => {
    renderWithWorkout(<SettingsView />);
    open(/Apariencia/);
    const themes = screen.getByRole("radiogroup", { name: "Tema" });
    expect(within(themes).getByRole("radio", { name: /Automático/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(themes).getByRole("radio", { name: /Claro/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("tamaño de letra: pequeña o grande", () => {
    renderWithWorkout(<SettingsView />);
    open(/Tamaño de letra/);
    fireEvent.click(screen.getByRole("radio", { name: /^Grande/ }));
    expect(document.documentElement.dataset.text).toBe("grande");
    fireEvent.click(screen.getByRole("radio", { name: /^Pequeña/ }));
    expect(document.documentElement.dataset.text).toBe("pequena");
  });

  it("muestra la versión de la app y las novedades", () => {
    renderWithWorkout(<SettingsView />);
    open(/Versión y novedades/);
    expect(screen.getByText(/Novedades/)).toBeInTheDocument();
  });
});

describe("Ajustes · calculadora de discos", () => {
  it("la barra y los discos que elijas son los que usa la calculadora", () => {
    renderWithWorkout(<SettingsView />);
    open(/Calculadora de discos/);
    fireEvent.click(within(screen.getByRole("group", { name: "Tu barra" })).getByRole("button", { name: "15 kg" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Discos de tu gym" })).getByRole("button", { name: "25 kg" }));
    renderWithWorkout(<PlateCalculator initialTotal="115" onClose={() => {}} />);
    expect(screen.getAllByRole("button", { name: "15 kg" }).at(-1)).toHaveAttribute("aria-pressed", "true");
    // 115 con barra de 15 = 50 por lado, sin discos de 25: 20 + 20 + 10.
    const side = within(screen.getByRole("list", { name: "Discos en cada lado" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(side).toEqual(["2 × 20 kg", "1 × 10 kg"]);
  });
});

describe("Ajustes · cuenta y privacidad", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puedes dejar de salir en «Quién levanta más»", async () => {
    renderWithWorkout(<SettingsView />, undefined, "cloud");
    open(/Privacidad en Social/);
    const sw = await screen.findByRole("switch", { name: /Salir en «Quién levanta más»/ });
    await waitFor(() => expect(sw).toBeChecked());
    fireEvent.click(sw);
    await waitFor(() => expect(account.saveLiftPrivacy).toHaveBeenCalledWith(true));
  });

  it("cambiar la contraseña", async () => {
    renderWithWorkout(<SettingsView />, undefined, "cloud");
    open(/Cambiar contraseña/);
    fireEvent.change(screen.getByLabelText("Contraseña nueva"), { target: { value: "nueva123" } });
    fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: "nueva123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await waitFor(() => expect(account.changePassword).toHaveBeenCalledWith("nueva123", "nueva123"));
    expect(await screen.findByText(/Contraseña cambiada/)).toBeInTheDocument();
  });

  it("cambiar el correo", async () => {
    renderWithWorkout(<SettingsView />, undefined, "cloud");
    open(/Cambiar correo/);
    fireEvent.change(screen.getByLabelText("Correo nuevo"), { target: { value: "nuevo@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace de confirmación" }));
    await waitFor(() => expect(account.changeEmail).toHaveBeenCalledWith("nuevo@test.com"));
  });

  it("borrar la cuenta pide escribir BORRAR", async () => {
    renderWithWorkout(<SettingsView />, undefined, "cloud");
    open(/Borrar cuenta/);
    const confirm = screen.getByRole("button", { name: "Borrar mi cuenta para siempre" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Escribe BORRAR/), { target: { value: "borrar" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(account.deleteAccount).toHaveBeenCalled());
  });

  it("sin cuenta (modo local) no salen las opciones de cuenta", () => {
    renderWithWorkout(<SettingsView />);
    expect(screen.queryByRole("button", { name: /Cambiar contraseña/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Borrar cuenta/ })).not.toBeInTheDocument();
  });
});
