import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

// Spec rutina R1–R3: días de rutina propios (añadir, cambiar nombre y eliminar).
describe("Rutina · tus días de rutina", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  const edit = () => {
    renderWithWorkout(<><RoutineView /><ConfirmDialog /></>);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  };
  const nameDialog = () => screen.getByRole("dialog", { name: /nombre|Nuevo día/i });

  it("«Añadir día» pide un nombre y crea el día vacío; con 7 días ya no sale (R1)", () => {
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Añadir día" }));
    fireEvent.change(within(nameDialog()).getByLabelText("Nombre del día"), { target: { value: "Full body" } });
    fireEvent.click(within(nameDialog()).getByRole("button", { name: "Añadir día" }));
    const day = dayButton(/Full body/);
    expect(day).toHaveTextContent("Sin día fijo");
    expect(day).toHaveTextContent("0 ejercicios");
    fireEvent.click(screen.getByRole("button", { name: "Añadir día" }));
    fireEvent.change(within(nameDialog()).getByLabelText("Nombre del día"), { target: { value: "Cardio" } });
    fireEvent.click(within(nameDialog()).getByRole("button", { name: "Añadir día" }));
    expect(screen.queryByRole("button", { name: "Añadir día" })).not.toBeInTheDocument();
  });

  it("«Cambiar nombre» cambia el nombre del día (R2)", () => {
    edit();
    fireEvent.click(dayButton(/Lunes/));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar nombre" }));
    const input = within(nameDialog()).getByLabelText("Nombre del día");
    expect(input).toHaveValue("Torso");
    fireEvent.change(input, { target: { value: "Pecho y espalda" } });
    fireEvent.click(within(nameDialog()).getByRole("button", { name: "Guardar nombre" }));
    expect(dayButton(/Lunes/)).toHaveTextContent("Pecho y espalda");
  });

  it("«Eliminar día» pregunta y, al confirmar, lo borra con sus ejercicios (R3)", async () => {
    edit();
    fireEvent.click(dayButton(/Lunes/));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar día" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("¿Eliminar «Torso»?");
    fireEvent.click(within(confirm).getByRole("button", { name: "Eliminar día" }));
    await waitFor(() => expect(screen.queryByText(/Torso/)).not.toBeInTheDocument());
    expect(screen.queryByText(PRESS.name)).not.toBeInTheDocument();
  });
});
