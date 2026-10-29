import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkout } from "@/controllers/workout-controller";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { AppShell } from "./app-shell";
import { RestTimerBar } from "./rest-timer";

vi.mock("next/navigation", () => ({ usePathname: () => "/entrenar" }));
vi.mock("@/lib/permissions", () => ({
  notifyState: () => "granted", subscribePermission: () => () => {}, requestPermissions: vi.fn(), needsHomeScreen: () => false, showNotification: vi.fn(),
}));

const RECT = { width: 360, height: 68, top: 0, left: 0, right: 360, bottom: 68, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

describe("Barras flotantes con cristal líquido", () => {
  beforeEach(() => {
    freezeToday();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RECT);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("la barra de pestañas tiene sus cinco pestañas (con Social) y lleva el cristal", async () => {
    renderWithWorkout(<AppShell>{null}</AppShell>);
    const nav = screen.getByRole("navigation", { name: "Navegación" });
    const tabs = within(nav).getAllByRole("link");
    expect(tabs.map((t) => t.textContent)).toEqual(["Hoy", "Rutina", "Progreso", "Social", "Ajustes"]);
    expect(within(nav).getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(nav.querySelector(".glass-layer.on filter")).not.toBeNull());
  });

  it("la barra del descanso lleva el cristal y sus botones siguen funcionando", async () => {
    function StartRest() {
      const { actions } = useWorkout();
      return <button type="button" onClick={() => actions.startRest(90)}>Empezar descanso</button>;
    }
    renderWithWorkout(<><StartRest /><RestTimerBar /></>);
    fireEvent.click(screen.getByRole("button", { name: "Empezar descanso" }));
    const bar = screen.getByRole("timer");
    expect(bar).toHaveAccessibleName("Descanso: quedan 90 segundos");
    await waitFor(() => expect(bar.querySelector(".glass-layer.on filter")).not.toBeNull());
    fireEvent.click(within(bar).getByRole("button", { name: "Saltar" }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
