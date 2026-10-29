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

const allRows = () => screen.getAllByRole("list").filter((l) => l.classList.contains("lift-list")).flatMap((l) => within(l).getAllByRole("listitem").filter((li) => li.parentElement === l));
const rowOf = (name: RegExp) => allRows().find((li) => name.test(li.textContent ?? ""))!;

describe("Social · quién levanta más, de un vistazo", () => {
  it("una fila por ejercicio con quién va primero (mismo ejercicio aunque esté escrito distinto)", () => {
    render(<LiftRanking rows={rows} />);
    expect(allRows()).toHaveLength(3);
    expect(rowOf(/Press banca/)).toHaveTextContent("Bea");
    expect(rowOf(/Press banca/)).toHaveTextContent("90 kg × 6");
  });

  it("al lado dice tu puesto y tu marca, o que vas primero", () => {
    render(<LiftRanking rows={rows} />);
    expect(rowOf(/Press banca/)).toHaveTextContent("Tú · 3º · 85 kg × 5");
    expect(rowOf(/Sentadilla/)).toHaveTextContent("¡Vas primero!");
  });

  it("los ejercicios van divididos por grupo muscular, cada uno con su título", () => {
    render(<LiftRanking rows={[...rows, { exercise: "Prensa", display_name: "Bea", weight: 200, reps: 10, is_me: false }, { exercise: "Prensa", display_name: "Leo", weight: 180, reps: 10, is_me: false }, { exercise: "Prensa", display_name: "Joel", weight: 150, reps: 10, is_me: true }, { exercise: "Prensa", display_name: "Ana", weight: 100, reps: 10, is_me: false }]} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Pecho", "Pierna", "Brazos"]);
    const pierna = screen.getByRole("list", { name: "Pierna" });
    // Dentro de cada grupo, primero los que hacéis más personas.
    expect(within(pierna).getAllByRole("listitem").filter((li) => li.parentElement === pierna).map((li) => li.querySelector(".lift-ex b")?.textContent)).toEqual(["Prensa", "Sentadilla"]);
    expect(within(screen.getByRole("list", { name: "Brazos" })).getByText("Curl")).toBeInTheDocument();
  });

  it("con los botones de arriba se ve solo un grupo", () => {
    render(<LiftRanking rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Pierna" }));
    expect(screen.getByRole("button", { name: "Pierna" })).toHaveAttribute("aria-pressed", "true");
    expect(allRows()).toHaveLength(1);
    expect(rowOf(/Sentadilla/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(allRows()).toHaveLength(3);
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
