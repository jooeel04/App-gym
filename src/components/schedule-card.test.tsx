import { fireEvent, screen } from "@testing-library/react";
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

// Spec rutina R4: un día de rutina puede ir en varios días de la semana.
describe("Rutina · un día de rutina en varios días de la semana", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("elegir Torso el jueves lo añade sin quitarlo del lunes (R4)", () => {
    renderWithWorkout(<ScheduleCard />);
    fireEvent.click(screen.getByRole("button", { name: "Jueves: Tirones" }));
    const torso = screen.getByRole("checkbox", { name: /Torso/ });
    expect(torso).toHaveAttribute("aria-checked", "false");
    expect(torso).toHaveTextContent("también el lunes");
    fireEvent.click(torso);
    expect(torso).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.getByRole("button", { name: "Lunes: Torso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jueves: Torso y Tirones" })).toBeInTheDocument();
  });
});
