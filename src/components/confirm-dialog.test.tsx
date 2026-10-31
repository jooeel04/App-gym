import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { askConfirm, ConfirmDialog } from "./confirm-dialog";

// Spec interfaz R1: las confirmaciones son una ventana de la app, no la del navegador.
describe("Ventana para confirmar", () => {
  afterEach(() => vi.restoreAllMocks());

  const ask = () => {
    render(<ConfirmDialog />);
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => { answer = askConfirm({ title: "¿Borrar los registros?", text: "No se puede deshacer.", action: "Borrar", danger: true }); });
    return answer;
  };

  it("muestra el título, la explicación y el botón con el nombre de la acción", () => {
    const native = vi.spyOn(window, "confirm");
    void ask();
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar los registros?" });
    expect(dialog).toHaveTextContent("No se puede deshacer.");
    expect(within(dialog).getByRole("button", { name: "Borrar" })).toHaveClass("danger-btn");
    expect(native).not.toHaveBeenCalled();
  });

  it("pulsar la acción responde que sí y cierra la ventana", async () => {
    const answer = ask();
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("«Cancelar» responde que no", async () => {
    const answer = ask();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(answer).resolves.toBe(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
