import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { ScheduleCard } from "./schedule-card";

describe("Rutina · «Tu semana» se lee sin abreviaturas", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no muestra nombres cortados de tres letras", () => {
    renderWithWorkout(<ScheduleCard />);
    for (const short of ["Tor", "Pie", "Emp", "Tir", "Hom"]) expect(screen.queryByText(new RegExp("^" + short + "$", "i"))).not.toBeInTheDocument();
  });

  it("cada día de entreno va del color de su rutina y dice su nombre completo", () => {
    renderWithWorkout(<ScheduleCard />);
    const monday = screen.getByRole("button", { name: "Lunes: Torso" });
    expect(monday.getAttribute("style")).toContain("--day1");
    expect(screen.getByRole("button", { name: "Sábado: descanso" })).toBeInTheDocument();
  });

  it("no lleva leyenda debajo: con los colores ya se entiende", () => {
    renderWithWorkout(<ScheduleCard />);
    expect(screen.queryByRole("list", { name: "Qué rutina es cada color" })).not.toBeInTheDocument();
  });
});
