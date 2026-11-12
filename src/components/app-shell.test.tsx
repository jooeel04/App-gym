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

  it("la barra del descanso es plana (spec interfaz R6) y sus botones funcionan", () => {
    function StartRest() {
      const { actions } = useWorkout();
      return <button type="button" onClick={() => actions.startRest(90)}>Empezar descanso</button>;
    }
    renderWithWorkout(<><StartRest /><RestTimerBar /></>);
    fireEvent.click(screen.getByRole("button", { name: "Empezar descanso" }));
    const bar = screen.getByRole("timer");
    expect(bar).toHaveAccessibleName("Descanso: quedan 90 segundos");
    expect(bar.querySelector(".glass-layer")).toBeNull();
    fireEvent.click(within(bar).getByRole("button", { name: "Saltar" }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});

// Spec interfaz R7: sin cabecera con el logo; cada pestaña empieza por su título.
describe("AppShell · sin cabecera de marca", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no hay cabecera con el logo «FITGYM» (R7)", async () => {
    renderWithWorkout(<AppShell>{null}</AppShell>);
    await screen.findByRole("navigation");
    expect(screen.queryByText("FITGYM")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inicio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
