import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, freshSnapshot, renderWithWorkout } from "../../tests/workout-fixture";
import { SetupWizard } from "./setup-wizard";

vi.mock("@/app/actions/social", () => ({ getSharedRoutine: vi.fn() }));

const day = (name: string) => screen.getByRole("button", { name });

describe("Asistente de cuenta nueva · días de entreno", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("dice cuántos días hay elegidos, no solo con el color", () => {
    renderWithWorkout(<SetupWizard />, freshSnapshot());
    expect(screen.getByRole("heading", { name: "¿Qué días entrenas?" })).toBeInTheDocument();
    expect(screen.getByText("5 días a la semana")).toBeInTheDocument();
    fireEvent.click(day("Lunes"));
    expect(screen.getByText("4 días a la semana")).toBeInTheDocument();
    fireEvent.click(day("Lunes"));
    fireEvent.click(day("Martes"));
    fireEvent.click(day("Miércoles"));
    fireEvent.click(day("Jueves"));
    fireEvent.click(day("Viernes"));
    expect(screen.getByText("1 día a la semana")).toBeInTheDocument();
  });

  it("cada día elegido lleva una marca ✓ además del color", () => {
    renderWithWorkout(<SetupWizard />, freshSnapshot());
    expect(day("Lunes")).toHaveAttribute("aria-pressed", "true");
    expect(day("Lunes").querySelector(".wizard-day-check")).not.toBeNull();
    expect(day("Sábado")).toHaveAttribute("aria-pressed", "false");
    expect(day("Sábado").querySelector(".wizard-day-check")).toBeNull();
    fireEvent.click(day("Lunes"));
    expect(day("Lunes").querySelector(".wizard-day-check")).toBeNull();
  });

  it("sin ningún día no deja seguir y explica por qué junto a los días", () => {
    renderWithWorkout(<SetupWizard />, freshSnapshot());
    for (const d of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]) fireEvent.click(day(d));
    expect(screen.getByText("Ningún día elegido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige al menos un día.");
  });
});
