import { fireEvent, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkout } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { estimateKcal } from "@/domain/energy";
import { setEnergyPrefs } from "@/lib/preferences";
import { freezeToday, historySnapshot, renderWithWorkout } from "../../tests/workout-fixture";
import { DaySummary } from "./day-summary";

// Hoy (miércoles 28 oct, semana 4) toca Empujes (día 3). Se marca entero con el tick: cada
// ejercicio cuenta sus series previstas. El último peso apuntado es 79,4 kg y el descanso,
// el de siempre (90 s).
const EMPUJES = BASE_ROUTINE.filter((x) => x.day === 3);
function TickAll() {
  const { actions } = useWorkout();
  useEffect(() => { EMPUJES.forEach((x) => actions.toggleExerciseChecked(4, 3, x.id)); }, [actions]);
  return null;
}
const kcal = (sets: number, name: string) => estimateKcal({ name, sets }, { restSeconds: 90, bodyWeight: 79.4 });

// Spec hoy R31: calorías estimadas en el resumen del entreno.
describe("Resumen · calorías estimadas", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("enseña «≈ N kcal» del entreno y de cada ejercicio (R31)", async () => {
    renderWithWorkout(<><TickAll /><DaySummary /></>);
    const summary = await screen.findByRole("dialog", { name: /Día completado/ });
    const total = EMPUJES.reduce((n, x) => n + kcal(x.sets, x.name), 0);
    expect(within(summary).getByText("≈ " + total + " kcal")).toBeInTheDocument();
    const list = within(summary).getByRole("list", { name: "Calorías de cada ejercicio" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(EMPUJES.length);
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(EMPUJES[0].name + "≈ " + kcal(EMPUJES[0].sets, EMPUJES[0].name) + " kcal");
  });

  it("sin peso corporal apuntado, pide apuntarlo (R31)", async () => {
    const snap = historySnapshot();
    delete snap.body;
    renderWithWorkout(<><TickAll /><DaySummary /></>, snap);
    const summary = await screen.findByRole("dialog", { name: /Día completado/ });
    expect(within(summary).queryByText(/kcal/)).not.toBeInTheDocument();
    expect(within(summary).getByText("Apunta tu peso en Progreso para ver las calorías")).toBeInTheDocument();
  });
});

// Spec hoy R32: las kcal del reloj, apuntadas a mano en el resumen.
describe("Resumen · kcal del reloj", () => {
  beforeEach(freezeToday);
  afterEach(() => { vi.useRealTimers(); setEnergyPrefs({ watchInput: false }); });

  it("desactivado en Ajustes, no hay campo del reloj (R32)", async () => {
    renderWithWorkout(<><TickAll /><DaySummary /></>);
    const summary = await screen.findByRole("dialog", { name: /Día completado/ });
    expect(within(summary).queryByLabelText("kcal del reloj")).not.toBeInTheDocument();
  });

  it("activado, al guardar las kcal del reloj enseña «N kcal ⌚» en vez de la estimación (R32)", async () => {
    setEnergyPrefs({ watchInput: true });
    renderWithWorkout(<><TickAll /><DaySummary /></>);
    const summary = await screen.findByRole("dialog", { name: /Día completado/ });
    fireEvent.change(within(summary).getByLabelText("kcal del reloj"), { target: { value: "345" } });
    fireEvent.click(within(summary).getByRole("button", { name: "Guardar kcal" }));
    expect(within(summary).getByText("345 kcal ⌚")).toBeInTheDocument();
    // La estimación queda debajo, en pequeño.
    expect(within(summary).getByText(/^Estimación: ≈ \d+ kcal$/)).toBeInTheDocument();
  });
});
