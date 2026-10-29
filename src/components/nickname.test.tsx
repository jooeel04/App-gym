import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { NicknamePrompt } from "./nickname-prompt";
import { SettingsView } from "./settings-view";
import { TrainingView } from "./training-view";

vi.mock("@/lib/permissions", () => ({
  notifyState: () => "granted", subscribePermission: () => () => {}, requestPermissions: vi.fn(), needsHomeScreen: () => false, showNotification: vi.fn(),
}));

describe("Apodo · la app pregunta cómo llamarte y se dirige a ti", () => {
  beforeEach(() => { freezeToday(); localStorage.clear(); });
  afterEach(() => vi.useRealTimers());

  it("si no hay apodo, pregunta «¿Cómo te llamamos?»", () => {
    renderWithWorkout(<NicknamePrompt />);
    expect(screen.getByRole("dialog", { name: "¿Cómo te llamamos?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("al guardarlo, desaparece y Hoy te llama por tu nombre", () => {
    renderWithWorkout(<><NicknamePrompt /><TrainingView /></>);
    fireEvent.change(screen.getByRole("textbox", { name: /nombre o apodo/i }), { target: { value: "  Joel " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.queryByRole("dialog", { name: "¿Cómo te llamamos?" })).not.toBeInTheDocument();
    expect(screen.getByText(/Joel, hoy toca/i)).toBeInTheDocument();
  });

  it("con apodo ya guardado no vuelve a preguntar", () => {
    localStorage.setItem("rutina:nickname:local", "Ana");
    renderWithWorkout(<NicknamePrompt />);
    expect(screen.queryByRole("dialog", { name: "¿Cómo te llamamos?" })).not.toBeInTheDocument();
  });

  it("se puede cambiar en Ajustes", () => {
    localStorage.setItem("rutina:nickname:local", "Ana");
    renderWithWorkout(<SettingsView />);
    fireEvent.click(screen.getByRole("button", { name: /Tu nombre/ }));
    const input = screen.getByRole("textbox", { name: /nombre o apodo/i });
    expect(input).toHaveValue("Ana");
    fireEvent.change(input, { target: { value: "Anita" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    expect(screen.getByRole("button", { name: /Tu nombre/ })).toHaveTextContent("Anita");
  });
});
