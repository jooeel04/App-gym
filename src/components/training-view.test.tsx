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
