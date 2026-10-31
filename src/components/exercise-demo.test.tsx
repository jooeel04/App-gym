import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, PRESS, renderWithWorkout } from "../../tests/workout-fixture";
import { ExerciseLogger } from "./exercise-logger";

describe("Cómo se hace cada ejercicio", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("en el entreno en curso hay una miniatura animada; al tocarla se ve en grande", () => {
    renderWithWorkout(<ExerciseLogger exercise={PRESS} superset={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver cómo se hace: " + PRESS.name }));
    const dialog = screen.getByRole("dialog", { name: "Cómo se hace" });
    const demo = screen.getAllByRole("img", { name: "Cómo se hace: " + PRESS.name }).at(-1)!;
    expect(dialog).toContainElement(demo);
    expect([...demo.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual([
      "/ejercicios/smith-machine-incline-bench-press-0.webp", "/ejercicios/smith-machine-incline-bench-press-1.webp",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Cómo se hace" })).not.toBeInTheDocument();
  });

  it("un ejercicio inventado no muestra nada", () => {
    renderWithWorkout(<ExerciseLogger exercise={{ ...PRESS, name: "Mi ejercicio raro" }} superset={null} />);
    expect(screen.queryByRole("button", { name: /Ver cómo se hace/ })).not.toBeInTheDocument();
  });
});
