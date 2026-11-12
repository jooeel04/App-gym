import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { useWorkout } from "@/controllers/workout-controller";
import { entryKey } from "@/domain/snapshot";
import { freezeToday, historySnapshot, PRESS, renderWithWorkout, TODAY } from "../../tests/workout-fixture";
import { ExerciseLogger } from "./exercise-logger";
import { RestTimerBar } from "./rest-timer";

// Hoy (miércoles) toca Empujes: su primer ejercicio, sin registros anteriores.
const MILITAR = BASE_ROUTINE.find((x) => x.day === 3)!;
// El número de la fila de la serie n en la tabla; su etiqueta dice cómo está ("Serie 1: ahora").
const chip = (n: number) => screen.getByLabelText(new RegExp("^Serie " + n + ":"));

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
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
  };

  it("al anotar, vibra un instante y ofrece deshacer junto al botón", () => {
    logFirstSet();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("× 6"));
    const undo = screen.getByRole("status");
    expect(undo).toHaveTextContent("Serie 1 anotada");
    expect(within(undo).getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  });

  it("«Deshacer» borra la serie, para el descanso y vuelve a esa serie", () => {
    logFirstSet();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
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
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
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
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("× 6"));
  });
});

describe("Hoy · −/+ de kg según el material (R26)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  const kgAfter = (name: string, from: string, button: string) => {
    const x = BASE_ROUTINE.find((e) => e.name === name)!;
    renderWithWorkout(<ExerciseLogger exercise={x} superset={null} />);
    const kg = screen.getByRole("spinbutton", { name: /carga en kg/ });
    fireEvent.change(kg, { target: { value: from } });
    fireEvent.click(screen.getByRole("button", { name: button }));
    return (kg as HTMLInputElement).value;
  };

  it("con mancuernas, + pasa de 16 a 18", () => {
    expect(kgAfter("Curl martillo con mancuernas", "16", "Subir peso")).toBe("18");
  });

  it("con mancuernas, − baja de 15 a 14", () => {
    expect(kgAfter("Curl martillo con mancuernas", "15", "Bajar peso")).toBe("14");
  });

  it("en polea, + suma 2,5 kg", () => {
    expect(kgAfter("Face pull en polea", "16", "Subir peso")).toBe("18.5");
  });
});

describe("Hoy · sin «Discos» en la serie (R22)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("la fila que se escribe no tiene botón «Discos», aunque lleve peso", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /carga en kg/ }), { target: { value: "62.5" } });
    expect(screen.queryByRole("button", { name: /discos/i })).not.toBeInTheDocument();
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
    const c1 = () => screen.getByLabelText(/^Calentamiento 1:/);
    expect(c1()).toHaveAttribute("aria-label", "Calentamiento 1: ahora");
    fireEvent.change(screen.getByLabelText(/calentamiento 1, carga/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/calentamiento 1, repeticiones/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(c1()).toHaveAttribute("aria-label", "Calentamiento 1: 20 × 12");
    // El calentamiento no cuenta como serie de trabajo: la serie 1 sigue por hacer.
    expect(chip(1)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
  });

  it("como mucho tres series de calentamiento", () => {
    renderWithWorkout(<ExerciseLogger exercise={MILITAR} superset={null} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /Añadir calentamiento/ }));
    expect(screen.getByLabelText(/^Calentamiento 3:/)).toBeInTheDocument();
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
    for (const n of [1, 2, 3]) expect(chip(n)).toHaveAttribute("aria-label", expect.stringContaining("55 × 8"));
    expect(screen.queryByRole("button", { name: /Igual que la última vez/ })).not.toBeInTheDocument();
  });
});

