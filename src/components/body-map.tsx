"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MUSCLE_NAMES, type Muscle } from "@/domain/exercise-library";

// Lámina anatómica: figura de frente y de espaldas en gris, cada músculo con su
// forma, y los que trabaja el ejercicio en rojo. Cada figura mide 100 × 232 y se
// describe solo su mitad derecha (x ≥ 50): la izquierda es su reflejo.

const HEAD = "M50 4 Q61 4 61 17 Q61 28 50 31 Q39 28 39 17 Q39 4 50 4 Z";

// Silueta (mitad derecha): cuello, tronco, brazo, mano y pierna con pie.
const BASE = [
  "M50 28 L56 28 L58 40 L50 40 Z",
  "M50 38 L58 38 Q66 40 73 42 Q81 45 82 54 L81 63 L73 65 Q71 76 69 82 Q70 100 68 112 Q72 120 71 129 L66 134 L50 135 Z",
  "M73 42 Q83 43 84 55 Q86 73 83 92 Q86 108 82 128 L72 128 Q68 110 70 92 Q68 76 71 64 Z",
  "M72 127 Q80 125 82 129 Q84 139 79 148 Q74 150 71 144 Q70 135 72 127 Z",
  "M50 128 L71 126 Q75 140 73 156 Q71 168 67 175 Q69 186 69 196 Q67 208 62 214 L61 221 Q64 226 62 229 L54 229 Q53 222 55 214 Q53 196 54 182 Q52 176 52 170 Q51 150 51.5 135 Z",
];

const FOREARM = "M71 94 Q78 92 82 96 Q85 108 81 126 Q77 128 73 126 Q69 110 71 94 Z";

const FRONT_MUSCLES: Partial<Record<Muscle, string[]>> = {
  traps: ["M56 33 Q63 37 71 41 L60 41 Q57 38 56 33 Z"],
  frontDelts: ["M60 42 Q67 40 72 42 Q74 51 72 60 Q68 52 61 47 Z"],
  sideDelts: ["M72 42 Q80 43 82 50 Q84 57 81 63 Q77 64 73 61 Q75 51 72 42 Z"],
  chest: ["M51 45 L60 44 Q67 47 72 53 Q74 60 71 66 Q62 72 52 70 Q50 60 51 45 Z"],
  biceps: ["M73 64 Q79 62 81 70 Q82 82 78 91 Q74 93 72 89 Q70 76 73 64 Z"],
  triceps: ["M81 64 Q85 73 83 90 L80 89 Q82 76 81 64 Z"],
  forearms: [FOREARM],
  abs: [
    "M51 71 L58 71 L58 80 L51 80 Z",
    "M51 82 L58 82 L58 91 L51 91 Z",
    "M51 93 L58 93 L58 102 L51 102 Z",
    "M51 104 L57.5 104 Q57 114 51 120 Z",
  ],
  obliques: ["M59.5 73 Q66 70 69 76 Q70 92 67 108 Q63 116 59.5 119 Z"],
  lats: ["M70 66 Q73 70 71 79 L68 75 Z"],
  adductors: ["M52 129 Q57 130 58 134 Q55.5 148 53.5 152 Q52 140 52 129 Z"],
  quads: [
    "M58 133 Q64 131 66 141 Q67 158 63 170 Q60 172 58 168 Q55 150 58 133 Z",
    "M66 132 Q72 137 71 152 Q69 166 65 172 L63.5 170 Q67.5 158 66.5 140 Z",
    "M54 152 Q58 157 58 168 Q56 174 52.5 172 Q51.5 162 54 152 Z",
  ],
  calves: [
    "M62 179 Q68 183 67.5 196 Q65 206 61.5 208 Q60 192 62 179 Z",
    "M55 180 Q59 181 60 194 Q59 207 57 212 Q54.5 196 55 180 Z",
  ],
};

