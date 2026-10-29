import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlateCalculator } from "./plate-calculator";

const perSide = () => within(screen.getByRole("list", { name: "Discos en cada lado" })).getAllByRole("listitem").map((li) => li.textContent);

describe("Calculadora de discos", () => {
  it("los discos de cada lado salen agrupados (2 × 25 kg) y se ve la cuenta completa", () => {
    render(<PlateCalculator initialTotal="140" onClose={() => {}} />);
    expect(perSide()).toEqual(["2 × 25 kg", "1 × 10 kg"]);
    expect(screen.getByText("20 + 2 × 60 = 140 kg")).toBeInTheDocument();
  });

  it("con − y + se cambia el peso de 2,5 en 2,5", () => {
    render(<PlateCalculator initialTotal="60" onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Sumar 2,5 kg" }));
    expect(screen.getByRole("spinbutton", { name: "Peso total" })).toHaveValue(62.5);
    fireEvent.click(screen.getByRole("button", { name: "Restar 2,5 kg" }));
    fireEvent.click(screen.getByRole("button", { name: "Restar 2,5 kg" }));
    expect(screen.getByRole("spinbutton", { name: "Peso total" })).toHaveValue(57.5);
  });

  it("con poco peso dice que basta la barra", () => {
    render(<PlateCalculator initialTotal="20" onClose={() => {}} />);
    expect(screen.getByText(/Solo la barra/)).toBeInTheDocument();
  });

  it("avisa si no se puede hacer exacto con los discos", () => {
    render(<PlateCalculator initialTotal="61" onClose={() => {}} />);
    expect(screen.getByText(/quedan 1 kg sin poner/)).toBeInTheDocument();
  });
});
