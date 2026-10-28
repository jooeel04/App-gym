"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface ChartPoint {
  key: string;
  value: number;
  label: string; // valor formateado, p. ej. "95 kg"
  sub: string; // contexto, p. ej. "Semana 3 · 80 kg × 6"
  tick?: string; // texto corto bajo el punto, p. ej. "3 nov"
}

const STEP = 48; // px entre puntos (lo cómodo para tocar con el dedo); con muchos datos se desliza
const H = 160, TOP = 16, BOTTOM = 28, SIDE = 16, END = 28; // END: sitio para la última fecha

const axis = (v: number) => (Math.round(v * 10) / 10).toLocaleString("es-ES");

// Gráfica de línea pensada para el móvil: se desliza con el dedo en horizontal y
// empieza mostrando lo más reciente. Cada punto se puede tocar para ver su valor;
// por defecto muestra el último.
export function TapLineChart({ points, color, caption }: { points: ChartPoint[]; color: string; caption: string }) {
  const [picked, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = points.length, ready = count >= 2;

  // Ancho visible de la gráfica (cambia al girar el móvil o al redimensionar).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  // Al abrirla, o al cambiar de datos, se coloca al final (lo más reciente).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [count, caption, width]);

  if (!ready) return null;
  // Si la gráfica pasa a tener menos puntos (otro ejercicio), vuelve al último.
  const selected = picked !== null && picked < count ? picked : null;
  const W = Math.max(width, SIDE + END + (count - 1) * STEP);
  const scrollable = width > 0 && W > width + 1;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const min = lo - span * 0.1, max = hi + span * 0.1;
  const x = (i: number) => SIDE + (i * (W - SIDE - END)) / (count - 1);
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM);
  const active = selected ?? count - 1, p = points[active];
  const grid = [hi, (hi + lo) / 2, lo];
  // Fechas sin pisarse: una de cada `every` según la separación entre puntos.
  const every = Math.max(1, Math.ceil(48 / ((W - SIDE - END) / (count - 1))));

  return (
    <div className="spark-wrap">
      <div className="spark-label">
        <strong>{p.label}</strong>
        <span>{p.sub}{selected === null ? " · último" : ""}</span>
      </div>
      <div className="spark-frame">
        <div className="spark-axis" aria-hidden="true">
          {grid.map((v, i) => <span key={i} style={{ top: y(v) }}>{axis(v)}</span>)}
        </div>
        <div ref={scrollRef} className={"spark-scroll" + (scrollable ? " scrollable" : "")}>
          <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={caption}>
            {grid.map((v, i) => <line key={i} className="spark-grid" x1={0} x2={W} y1={y(v)} y2={y(v)} />)}
            <line className="spark-cursor" x1={x(active)} x2={x(active)} y1={TOP - 6} y2={H - BOTTOM} />
            <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
              points={points.map((pt, i) => x(i) + "," + y(pt.value)).join(" ")} />
            {points.map((pt, i) => (
              <g key={pt.key} className="spark-point" role="button" tabIndex={0} aria-label={pt.label + ", " + pt.sub}
                onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(i); }}>
                <rect x={x(i) - STEP / 2} y={0} width={STEP} height={H} fill="transparent" />
                <circle cx={x(i)} cy={y(pt.value)} r={i === active ? 6 : 4} fill={color} stroke="var(--s0)" strokeWidth="2" />
                {pt.tick && (count - 1 - i) % every === 0 && (
                  <text className={"spark-tick" + (i === active ? " on" : "")} x={x(i)} y={H - 8} textAnchor="middle">{pt.tick}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
      {scrollable && <p className="spark-hint">← Desliza para ver fechas anteriores</p>}
    </div>
  );
}
