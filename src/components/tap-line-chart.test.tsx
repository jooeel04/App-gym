import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TapLineChart, type ChartPoint } from "./tap-line-chart";

const points = (n: number): ChartPoint[] => Array.from({ length: n }, (_, i) => ({
  key: "p" + i, value: 50 + i, label: (50 + i) + " kg", sub: "Semana " + (i + 1), tick: "S" + (i + 1),
}));

describe("TapLineChart", () => {
  it("con menos de dos puntos no dibuja nada", () => {
    const { container } = render(<TapLineChart points={points(1)} color="red" caption="Fuerza" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el último valor por defecto", () => {
    render(<TapLineChart points={points(5)} color="red" caption="Fuerza" />);
    expect(screen.getByText("54 kg")).toBeInTheDocument();
    expect(screen.getByText(/Semana 5 · último/)).toBeInTheDocument();
  });

  it("al tocar un punto enseña su valor", () => {
    render(<TapLineChart points={points(5)} color="red" caption="Fuerza" />);
    fireEvent.click(screen.getByRole("button", { name: "51 kg, Semana 2" }));
    expect(screen.getByText("51 kg")).toBeInTheDocument();
    expect(screen.queryByText(/último/)).not.toBeInTheDocument();
  });

  it("si cambia a menos puntos tras elegir uno lejano, vuelve al último sin romperse", () => {
    const { rerender } = render(<TapLineChart points={points(8)} color="red" caption="Fuerza" />);
    fireEvent.click(screen.getByRole("button", { name: "57 kg, Semana 8" }));
    rerender(<TapLineChart points={points(3)} color="red" caption="Otra" />);
    expect(screen.getByText("52 kg")).toBeInTheDocument();
    expect(screen.getByText(/Semana 3 · último/)).toBeInTheDocument();
  });

  it("anuncia la gráfica con su descripción y cada punto se puede tocar", () => {
    render(<TapLineChart points={points(3)} color="red" caption="Fuerza de Press por fecha" />);
    expect(screen.getByRole("group", { name: "Fuerza de Press por fecha" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
