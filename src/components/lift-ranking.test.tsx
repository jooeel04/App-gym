import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiftRanking } from "./lift-ranking";

const rows = [
  { exercise: "Press banca", display_name: "Joel", weight: 85, reps: 5, is_me: true },
  { exercise: "press banca ", display_name: "Bea", weight: 90, reps: 6, is_me: false },
  { exercise: "Press banca", display_name: "Leo", weight: 85, reps: 8, is_me: false },
  { exercise: "Sentadilla", display_name: "Joel", weight: 120, reps: 5, is_me: true },
];

describe("Amigos · quién levanta más en cada ejercicio", () => {
  it("junta el mismo ejercicio aunque esté escrito distinto y ordena por peso (y repeticiones)", () => {
    render(<LiftRanking rows={rows} />);
    const list = screen.getByRole("list", { name: /Press banca/i });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Bea"), expect.stringContaining("Leo"), expect.stringContaining("Joel"),
    ]);
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("90 kg × 6");
    expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("(tú)");
  });

  it("primero salen los ejercicios que hacéis varios, y se puede elegir otro", () => {
    render(<LiftRanking rows={rows} />);
    const chips = screen.getAllByRole("tab");
    expect(chips[0]).toHaveTextContent("Press banca");
    fireEvent.click(screen.getByRole("tab", { name: /Sentadilla/ }));
    expect(screen.getByRole("list", { name: /Sentadilla/ })).toHaveTextContent("120 kg × 5");
  });

  it("sin datos explica cómo se llena", () => {
    render(<LiftRanking rows={[]} />);
    expect(screen.getByText(/Cuando anotéis series con peso/)).toBeInTheDocument();
  });
});
