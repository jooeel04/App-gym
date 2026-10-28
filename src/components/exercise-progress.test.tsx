import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateTab } from "@/controllers/workout-controller";
import { freezeToday, freshSnapshot, renderWithWorkout } from "../../tests/workout-fixture";
import { ExerciseProgress } from "./exercise-progress";

vi.mock("@/controllers/workout-controller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/controllers/workout-controller")>()),
  navigateTab: vi.fn(),
}));

const row = (name: RegExp) => screen.getByRole("button", { name });
const charts = () => screen.queryAllByRole("group", { name: /por fecha/ });

describe("Progreso · Tus ejercicios", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  const openTorso = () => {
    renderWithWorkout(<ExerciseProgress />);
    fireEvent.click(screen.getByRole("tab", { name: /Torso/ }));
  };

  it("lista los ejercicios con registros en filas compactas, sin gráficas abiertas", () => {
    openTorso();
    const press = row(/Press inclinado en multipower/);
    expect(press).toHaveAttribute("aria-expanded", "false");
    expect(press).toHaveTextContent("69,5 kg");
    expect(press).toHaveTextContent("+3 kg");
    expect(row(/Remo con barra/)).toHaveAttribute("aria-expanded", "false");
    expect(charts()).toHaveLength(0);
  });

  it("al tocar un ejercicio se despliega con su récord y su gráfica", () => {
    openTorso();
    fireEvent.click(row(/Press inclinado en multipower/));
    expect(row(/Press inclinado en multipower/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Fuerza de Press inclinado en multipower por fecha" })).toBeInTheDocument();
    expect(screen.getByText(/Récord/)).toBeInTheDocument();
    // La explicación de "fuerza" está a la vista, sin tener que buscar un botón diminuto.
    expect(screen.getByText(/lo máximo que podrías levantar una vez/)).toBeInTheDocument();
  });

  it("solo hay un ejercicio desplegado a la vez y se puede volver a plegar", () => {
    openTorso();
    fireEvent.click(row(/Press inclinado en multipower/));
    fireEvent.click(row(/Remo con barra/));
    expect(row(/Press inclinado en multipower/)).toHaveAttribute("aria-expanded", "false");
    expect(row(/Remo con barra/)).toHaveAttribute("aria-expanded", "true");
    expect(charts()).toHaveLength(1);
    fireEvent.click(row(/Remo con barra/));
    expect(charts()).toHaveLength(0);
  });

  it("los ejercicios sin carga muestran sus repeticiones, no una fuerza vacía", () => {
    openTorso();
    const dominadas = row(/Dominadas excéntricas/);
    expect(dominadas).toHaveTextContent("6 reps");
    expect(dominadas).toHaveTextContent("+1");
    expect(dominadas).not.toHaveTextContent("—");
    fireEvent.click(dominadas);
    expect(screen.getByRole("group", { name: "Repeticiones de Dominadas excéntricas por fecha" })).toBeInTheDocument();
  });

  it("un día sin registros lo dice", () => {
    renderWithWorkout(<ExerciseProgress />);
    fireEvent.click(screen.getByRole("tab", { name: /Pierna/ }));
    expect(screen.getByText(/Todavía no has anotado series de este día/)).toBeInTheDocument();
  });

  it("una cuenta nueva ve qué hacer y un botón para ir a Hoy", () => {
    renderWithWorkout(<ExerciseProgress />, freshSnapshot());
    const section = screen.getByRole("region", { name: "Tus ejercicios" });
    expect(within(section).getByText(/Aún no has anotado ningún entreno/)).toBeInTheDocument();
    expect(within(section).queryByRole("tab")).not.toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Ir a Hoy" }));
    expect(navigateTab).toHaveBeenCalledWith("/entrenar");
  });
});
