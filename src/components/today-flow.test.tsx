import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { setActiveWorkout } from "@/lib/active-workout";
import { freezeToday, PRESS, renderWithWorkout } from "../../tests/workout-fixture";
import { ContinueWorkout, DOCK_ID } from "./dock";
import { ExerciseLogger } from "./exercise-logger";
import { RestTimerBar } from "./rest-timer";
import { TrainingView } from "./training-view";

// Spec hoy R8–R12: entras, haces la serie, la apuntas con un toque y sigues.
// Hoy (miércoles) toca Empujes; su primer ejercicio es el press militar, sin registros.
const MILITAR = BASE_ROUTINE.find((x) => x.day === 3)!;
const chip = (n: number) => screen.getByRole("tab", { name: new RegExp("Serie " + n) });

let dock: HTMLElement;
beforeEach(() => {
  freezeToday();
  setActiveWorkout(null);
  // El hueco fijo de abajo que pone AppShell.
  dock = document.createElement("div");
  dock.id = DOCK_ID;
  document.body.appendChild(dock);
});
afterEach(() => {
  dock.remove();
  vi.useRealTimers();
});

describe("Hoy · entrar y anotar en un toque", () => {
  it("al entrar, el primer ejercicio sin terminar ya está abierto con su serie (R8)", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.getByRole("button", { name: new RegExp(MILITAR.name), expanded: true })).toBeInTheDocument();
    expect(chip(1)).toHaveTextContent("ahora");
  });

  it("«Serie hecha» va en el hueco fijo de abajo y dice lo que va a guardar (R9)", () => {
    renderWithWorkout(<TrainingView />);
    const button = within(dock).getByRole("button", { name: /Serie hecha/ });
    const reps = (screen.getByLabelText(/serie 1, repeticiones/) as HTMLInputElement).value;
    expect(button).toHaveTextContent("× " + reps);
    fireEvent.change(screen.getByLabelText(/serie 1, carga en kg/), { target: { value: "42.5" } });
    expect(button).toHaveTextContent("42,5 × " + reps);
  });

  it("tras anotar, ahí está el descanso con «Deshacer»; al saltarlo vuelve «Serie hecha» (R10)", () => {
    renderWithWorkout(<><TrainingView /><RestTimerBar /></>);
    fireEvent.click(within(dock).getByRole("button", { name: /Serie hecha/ }));
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Serie hecha/ })).not.toBeInTheDocument();
    expect(within(dock).getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(within(dock).getByRole("button", { name: /Serie hecha/ })).toBeInTheDocument();
    expect(chip(2)).toHaveTextContent("ahora");
  });
});

describe("Hoy · volver al entreno desde otra pestaña (R11)", () => {
  it("con un entreno en curso, «Seguir entreno» lleva a Hoy", () => {
    window.history.replaceState(null, "", "/progreso");
    renderWithWorkout(<><TrainingView /><RestTimerBar /><ContinueWorkout onToday={false} /></>);
    expect(screen.queryByRole("button", { name: /Seguir entreno/ })).not.toBeInTheDocument();
    fireEvent.click(within(dock).getByRole("button", { name: /Serie hecha/ }));
    // Mientras hay descanso, en ese sitio está el descanso.
    expect(screen.queryByRole("button", { name: /Seguir entreno/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    const back = screen.getByRole("button", { name: /Seguir entreno/ });
    expect(back).toHaveTextContent(MILITAR.name);
    fireEvent.click(back);
    expect(window.location.pathname).toBe("/entrenar");
  });

  it("en Hoy no sale (ya está «Serie hecha»)", () => {
    renderWithWorkout(<><TrainingView /><RestTimerBar /><ContinueWorkout onToday /></>);
    fireEvent.click(within(dock).getByRole("button", { name: /Serie hecha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.queryByRole("button", { name: /Seguir entreno/ })).not.toBeInTheDocument();
  });
});

describe("Hoy · lo que no se usa en cada serie está plegado (R12)", () => {
  it("músculos, foto e indicaciones salen al tocar «Cómo se hace»", () => {
    renderWithWorkout(<ExerciseLogger exercise={PRESS} superset={null} />);
    expect(screen.queryByText("Músculos que trabajas")).not.toBeInTheDocument();
    const how = screen.getByRole("button", { name: "Cómo se hace" });
    expect(how).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(how);
    expect(how).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Músculos que trabajas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver cómo se hace: " + PRESS.name })).toBeInTheDocument();
  });
});
