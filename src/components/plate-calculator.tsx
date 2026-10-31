"use client";

import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ALL_PLATES, BAR_OPTIONS as BARS, getPlatePrefs } from "@/lib/preferences";
import { closeOnBackdrop } from "./backdrop";
import { MinusIcon, PlusIcon } from "./icons";
// Colores habituales de los discos olímpicos.
const PLATE_STYLE: Record<number, { color: string; height: number }> = {
  25: { color: "#d62828", height: 92 }, 20: { color: "#1d6fe0", height: 92 }, 15: { color: "#e9b308", height: 84 },
  10: { color: "#2a9d55", height: 74 }, 5: { color: "#e8e8e8", height: 58 }, 2.5: { color: "#333842", height: 48 }, 1.25: { color: "#9aa1ab", height: 40 },
};

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Discos por lado para llegar a `total` con una barra de `bar` kg y los discos `available`.
export function platesFor(total: number, bar: number, available: number[] = ALL_PLATES) {
  let side = (total - bar) / 2;
  const plates: number[] = [];
  if (side <= 0) return { plates, rest: 0 };
  for (const p of available) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, rest: Math.round(side * 100) / 100 };
}

// Discos iguales juntos: [25, 25, 10] → [[25, 2], [10, 1]].
const grouped = (plates: number[]) => [...new Set(plates)].map((p) => [p, plates.filter((x) => x === p).length] as const);
const STEP = 2.5;

// Calculadora de discos: qué poner a cada lado de la barra. `initialTotal`: el peso con
// el que se abre (p. ej. el de la serie que se está anotando). Arriba el peso grande con
// − y +, debajo la barra dibujada con sus discos y la lista de discos de cada lado.
export function PlateCalculator({ onClose, initialTotal }: { onClose: () => void; initialTotal?: string }) {
  const [total, setTotal] = useState(() => (Number(initialTotal) > 0 ? String(initialTotal) : "60"));
  // La barra y los discos de tu gym (elegidos en Ajustes).
  const [prefs] = useState(getPlatePrefs);
  const [bar, setBar] = useState(prefs.bar);
  const kg = Number(total.replace(",", ".")) || 0;
  const { plates, rest } = platesFor(kg, bar, prefs.plates);
  const step = (dir: 1 | -1) => setTotal(String(Math.max(0, Math.round((kg + dir * STEP) / STEP) * STEP)));
  const side = plates.reduce((a, b) => a + b, 0);

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="platesTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal plates-modal">
        <h2 id="platesTitle">Calculadora de discos</h2>

        <div className="plates-total">
          <button type="button" className="plates-step" aria-label={"Restar " + fmt(STEP) + " kg"} onClick={() => step(-1)}><MinusIcon /></button>
          <label className="plates-kg">
            <input type="number" inputMode="decimal" min={0} step={0.5} aria-label="Peso total" value={total}
              style={{ "--digits": Math.max(total.length, 3) } as CSSProperties} onChange={(e) => setTotal(e.target.value)} />
            <span aria-hidden="true">kg</span>
          </label>
          <button type="button" className="plates-step" aria-label={"Sumar " + fmt(STEP) + " kg"} onClick={() => step(1)}><PlusIcon /></button>
        </div>
        <p className="plates-caption">Peso total, con la barra</p>

        <div className="segmented plates-bars" role="group" aria-label="Barra">
          {BARS.map((b) => (
            <button key={b} type="button" aria-pressed={bar === b} onClick={() => setBar(b)}>{b ? b + " kg" : "Sin barra"}</button>
          ))}
        </div>

        <div className="barbell" aria-hidden="true" style={{ "--n": Math.max(plates.length, 1) } as CSSProperties}>
          <span className="bb-end" />
          {[...plates].reverse().map((p, i) => <span key={"l" + i} className="bb-plate" style={{ backgroundColor: PLATE_STYLE[p].color, height: PLATE_STYLE[p].height }} />)}
          <span className="bb-collar" />
          <span className="bb-shaft" />
          <span className="bb-collar" />
          {plates.map((p, i) => <span key={"r" + i} className="bb-plate" style={{ backgroundColor: PLATE_STYLE[p].color, height: PLATE_STYLE[p].height }} />)}
          <span className="bb-end" />
        </div>

        <div className="plates-result">
          {kg <= bar ? <p className="plates-empty">{bar ? "Solo la barra (" + bar + " kg)." : "Escribe un peso."}</p>
            : plates.length ? (
              <>
                <div className="plates-side-title">En cada lado</div>
                <ul className="plates-side" aria-label="Discos en cada lado">
                  {grouped(plates).map(([p, n]) => (
                    <li key={p}>
                      <span className="plates-dot" style={{ background: PLATE_STYLE[p].color }} aria-hidden="true" />
                      {n} × {fmt(p)} kg
                    </li>
                  ))}
                </ul>
                <p className="plates-sum">{(bar ? fmt(bar) + " + " : "") + "2 × " + fmt(side) + " = " + fmt(bar + side * 2) + " kg"}</p>
              </>
            ) : <p className="plates-empty">No llega a un disco por lado.</p>}
          {rest > 0 && <p className="plates-rest">No sale exacto: quedan {fmt(rest * 2)} kg sin poner (no tienes discos tan pequeños).</p>}
        </div>
        <div className="modal-actions"><button className="primary" type="button" onClick={onClose}>Listo</button></div>
      </div>
    </div>,
    document.body,
  );
}
