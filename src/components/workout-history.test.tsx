import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkout } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { entryKey } from "@/domain/snapshot";
import { freezeToday, PRESS, renderWithWorkout } from "../../tests/workout-fixture";
import { ActivityCalendar } from "./activity-calendar";
import { ConfirmDialog } from "./confirm-dialog";
import { TrainingView } from "./training-view";
import { WorkoutHistory } from "./workout-history";

// Lo guardado y lo que marca el calendario, para comprobar qué queda tras borrar o editar.
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
const card = (date: RegExp) => screen.getAllByRole("button").find((b) => b.classList.contains("history-item") && date.test(b.textContent ?? ""))!;

// Spec progreso R6–R8: historial de entrenos con editar y borrar. Los datos de prueba
// tienen tres lunes de Torso (5, 12 y 19 de octubre).
describe("Progreso · historial de entrenos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("enseña cada entreno, el más reciente primero, con su día, fecha, series y kilos (R6)", () => {
    renderWithWorkout(<WorkoutHistory />);
    const items = screen.getAllByRole("button").filter((b) => b.classList.contains("history-item"));
    expect(items.map((b) => b.querySelector(".history-date")?.textContent)).toEqual(["lunes 19 oct", "lunes 12 oct", "lunes 5 oct"]);
    expect(items[0]).toHaveTextContent("Torso");
    expect(items[0]).toHaveTextContent("8 series");
    expect(items[0]).toHaveTextContent("3120 kg");
  });

  it("«Borrar entreno» pregunta y, al confirmar, lo quita del historial y del calendario (R7)", async () => {
    renderWithWorkout(<><WorkoutHistory /><ConfirmDialog /><Probe /></>);
    expect(screen.getByTestId("active-dates")).toHaveTextContent("2026-10-19");
    fireEvent.click(card(/19 oct/));
    const detail = screen.getByRole("dialog", { name: /Torso/ });
    expect(detail).toHaveTextContent(PRESS.name);
    fireEvent.click(within(detail).getByRole("button", { name: "Borrar entreno" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("¿Borrar el entreno?");
    fireEvent.click(within(confirm).getByRole("button", { name: "Borrar entreno" }));
    await waitFor(() => expect(card(/19 oct/)).toBeUndefined());
    expect(screen.getByTestId("active-dates")).not.toHaveTextContent("2026-10-19");
    expect(entries()[entryKey(3, 1, PRESS.id, 1)]).toBeUndefined();
    expect(entries()[entryKey(2, 1, PRESS.id, 1)]).toBeDefined();
  });

  it("«Editar» abre Hoy con ese entreno y lo que se anota se guarda con su fecha (R8)", () => {
    renderWithWorkout(<><WorkoutHistory /><TrainingView /><Probe /></>);
    fireEvent.click(card(/19 oct/));
    fireEvent.click(within(screen.getByRole("dialog", { name: /Torso/ })).getByRole("button", { name: "Editar" }));
    expect(screen.queryByRole("dialog", { name: /Torso/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Editando el lunes 19 oct/)).toBeInTheDocument();
    // Un ejercicio de ese Torso que se quedó sin series: se anota con la fecha del entreno.
    const other = BASE_ROUTINE[2];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(other.name) }));
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(entries()[entryKey(3, 1, other.id, 1)]).toMatchObject({ date: "2026-10-19" });
  });
});

describe("Progreso · borrar desde el calendario", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("al tocar un día, «Borrar entreno» lo quita del calendario (R7)", async () => {
    renderWithWorkout(<><ActivityCalendar /><ConfirmDialog /><Probe /></>);
    fireEvent.click(screen.getByRole("button", { name: /19 de octubre/ }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar Torso" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Borrar entreno" }));
    await waitFor(() => expect(screen.getByTestId("active-dates")).not.toHaveTextContent("2026-10-19"));
    expect(screen.getByRole("button", { name: /19 de octubre/ })).toHaveAccessibleName(/sin entrenar/);
  });
});

// Spec progreso R9: cambiar la fecha de un entreno.
describe("Progreso · cambiar la fecha de un entreno", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("«Cambiar fecha» lleva el entreno entero a ese día (R9)", () => {
    renderWithWorkout(<><WorkoutHistory /><Probe /></>);
    fireEvent.click(card(/19 oct/));
    const detail = screen.getByRole("dialog", { name: /Torso/ });
    fireEvent.click(within(detail).getByRole("button", { name: "Cambiar fecha" }));
    const input = within(detail).getByLabelText("Nueva fecha");
    expect(input).toHaveValue("2026-10-19");
    expect(input).toHaveAttribute("max", "2026-10-28");
    fireEvent.change(input, { target: { value: "2026-10-21" } });
    fireEvent.click(within(detail).getByRole("button", { name: "Guardar fecha" }));
    expect(screen.queryByRole("dialog", { name: /Torso/ })).not.toBeInTheDocument();
    expect(card(/21 oct/)).toBeDefined();
    expect(card(/19 oct/)).toBeUndefined();
    expect(screen.getByTestId("active-dates")).toHaveTextContent("2026-10-21");
    expect(screen.getByTestId("active-dates")).not.toHaveTextContent("2026-10-19");
  });
});
