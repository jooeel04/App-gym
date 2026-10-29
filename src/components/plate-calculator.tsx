"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ALL_PLATES, BAR_OPTIONS as BARS, getPlatePrefs } from "@/lib/preferences";
import { closeOnBackdrop } from "./backdrop";
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

// Calculadora de discos: qué poner a cada lado de la barra. `initialTotal`: el peso con
// el que se abre (p. ej. el de la serie que se está anotando).
export function PlateCalculator({ onClose, initialTotal }: { onClose: () => void; initialTotal?: string }) {
  const [total, setTotal] = useState(() => (Number(initialTotal) > 0 ? String(initialTotal) : "60"));
  // La barra y los discos de tu gym (elegidos en Ajustes).
  const [prefs] = useState(getPlatePrefs);
  const [bar, setBar] = useState(prefs.bar);
  const kg = Number(total.replace(",", "."));
  const { plates, rest } = platesFor(kg, bar, prefs.plates);

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="platesTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal plates-modal">
        <h2 id="platesTitle">Calculadora de discos</h2>
        <label className="form-label">Peso total que quieres levantar (kg)
          <input type="number" inputMode="decimal" min={0} step={0.5} value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <div className="form-label">Barra</div>
        <div className="segmented">
          {BARS.map((b) => (
            <button key={b} type="button" aria-pressed={bar === b} onClick={() => setBar(b)}>{b ? b + " kg" : "Sin barra"}</button>
          ))}
        </div>

        <div className="bar-visual" aria-hidden="true">
          <span className="bar-sleeve" />
          {plates.map((p, i) => (
            <span key={i} className="plate" style={{ background: PLATE_STYLE[p].color, height: PLATE_STYLE[p].height }}>{fmt(p)}</span>
          ))}
          <span className="bar-end" />
        </div>

        <p className="plates-result">
          {kg <= bar ? (bar ? "Solo la barra (" + bar + " kg)." : "Escribe un peso.")
            : plates.length
              ? <>En <b>cada lado</b>: {plates.map(fmt).join(" + ")} kg</>
              : "No llega a un disco por lado."}
          {rest > 0 && <span className="plates-rest">Sobran {fmt(rest * 2)} kg que no se pueden poner con tus discos.</span>}
        </p>
        <div className="modal-actions"><button className="primary" type="button" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>,
    document.body,
  );
}
