import type { ReactNode } from "react";
import { MUSCLE_NAMES, type Muscle } from "@/domain/exercise-library";

type Shape = ReactNode;

// Silueta de una figura centrada en `cx`.
function silhouette(cx: number) {
  return (
    <g className="bm-body">
      <circle cx={cx} cy={15} r={9} />
      <rect x={cx - 4} y={22} width={8} height={8} rx={2} />
      <rect x={cx - 18} y={29} width={36} height={64} rx={10} />
      <rect x={cx - 15} y={86} width={30} height={22} rx={8} />
      <rect x={cx - 29} y={33} width={10} height={62} rx={5} />
      <rect x={cx + 19} y={33} width={10} height={62} rx={5} />
      <circle cx={cx - 24} cy={99} r={4.5} />
      <circle cx={cx + 24} cy={99} r={4.5} />
      <rect x={cx - 14} y={104} width={13} height={78} rx={6} />
      <rect x={cx + 1} y={104} width={13} height={78} rx={6} />
    </g>
  );
}

const pair = (cx: number, dx: number, cy: number, rx: number, ry: number) => (
  <><ellipse cx={cx - dx} cy={cy} rx={rx} ry={ry} /><ellipse cx={cx + dx} cy={cy} rx={rx} ry={ry} /></>
);

// Zonas de cada músculo: figura de frente (cx = 50) y de espaldas (cx = 150).
const FRONT = 50, BACK = 150;
const MUSCLE_SHAPES: Record<Muscle, Shape> = {
  frontDelts: pair(FRONT, 21, 38, 6, 6),
  sideDelts: <>{pair(FRONT, 25.5, 43, 3.5, 6)}{pair(BACK, 25.5, 43, 3.5, 6)}</>,
  rearDelts: pair(BACK, 21, 38, 6, 6),
  chest: pair(FRONT, 8, 46, 8, 6.5),
  biceps: pair(FRONT, 24, 57, 4, 8.5),
  triceps: pair(BACK, 24, 57, 4, 8.5),
  forearms: <>{pair(FRONT, 24, 80, 3.8, 10)}{pair(BACK, 24, 80, 3.8, 10)}</>,
  abs: <rect x={FRONT - 6} y={56} width={12} height={30} rx={4} />,
  obliques: pair(FRONT, 12.5, 72, 3.5, 10),
  traps: <path d={`M${BACK - 13} 32 L${BACK} 25 L${BACK + 13} 32 L${BACK} 50 Z`} />,
  upperBack: pair(BACK, 6, 47, 4, 8),
  lats: pair(BACK, 11.5, 64, 5.5, 14),
  lowerBack: <rect x={BACK - 6} y={74} width={12} height={15} rx={4} />,
  glutes: pair(BACK, 7, 98, 7.5, 8),
  quads: pair(FRONT, 7.5, 128, 5.8, 18),
  adductors: pair(FRONT, 2.6, 115, 2.2, 9),
  hamstrings: pair(BACK, 7.5, 128, 5.5, 17),
  calves: <>{pair(FRONT, 7.5, 162, 4, 11)}{pair(BACK, 7.5, 158, 5, 12)}</>,
};

const ALL = Object.keys(MUSCLE_SHAPES) as Muscle[];
const RANK = { "bm-idle": 0, "bm-secondary": 1, "bm-primary": 2 } as const;

// Mapa del cuerpo (frente y espalda) con los músculos principales en color fuerte
// y los secundarios en color suave.
export function BodyMap({ primary, secondary = [], size = "md", labels = false }: {
  primary: Muscle[];
  secondary?: Muscle[];
  size?: "sm" | "md" | "lg";
  labels?: boolean;
}) {
  const label = "Trabaja " + primary.map((m) => MUSCLE_NAMES[m]).join(", ")
    + (secondary.length ? "; también " + secondary.map((m) => MUSCLE_NAMES[m]).join(", ") : "");
  const tone = (m: Muscle) => (primary.includes(m) ? "bm-primary" : secondary.includes(m) ? "bm-secondary" : "bm-idle");
  return (
    <svg className={"bodymap " + size} viewBox={labels ? "0 0 200 196" : "0 0 200 186"} role="img" aria-label={label}>
      <title>{label}</title>
      {silhouette(FRONT)}
      {silhouette(BACK)}
      {/* Los resaltados se dibujan al final para quedar por encima de los que se solapan. */}
      {[...ALL].sort((a, b) => RANK[tone(a)] - RANK[tone(b)]).map((m) => <g key={m} className={tone(m)}>{MUSCLE_SHAPES[m]}</g>)}
      {labels && (
        <g className="bm-label">
          <text x={FRONT} y={194} textAnchor="middle">Frente</text>
          <text x={BACK} y={194} textAnchor="middle">Espalda</text>
        </g>
      )}
    </svg>
  );
}
