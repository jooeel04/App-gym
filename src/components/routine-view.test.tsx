import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, renderWithWorkout } from "../../tests/workout-fixture";
import { RoutineView } from "./routine-view";

const dayButton = (name: RegExp) => screen.getAllByRole("button", { expanded: false }).concat(screen.queryAllByRole("button", { expanded: true }))
  .find((b) => name.test(b.textContent ?? ""))!;

describe("Rutina · los días empiezan cerrados", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("al entrar no hay ningún día abierto (tampoco el de hoy)", () => {
    renderWithWorkout(<RoutineView />);
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThanOrEqual(5);
  });

  it("al tocar un día se abre ese y, al tocar otro, se cambia", () => {
    renderWithWorkout(<RoutineView />);
    fireEvent.click(dayButton(/Lunes/));
    expect(dayButton(/Lunes/)).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(dayButton(/Martes/));
    expect(dayButton(/Martes/)).toHaveAttribute("aria-expanded", "true");
    expect(dayButton(/Lunes/)).toHaveAttribute("aria-expanded", "false");
  });
});
