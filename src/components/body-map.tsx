"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MUSCLE_NAMES, type Muscle } from "@/domain/exercise-library";

type Shape = ReactNode;
const FRONT = 50, BACK = 150;

// Silueta de una figura centrada en `cx`: hombros anchos, cintura más estrecha.
function silhouette(cx: number) {
  return (
    <g className="bm-body">
      <ellipse cx={cx} cy={14} rx={8} ry={9.5} />
      <rect x={cx - 4} y={21} width={8} height={9} rx={2} />
      <path d={`M${cx - 6} 27 L${cx - 17} 30 Q${cx - 23} 32 ${cx - 21} 39 L${cx - 15} 90 L${cx + 15} 90 L${cx + 21} 39 Q${cx + 23} 32 ${cx + 17} 30 L${cx + 6} 27 Z`} />
      <rect x={cx - 15} y={84} width={30} height={23} rx={8} />
      <rect x={cx - 30} y={34} width={9} height={36} rx={4.5} />
      <rect x={cx + 21} y={34} width={9} height={36} rx={4.5} />
      <rect x={cx - 29} y={66} width={8} height={31} rx={4} />
      <rect x={cx + 21} y={66} width={8} height={31} rx={4} />
      <ellipse cx={cx - 25} cy={100} rx={4} ry={5} />
      <ellipse cx={cx + 25} cy={100} rx={4} ry={5} />
      <rect x={cx - 14} y={102} width={13} height={50} rx={6} />
      <rect x={cx + 1} y={102} width={13} height={50} rx={6} />
      <rect x={cx - 13} y={146} width={11} height={36} rx={5} />
      <rect x={cx + 2} y={146} width={11} height={36} rx={5} />
    </g>
  );
}

// Detalles que distinguen la vista: cara de frente; pelo y columna de espaldas.
const FRONT_DETAILS = (
  <g className="bm-detail">
    <circle cx={FRONT - 3} cy={13} r={1.2} />
    <circle cx={FRONT + 3} cy={13} r={1.2} />
    <path d={`M${FRONT} 15 v3`} className="bm-line" />
  </g>
);
const BACK_DETAILS = (
  <g className="bm-detail">
    <path d={`M${BACK - 8} 13 Q${BACK - 8} 4 ${BACK} 4.5 Q${BACK + 8} 4 ${BACK + 8} 13 Q${BACK + 8} 20 ${BACK} 21 Q${BACK - 8} 20 ${BACK - 8} 13 Z`} className="bm-hair" />
    <path d={`M${BACK} 30 V88`} className="bm-line" />
  </g>
);

const pair = (cx: number, dx: number, cy: number, rx: number, ry: number) => (
  <><ellipse cx={cx - dx} cy={cy} rx={rx} ry={ry} /><ellipse cx={cx + dx} cy={cy} rx={rx} ry={ry} /></>
);

// Zonas de cada músculo: figura de frente (cx = 50) y de espaldas (cx = 150).
const MUSCLE_SHAPES: Record<Muscle, Shape> = {
  frontDelts: pair(FRONT, 20, 37, 5.5, 6),
  sideDelts: <>{pair(FRONT, 25, 41, 3.5, 6)}{pair(BACK, 25, 41, 3.5, 6)}</>,
  rearDelts: pair(BACK, 20, 37, 5.5, 6),
  chest: pair(FRONT, 8, 45, 8, 6.5),
  biceps: pair(FRONT, 25.5, 55, 3.6, 9),
  triceps: pair(BACK, 25.5, 55, 3.6, 9),
  forearms: <>{pair(FRONT, 25, 80, 3.3, 10)}{pair(BACK, 25, 80, 3.3, 10)}</>,
  abs: <rect x={FRONT - 6} y={55} width={12} height={31} rx={4} />,
  obliques: pair(FRONT, 12, 72, 3.2, 10),
  traps: <path d={`M${BACK - 14} 31 L${BACK} 24 L${BACK + 14} 31 L${BACK} 50 Z`} />,
  upperBack: pair(BACK, 6, 46, 4, 8),
  lats: pair(BACK, 11.5, 63, 5.5, 14),
  lowerBack: <rect x={BACK - 6} y={74} width={12} height={14} rx={4} />,
  glutes: pair(BACK, 7, 97, 7.5, 8),
  quads: pair(FRONT, 7.5, 124, 5.8, 18),
  adductors: pair(FRONT, 2.6, 112, 2.2, 9),
  hamstrings: pair(BACK, 7.5, 126, 5.5, 18),
  calves: <>{pair(FRONT, 7.5, 160, 3.8, 11)}{pair(BACK, 7.5, 158, 4.8, 12)}</>,
};

const ALL = Object.keys(MUSCLE_SHAPES) as Muscle[];
const RANK = { "bm-idle": 0, "bm-secondary": 1, "bm-primary": 2 } as const;

function Figure({ primary, secondary, labels, className }: { primary: Muscle[]; secondary: Muscle[]; labels: boolean; className: string }) {
  const tone = (m: Muscle) => (primary.includes(m) ? "bm-primary" : secondary.includes(m) ? "bm-secondary" : "bm-idle");
  return (
    <svg className={className} viewBox={labels ? "0 0 200 200" : "0 0 200 186"} aria-hidden="true">
      {silhouette(FRONT)}
      {silhouette(BACK)}
      {/* Los resaltados se dibujan al final para quedar por encima de los que se solapan. */}
      {[...ALL].sort((a, b) => RANK[tone(a)] - RANK[tone(b)]).map((m) => <g key={m} className={tone(m)}>{MUSCLE_SHAPES[m]}</g>)}
      {FRONT_DETAILS}
      {BACK_DETAILS}
      {labels && (
        <g className="bm-label">
          <text x={FRONT} y={197} textAnchor="middle">FRENTE</text>
          <text x={BACK} y={197} textAnchor="middle">ESPALDA</text>
        </g>
      )}
    </svg>
  );
}

const names = (list: Muscle[]) => list.map((m) => MUSCLE_NAMES[m]).join(", ");

// Mapa del cuerpo (frente y espalda): músculos principales en rojo fuerte y
// secundarios en rojo suave. Al tocarlo se amplía; al tocar otra vez se cierra.
export function BodyMap({ primary, secondary = [], size = "md", labels = false }: {
  primary: Muscle[];
  secondary?: Muscle[];
  size?: "sm" | "md" | "lg";
  labels?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
  const label = "Trabaja " + names(primary) + (secondary.length ? "; también " + names(secondary) : "");

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <>
      <button type="button" className={"bodymap " + size} aria-label={label + ". Toca para ampliar"} title="Toca para ampliar"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomed(true); }}>
        <Figure primary={primary} secondary={secondary} labels={labels} className="bm-svg" />
      </button>
      {zoomed && createPortal(
        <div className="bm-zoom" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <div className="bm-zoom-card">
            <Figure primary={primary} secondary={secondary} labels className="bm-svg" />
            <div className="bm-legend">
              <span><i className="bm-chip primary" />{names(primary)}</span>
              {secondary.length > 0 && <span><i className="bm-chip secondary" />{names(secondary)}</span>}
            </div>
            <small>Toca para cerrar</small>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
