import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
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

  it("una leyenda dice qué rutina es cada color, con el nombre completo", () => {
    renderWithWorkout(<ScheduleCard />);
    const legend = screen.getByRole("list", { name: "Qué rutina es cada color" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(DAYS.map((d) => DAY_NAMES[d]));
  });
});
