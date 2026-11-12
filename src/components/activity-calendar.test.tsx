import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkout } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { entryKey } from "@/domain/snapshot";
import { setEnergyPrefs } from "@/lib/preferences";
import { freezeToday, historySnapshot, PRESS, renderWithWorkout } from "../../tests/workout-fixture";
import { ActivityCalendar } from "./activity-calendar";
import { ConfirmDialog } from "./confirm-dialog";
import { ProgressView } from "./progress-view";
import { TrainingView } from "./training-view";

// Lo guardado y lo que marca el calendario, para comprobar qué queda tras borrar, editar o mover.
function Probe() {
  const { model, diary } = useWorkout();
  return (
    <>
      <output data-testid="entries">{JSON.stringify(model.snapshot.entries)}</output>
      <output data-testid="active-dates">{Array.from(diary.activity().keys()).sort().join(",")}</output>
    </>
  );
}
const entries = () => JSON.parse(screen.getByTestId("entries").textContent ?? "{}") as Record<string, { date?: string }>;
const day = (n: number) => screen.getByRole("button", { name: new RegExp("(^|\\D)" + n + " de octubre") });
// Lo que se ve debajo del calendario del día tocado.
const info = () => document.querySelector(".calinfo") as HTMLElement;

// Spec progreso R7–R10. Los datos de prueba tienen tres lunes de Torso (5, 12 y 19 de
// octubre); hoy es el 28 de octubre.
describe("Progreso · el calendario hace de historial", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no hay «Historial»; al tocar un día se ven sus series y kilos (R10)", () => {
    renderWithWorkout(<ProgressView />);
    expect(screen.queryByRole("heading", { name: "Historial" })).not.toBeInTheDocument();
    fireEvent.click(day(19));
    expect(info()).toHaveTextContent("Torso");
    expect(info()).toHaveTextContent("8 series · 3120 kg");
    expect(info()).toHaveTextContent(PRESS.name);
  });

  it("con peso apuntado, el día tocado enseña las calorías estimadas de cada entreno (R11)", () => {
    renderWithWorkout(<ActivityCalendar />);
    fireEvent.click(day(19));
    expect(info()).toHaveTextContent(/8 series · 3120 kg · ≈ \d+ kcal/);
  });

  it("«Cambiar fecha» lleva el entreno entero a ese día y el calendario salta a él (R9)", () => {
    renderWithWorkout(<><ActivityCalendar /><Probe /></>);
    fireEvent.click(day(19));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar fecha de Torso" }));
    const input = screen.getByLabelText("Nueva fecha");
    expect(input).toHaveValue("2026-10-19");
    expect(input).toHaveAttribute("max", "2026-10-28");
    fireEvent.change(input, { target: { value: "2026-10-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar fecha" }));
    expect(screen.getByTestId("active-dates")).toHaveTextContent("2026-10-21");
    expect(screen.getByTestId("active-dates")).not.toHaveTextContent("2026-10-19");
    expect(day(21)).toHaveAttribute("aria-pressed", "true");
    expect(info()).toHaveTextContent("8 series · 3120 kg");
  });

  it("«Cancelar» deja el entreno donde estaba", () => {
    renderWithWorkout(<><ActivityCalendar /><Probe /></>);
    fireEvent.click(day(19));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar fecha de Torso" }));
    fireEvent.change(screen.getByLabelText("Nueva fecha"), { target: { value: "2026-10-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Editar Torso" })).toBeInTheDocument();
    expect(screen.getByTestId("active-dates")).toHaveTextContent("2026-10-19");
  });

  it("«Editar» abre Hoy con ese entreno y lo que se anota se guarda con su fecha (R8)", () => {
    renderWithWorkout(<><ActivityCalendar /><TrainingView /><Probe /></>);
    fireEvent.click(day(19));
    fireEvent.click(screen.getByRole("button", { name: "Editar Torso" }));
    expect(screen.getByText(/Editando el lunes 19 oct/)).toBeInTheDocument();
    // Un ejercicio de ese Torso que se quedó sin series: se anota con la fecha del entreno.
    const other = BASE_ROUTINE[2];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(other.name) }));
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(entries()[entryKey(3, 1, other.id, 1)]).toMatchObject({ date: "2026-10-19" });
  });

  it("«Borrar entreno» pregunta y, al confirmar, lo quita del calendario (R7)", async () => {
    renderWithWorkout(<><ActivityCalendar /><ConfirmDialog /><Probe /></>);
    fireEvent.click(day(19));
    fireEvent.click(screen.getByRole("button", { name: "Borrar Torso" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("¿Borrar el entreno?");
    fireEvent.click(within(confirm).getByRole("button", { name: "Borrar entreno" }));
    await waitFor(() => expect(screen.getByTestId("active-dates")).not.toHaveTextContent("2026-10-19"));
    expect(day(19)).toHaveAccessibleName(/sin entrenar/);
    expect(entries()[entryKey(3, 1, PRESS.id, 1)]).toBeUndefined();
    expect(entries()[entryKey(2, 1, PRESS.id, 1)]).toBeDefined();
  });
});

// Spec progreso R12: kcal del reloj en el calendario.
describe("Progreso · kcal del reloj en el calendario", () => {
  beforeEach(freezeToday);
  afterEach(() => { vi.useRealTimers(); setEnergyPrefs({ watchInput: false }); });

  it("si el día tiene kcal del reloj, salen en vez de la estimación (R12)", () => {
    const snap = historySnapshot();
    snap.watchKcal = { "2026-10-19": 410 };
    renderWithWorkout(<ActivityCalendar />, snap);
    fireEvent.click(day(19));
    expect(info()).toHaveTextContent("410 kcal ⌚");
    expect(info()).not.toHaveTextContent("≈");
  });

  it("con «Apuntar las kcal del reloj» activado, se pueden poner desde el día tocado (R12)", () => {
    setEnergyPrefs({ watchInput: true });
    renderWithWorkout(<ActivityCalendar />);
    fireEvent.click(day(19));
    fireEvent.change(within(info()).getByLabelText("kcal del reloj"), { target: { value: "380" } });
    fireEvent.click(within(info()).getByRole("button", { name: "Guardar kcal" }));
    expect(info()).toHaveTextContent("380 kcal ⌚");
  });
});
