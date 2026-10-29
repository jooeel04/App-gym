import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { freezeToday, renderWithWorkout, TODAY } from "../../tests/workout-fixture";
import { ExerciseLogger } from "./exercise-logger";
import { RestTimerBar } from "./rest-timer";

// Hoy (miércoles) toca Empujes: su primer ejercicio, sin registros anteriores.
const MILITAR = BASE_ROUTINE.find((x) => x.day === 3)!;
const chip = (n: number) => screen.getByRole("tab", { name: new RegExp("Serie " + n) });

describe("Hoy · anotar una serie se puede deshacer", () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    freezeToday();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  const logFirstSet = () => {
    renderWithWorkout(<><ExerciseLogger exercise={MILITAR} superset={null} /><RestTimerBar /></>);
    expect(chip(1)).toHaveTextContent("ahora");
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
  };

  it("al anotar, vibra un instante y ofrece deshacer junto al botón", () => {
    logFirstSet();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(chip(1)).toHaveTextContent("× 6");
    const undo = screen.getByRole("status");
    expect(undo).toHaveTextContent("Serie 1 anotada");
    expect(within(undo).getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  });

  it("«Deshacer» borra la serie, para el descanso y vuelve a esa serie", () => {
    logFirstSet();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(chip(1)).toHaveTextContent("ahora");
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.queryByText("Serie 1 anotada")).not.toBeInTheDocument();
  });

  it("tras «Deshacer», la serie se reabre con los números que se acababan de poner", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    const kg = screen.getByRole("spinbutton", { name: /carga en kg/ });
    const reps = screen.getByRole("spinbutton", { name: /repeticiones/ });
    fireEvent.change(kg, { target: { value: "20" } });
    fireEvent.change(reps, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(chip(1)).toHaveTextContent("ahora");
    expect(screen.getByRole("spinbutton", { name: /carga en kg/ })).toHaveValue(20);
    expect(screen.getByRole("spinbutton", { name: /repeticiones/ })).toHaveValue(8);
  });

  it("el aviso para deshacer se va solo a los pocos segundos", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(TODAY + "T10:00:00"));
    logFirstSet();
    expect(screen.getByText("Serie 1 anotada")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6500); });
    expect(screen.queryByText("Serie 1 anotada")).not.toBeInTheDocument();
    expect(chip(1)).toHaveTextContent("× 6");
  });
});
