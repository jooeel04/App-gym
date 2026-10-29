import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiftRanking } from "./lift-ranking";

const rows = [
  { exercise: "Press banca", display_name: "Joel", weight: 85, reps: 5, is_me: true },
  { exercise: "press banca ", display_name: "Bea", weight: 90, reps: 6, is_me: false },
  { exercise: "Press banca", display_name: "Leo", weight: 85, reps: 8, is_me: false },
  { exercise: "Sentadilla", display_name: "Joel", weight: 120, reps: 5, is_me: true },
  { exercise: "Sentadilla", display_name: "Bea", weight: 100, reps: 5, is_me: false },
  { exercise: "Curl", display_name: "Leo", weight: 20, reps: 10, is_me: false },
];

const rowOf = (name: RegExp) => within(screen.getByRole("list", { name: "Quién levanta más" })).getAllByRole("listitem").find((li) => name.test(li.textContent ?? ""))!;

describe("Social · quién levanta más, de un vistazo", () => {
  it("una fila por ejercicio con quién va primero (mismo ejercicio aunque esté escrito distinto)", () => {
    render(<LiftRanking rows={rows} />);
    const items = within(screen.getByRole("list", { name: "Quién levanta más" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(rowOf(/Press banca/)).toHaveTextContent("Bea");
    expect(rowOf(/Press banca/)).toHaveTextContent("90 kg × 6");
  });

  it("al lado dice tu puesto y tu marca, o que vas primero", () => {
    render(<LiftRanking rows={rows} />);
    expect(rowOf(/Press banca/)).toHaveTextContent("Tú · 3º · 85 kg × 5");
    expect(rowOf(/Sentadilla/)).toHaveTextContent("¡Vas primero!");
  });

  it("primero los ejercicios que hacéis más personas", () => {
    render(<LiftRanking rows={rows} />);
    const items = within(screen.getByRole("list", { name: "Quién levanta más" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Press banca");
    expect(items[2]).toHaveTextContent("Curl");
  });

  it("al tocar un ejercicio se ve el ranking completo", () => {
    render(<LiftRanking rows={rows} />);
    fireEvent.click(within(rowOf(/Press banca/)).getByRole("button"));
    const full = screen.getByRole("list", { name: "Ranking de Press banca" });
    expect(within(full).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Bea"), expect.stringContaining("Leo"), expect.stringContaining("Joel"),
    ]);
  });

  it("sin datos explica cómo se llena", () => {
    render(<LiftRanking rows={[]} />);
    expect(screen.getByText(/Cuando anotéis series con peso/)).toBeInTheDocument();
  });
});
