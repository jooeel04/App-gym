import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { freezeToday, PRESS, renderWithWorkout, TODAY } from "../../tests/workout-fixture";
import { ExerciseLogger } from "./exercise-logger";
import { RestTimerBar } from "./rest-timer";

// Hoy (miércoles) toca Empujes: su primer ejercicio, sin registros anteriores.
const MILITAR = BASE_ROUTINE.find((x) => x.day === 3)!;
const chip = (n: number) => screen.getByRole("tab", { name: new RegExp("Serie " + n) });

describe("Hoy · anotar una serie se puede deshacer", () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    freezeToday();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  const logFirstSet = () => {
    renderWithWorkout(<><ExerciseLogger exercise={MILITAR} superset={null} /><RestTimerBar /></>);
    expect(chip(1)).toHaveTextContent("ahora");
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
  };

  it("al anotar, vibra un instante y ofrece deshacer junto al botón", () => {
    logFirstSet();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(chip(1)).toHaveTextContent("× 6");
    const undo = screen.getByRole("status");
    expect(undo).toHaveTextContent("Serie 1 anotada");
    expect(within(undo).getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  });

  it("«Deshacer» borra la serie, para el descanso y vuelve a esa serie", () => {
    logFirstSet();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(chip(1)).toHaveTextContent("ahora");
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.queryByText("Serie 1 anotada")).not.toBeInTheDocument();
  });

  it("tras «Deshacer», la serie se reabre con los números que se acababan de poner", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    const kg = screen.getByRole("spinbutton", { name: /carga en kg/ });
    const reps = screen.getByRole("spinbutton", { name: /repeticiones/ });
    fireEvent.change(kg, { target: { value: "20" } });
    fireEvent.change(reps, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(chip(1)).toHaveTextContent("ahora");
    expect(screen.getByRole("spinbutton", { name: /carga en kg/ })).toHaveValue(20);
    expect(screen.getByRole("spinbutton", { name: /repeticiones/ })).toHaveValue(8);
  });

  it("el aviso para deshacer se va solo a los pocos segundos", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(TODAY + "T10:00:00"));
    logFirstSet();
    expect(screen.getByText("Serie 1 anotada")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6500); });
    expect(screen.queryByText("Serie 1 anotada")).not.toBeInTheDocument();
    expect(chip(1)).toHaveTextContent("× 6");
  });
});

describe("Hoy · calculadora de discos desde la serie", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("«Discos» abre la calculadora con el peso que se está poniendo", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /carga en kg/ }), { target: { value: "62.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular discos para 62,5 kg" }));
    const dialog = screen.getByRole("dialog", { name: "Calculadora de discos" });
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(62.5);
  });
});

describe("Hoy · todo se anota en la misma tarjeta (spec hoy R2, R4–R6)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no hay un modo aparte de «más opciones»", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    expect(screen.queryByRole("button", { name: /Más opciones/ })).not.toBeInTheDocument();
  });

  it("«Añadir calentamiento» añade una serie C1 que se anota con los mismos botones", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Añadir calentamiento/ }));
    const c1 = screen.getByRole("tab", { name: /Calent\. 1/ });
    expect(c1).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText(/calentamiento 1, carga/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/calentamiento 1, repeticiones/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(c1).toHaveTextContent("20 × 12");
    // El calentamiento no cuenta como serie de trabajo: la serie 1 sigue por hacer.
    expect(chip(1)).toHaveTextContent("ahora");
  });

  it("como mucho tres series de calentamiento", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /Añadir calentamiento/ }));
    expect(screen.getByRole("tab", { name: /Calent\. 3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Añadir calentamiento/ })).not.toBeInTheDocument();
  });

  it("cada serie puede llevar una nota, que se guarda con la serie", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Añadir nota/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Nota de la serie 1/ }), { target: { value: "Codo raro" } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    fireEvent.click(chip(1));
    expect(screen.getByRole("textbox", { name: /Nota de la serie 1/ })).toHaveValue("Codo raro");
  });

  it("«Igual que la última vez» rellena las series vacías con lo de aquel día", () => {
    renderWithWorkout(<ExerciseLogger exercise={PRESS} superset={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Igual que la última vez/ }));
    for (const n of [1, 2, 3]) expect(chip(n)).toHaveTextContent("55 × 8");
    expect(screen.queryByRole("button", { name: /Igual que la última vez/ })).not.toBeInTheDocument();
  });
});
