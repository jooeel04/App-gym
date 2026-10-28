"use client";

import { useState } from "react";

export interface ChartPoint {
  key: string;
  value: number;
  label: string; // valor formateado, p. ej. "95 kg"
  sub: string; // contexto, p. ej. "Semana 3 · 80 kg × 6"
}

// Gráfica de línea pequeña en la que cada bolita se puede tocar (o pasar el
// ratón) para ver su valor; por defecto muestra el último.
export function TapLineChart({ points, color, caption }: { points: ChartPoint[]; color: string; caption: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 300, H = 70, pad = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const active = selected ?? points.length - 1, p = points[active];

  return (
    <div className="spark-wrap">
      <div className="spark-label">
        <strong>{p.label}</strong>
        <span>{p.sub}{selected === null ? " · último" : ""}</span>
      </div>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={caption}>
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          points={points.map((pt, i) => x(i) + "," + y(pt.value)).join(" ")} />
        {points.map((pt, i) => (
          <g key={pt.key} className="spark-point" role="button" tabIndex={0} aria-label={pt.label + ", " + pt.sub}
            onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(i); }}>
            <circle cx={x(i)} cy={y(pt.value)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(pt.value)} r={i === active ? 6 : 4} fill={color} stroke="var(--s0)" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </div>
  );
}