const BACK_MUSCLES: Partial<Record<Muscle, string[]>> = {
  traps: ["M50 29 Q56 33 59 38 Q68 41 74 44 Q64 48 58 56 Q53 66 50 77 Z"],
  rearDelts: ["M68 43 Q77 42 80 49 Q81 57 78 62 Q74 54 67 48 Z"],
  sideDelts: ["M78 44 Q84 50 82 62 L78.5 62 Q81.5 54 78 44 Z"],
  upperBack: ["M59 50 Q66 47 72 51 Q73 58 68 64 Q61 64 57.5 60 Z"],
  lats: ["M58 62 Q67 64 71 68 Q72 84 66 100 Q60 108 53 112 Q52 92 56 76 Z"],
  lowerBack: ["M50.8 84 L55 84 Q57 100 56 116 L50.8 118 Z"],
  triceps: ["M72 64 Q80 62 82.5 70 Q83.5 84 79 92 Q74 92 72 86 Q70.5 74 72 64 Z"],
  forearms: [FOREARM],
  glutes: ["M51 117 Q62 113 69.5 121 Q72 133 66 142 Q58 146 51 142 Z"],
  hamstrings: [
    "M52.5 146 Q57 144 59.5 146 Q60 160 58 173 Q54.5 174 53 170 Q51.5 158 52.5 146 Z",
    "M60.5 145 Q65 144 67 147 Q70 160 66 172 Q62 175 59.5 173 Q61.5 160 60.5 145 Z",
  ],
  calves: [
    "M54 177 Q57.5 173 60 176 Q60.5 192 59 202 Q55.5 203 54.5 196 Q52.5 186 54 177 Z",
    "M60.5 176 Q64.5 173 66.5 179 Q68.5 190 65 200 Q62 203 60 201 Q61 190 60.5 176 Z",
  ],
};

type Tone = "bm-idle" | "bm-secondary" | "bm-primary";
const RANK: Record<Tone, number> = { "bm-idle": 0, "bm-secondary": 1, "bm-primary": 2 };

// Una forma de la mitad derecha y su reflejo en la mitad izquierda.
function Mirrored({ paths }: { paths: string[] }) {
  return (
    <>
      {paths.map((d, i) => <path key={i} d={d} />)}
      <g transform="translate(100 0) scale(-1 1)">{paths.map((d, i) => <path key={i} d={d} />)}</g>
    </>
  );
}

function View({ muscles, x, tone }: { muscles: Partial<Record<Muscle, string[]>>; x: number; tone: (m: Muscle) => Tone }) {
  // Los resaltados se dibujan al final para quedar por encima de los que se solapan.
  const ordered = (Object.keys(muscles) as Muscle[]).sort((a, b) => RANK[tone(a)] - RANK[tone(b)]);
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="bm-body"><path d={HEAD} /><Mirrored paths={BASE} /></g>
      {ordered.map((m) => <g key={m} className={"bm-muscle " + tone(m)}><Mirrored paths={muscles[m]!} /></g>)}
    </g>
  );
}

function Figure({ primary, secondary, labels }: { primary: Muscle[]; secondary: Muscle[]; labels: boolean }) {
  const tone = (m: Muscle): Tone => (primary.includes(m) ? "bm-primary" : secondary.includes(m) ? "bm-secondary" : "bm-idle");
  return (
    <svg className="bm-svg" viewBox={labels ? "0 0 210 246" : "0 0 210 232"} aria-hidden="true">
      <View muscles={FRONT_MUSCLES} x={0} tone={tone} />
      <View muscles={BACK_MUSCLES} x={110} tone={tone} />
      {labels && (
        <g className="bm-label">
          <text x={50} y={243} textAnchor="middle">FRENTE</text>
          <text x={160} y={243} textAnchor="middle">ESPALDA</text>
        </g>
      )}
    </svg>
  );
}

const names = (list: Muscle[]) => list.map((m) => MUSCLE_NAMES[m]).join(", ");

// Mapa del cuerpo: músculos principales en rojo fuerte y secundarios en rojo suave.
// Al tocarlo se amplía; al tocar otra vez se cierra.
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
        <Figure primary={primary} secondary={secondary} labels={labels} />
      </button>
      {zoomed && createPortal(
        <div className="bm-zoom" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <div className="bm-zoom-card">
            <Figure primary={primary} secondary={secondary} labels />
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
