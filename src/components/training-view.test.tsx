import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPermissions } from "@/lib/permissions";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { TrainingView } from "./training-view";

// El navegador todavía no ha preguntado por los permisos.
vi.mock("@/lib/permissions", () => ({
  notifyState: () => "default",
  subscribePermission: () => () => {},
  requestPermissions: vi.fn(async () => "default"),
  needsHomeScreen: () => false,
  showNotification: vi.fn(),
}));

describe("Hoy · aviso para activar los permisos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("invita a activar los avisos", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.getByText("Activa los avisos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(requestPermissions).toHaveBeenCalled();
  });

  it("se puede cerrar con «Ahora no» y no vuelve a salir", () => {
    const { unmount } = renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.queryByText("Activa los avisos")).not.toBeInTheDocument();
    unmount();
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByText("Activa los avisos")).not.toBeInTheDocument();
  });

  it("el resto de la pantalla sigue igual al cerrarlo", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.getByRole("heading", { name: "Hoy" })).toBeInTheDocument();
    expect(screen.getByText("Lo que vas a hacer")).toBeInTheDocument();
  });
});

// En los datos de prueba solo se hizo Torso: en las dos últimas semanas quedan días sin hacer.
describe("Hoy · los días pendientes no ocupan la pantalla principal", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no se ven de entrada: «Hacer otro día» avisa de cuántos hay", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByText(/Te quedó pendiente/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hacer otro día/ })).toHaveTextContent(/\d+ pendientes/);
  });

  it("al abrir «Hacer otro día» aparecen los pendientes con «Hacer hoy»", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    const count = Number(/(\d+) pendientes/.exec(screen.getByRole("button", { name: /Hacer otro día/ }).textContent ?? "")?.[1]);
    const buttons = screen.getAllByRole("button", { name: /^Hacer hoy / });
    expect(buttons).toHaveLength(count);
    const name = buttons[0].getAttribute("aria-label")!.replace("Hacer hoy ", "");
    fireEvent.click(buttons[0]);
    expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });
});

describe("Hoy · calculadora de discos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("tiene su propio botón «Calculadora de discos» (no arriba junto a la racha)", () => {
    renderWithWorkout(<TrainingView />);
    const button = screen.getByRole("button", { name: "Calculadora de discos" });
    expect(button.closest(".pagehead")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Calculadora de discos" })).toBeInTheDocument();
  });
});