// Spec progreso R4: «¡Nuevo récord!» sale solo al superar el peso más alto anterior.
describe("Hoy · nuevo récord por peso", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(TODAY + "T10:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  function Toast() {
    const { toast } = useWorkout();
    return <p data-testid="toast">{toast.visible ? toast.text : ""}</p>;
  }

  const log = (kg: string, reps: string) => {
    fireEvent.change(screen.getByRole("spinbutton", { name: /carga en kg/ }), { target: { value: kg } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /repeticiones/ }), { target: { value: reps } });
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    act(() => { vi.advanceTimersByTime(1600); });
    const skip = screen.queryByRole("button", { name: "Saltar" });
    if (skip) fireEvent.click(skip);
  };

  it("con el mismo peso y más repeticiones no hay récord; con más peso, sí", () => {
    const snap = historySnapshot();
    snap.entries[entryKey(3, 3, MILITAR.id, 1)] = { weight: "30", reps: "8", date: "2026-10-21" };
    renderWithWorkout(<><ExerciseLogger exercise={MILITAR} superset={null} /><RestTimerBar /><Toast /></>, snap);
    log("30", "12");
    expect(screen.getByTestId("toast")).not.toHaveTextContent(/récord/);
    log("32.5", "5");
    expect(screen.getByTestId("toast")).toHaveTextContent("¡Nuevo récord en " + MILITAR.name + "! 32,5 kg × 5");
  });
});

// Spec hoy R20: la tabla de series (como en Hevy o Strong).
describe("Hoy · la tabla de series", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("cada serie con «Anterior», carga, reps y ✓; el ✓ de otra fila vacía la guarda con lo propuesto (R20)", () => {
    renderWithWorkout(<><ExerciseLogger exercise={PRESS} superset={null} /><RestTimerBar /></>);
    const table = screen.getByRole("group", { name: "Series de " + PRESS.name });
    expect(within(table).getByText("Anterior")).toBeInTheDocument();
    expect(Array.from(table.querySelectorAll(".series-prev")).map((c) => c.textContent)).toEqual(["55×8", "55×8", "55×8"]);
    // La 1 es la actual (se escribe en ella); la 3 viene propuesta en gris.
    expect(chip(1)).toHaveAttribute("aria-label", "Serie 1: ahora");
    expect(chip(3)).toHaveAttribute("aria-label", "Serie 3: vacía");
    fireEvent.click(within(table).getByRole("button", { name: "Guardar serie 3 con lo propuesto" }));
    expect(chip(3)).toHaveAttribute("aria-label", "Serie 3: 55 × 8");
    expect(chip(3).querySelector(".series-check.on")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Serie 3 anotada");
    // La actual sigue siendo la 1.
    expect(chip(1)).toHaveAttribute("aria-label", "Serie 1: ahora");
  });

  it("al tocar el ✓ verde de una serie hecha se abre para cambiarla y «Guardar cambios» la guarda (R21)", () => {
    renderWithWorkout(<ExerciseLogger exercise={PRESS} superset={null} />);
    const table = screen.getByRole("group", { name: "Series de " + PRESS.name });
    fireEvent.click(within(table).getByRole("button", { name: "Guardar serie 3 con lo propuesto" }));
    // El ✓ verde de la fila hecha es lo que se toca para cambiarla.
    const row = within(table).getByRole("button", { name: /^Serie 3: 55 × 8/ });
    fireEvent.click(row.querySelector(".series-check")!);
    expect(chip(3)).toHaveAttribute("aria-label", expect.stringContaining("55 × 8"));
    expect(screen.getByRole("spinbutton", { name: /serie 3, carga en kg/ })).toHaveValue(55);
    const reps = screen.getByRole("spinbutton", { name: /serie 3, repeticiones/ });
    expect(reps).toHaveValue(8);
    fireEvent.change(reps, { target: { value: "10" } });
    // El botón grande de abajo (el ✓ de la fila se llama «Guardar cambios de la serie 3»).
    fireEvent.click(screen.getByRole("button", { name: /^Guardar cambios(?! de)/ }));
    expect(chip(3)).toHaveAttribute("aria-label", "Serie 3: 55 × 10");
  });
});
