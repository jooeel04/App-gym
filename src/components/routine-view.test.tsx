import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, PRESS, renderWithWorkout } from "../../tests/workout-fixture";
import { ConfirmDialog } from "./confirm-dialog";
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

// Spec interfaz R1: eliminar un ejercicio con registros se confirma con la ventana de la app.
describe("Rutina · eliminar un ejercicio con registros", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  const removePress = () => {
    renderWithWorkout(<><RoutineView /><ConfirmDialog /></>);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: /^Lunes/, expanded: false }));
    const row = screen.getByText(PRESS.name).closest(".routine-ex") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
  };

  it("pregunta antes y «Cancelar» lo deja como estaba", () => {
    const native = vi.spyOn(window, "confirm");
    removePress();
    const dialog = screen.getByRole("alertdialog", { name: /Eliminar «.+»/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText(PRESS.name)).toBeInTheDocument();
    expect(native).not.toHaveBeenCalled();
  });

  it("al confirmar se elimina", async () => {
    removePress();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    await vi.waitFor(() => expect(screen.queryByText(PRESS.name)).not.toBeInTheDocument());
  });
});

// Spec interfaz R1: en ninguna parte de la app queda el `confirm()` del navegador.
describe("Interfaz · sin ventanas del navegador", () => {
  it("ningún archivo de la app llama a confirm()", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []);
    const offenders = files("src").filter((f) => /(^|[^.\w])confirm\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
