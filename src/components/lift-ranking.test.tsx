import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiftRanking } from "./lift-ranking";

// Cada marca: el día de más peso de esa persona, con sus series.
const day = (weight: number, reps: number, more: [number, number][] = []) => {
  const sets = [{ weight, reps }, ...more.map(([w, r]) => ({ weight: w, reps: r }))];
  return { weight, reps, sets, total_reps: sets.reduce((n, s) => n + s.reps, 0) };
};
const rows = [
  { exercise: "Press banca", display_name: "Joel", ...day(85, 5), is_me: true },
  { exercise: "press banca ", display_name: "Bea", ...day(90, 6), is_me: false },
  { exercise: "Press banca", display_name: "Leo", ...day(85, 8), is_me: false },
  { exercise: "Sentadilla", display_name: "Joel", ...day(120, 5), is_me: true },
  { exercise: "Sentadilla", display_name: "Bea", ...day(100, 5), is_me: false },
  { exercise: "Curl", display_name: "Leo", ...day(20, 10), is_me: false },
];

const allRows = () => screen.getAllByRole("list").filter((l) => l.classList.contains("lift-list")).flatMap((l) => within(l).getAllByRole("listitem").filter((li) => li.parentElement === l));
const rowOf = (name: RegExp) => allRows().find((li) => name.test(li.textContent ?? ""))!;

describe("Social · quién levanta más, de un vistazo", () => {
  it("una fila por ejercicio con quién va primero (mismo ejercicio aunque esté escrito distinto)", () => {
    render(<LiftRanking rows={rows} />);
    expect(allRows()).toHaveLength(3);
    expect(rowOf(/Press banca/)).toHaveTextContent("Bea");
    expect(rowOf(/Press banca/)).toHaveTextContent("90 kg");
  });

  it("al lado dice tu puesto y tu marca, o que vas primero", () => {
    render(<LiftRanking rows={rows} />);
    expect(rowOf(/Press banca/)).toHaveTextContent("Tú · 3º · 85 kg");
    expect(rowOf(/Sentadilla/)).toHaveTextContent("¡Vas primero!");
  });

  it("los ejercicios van divididos por grupo muscular, cada uno con su título", () => {
    render(<LiftRanking rows={[...rows, { exercise: "Prensa", display_name: "Bea", ...day(200, 10), is_me: false }, { exercise: "Prensa", display_name: "Leo", ...day(180, 10), is_me: false }, { exercise: "Prensa", display_name: "Joel", ...day(150, 10), is_me: true }, { exercise: "Prensa", display_name: "Ana", ...day(100, 10), is_me: false }]} />);
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

// Spec social R1–R2: el máximo cuenta también las demás series del día.
describe("Social · el máximo con todas sus series", () => {
  const tie = [
    { exercise: "Curl", display_name: "Joel", ...day(25, 5, [[20, 12], [20, 12]]), is_me: true },
    { exercise: "Curl", display_name: "Bea", ...day(25, 6), is_me: false },
  ];

  it("a igual peso va delante quien hizo más repeticiones en total ese día (R1)", () => {
    render(<LiftRanking rows={tie} />);
    expect(rowOf(/Curl/)).toHaveTextContent("¡Vas primero!");
  });

  it("las series solo salen al tocar el recuadro de la persona en el ranking (R2)", () => {
    render(<LiftRanking rows={tie} />);
    expect(rowOf(/Curl/)).not.toHaveTextContent("25×5");
    fireEvent.click(within(rowOf(/Curl/)).getAllByRole("button")[0]);
    const full = screen.getByRole("list", { name: "Ranking de Curl" });
    expect(full).not.toHaveTextContent("25×5");
    const bea = within(full).getByRole("button", { name: /Bea/ });
    expect(bea).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bea);
    expect(bea).toHaveAttribute("aria-expanded", "true");
    expect(full).toHaveTextContent("25×6");
    expect(full).not.toHaveTextContent("25×5 · 20×12 · 20×12");
    fireEvent.click(within(full).getByRole("button", { name: /Joel/ }));
    expect(full).toHaveTextContent("25×5 · 20×12 · 20×12");
    fireEvent.click(bea);
    expect(full).not.toHaveTextContent("25×6");
  });
});
