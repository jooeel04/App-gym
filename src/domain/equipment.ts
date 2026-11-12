// Con qué se hace un ejercicio y qué pesos existen con ese material. Las escalas salen de
// Fitness Park (spec hoy, «Saltos de peso según el material»): mancuernas de 4 a 60 kg de 2
// en 2, máquinas Technogym de placas de 5 kg con una de 2,5 kg integrada, y discos.

export type Equipment = "dumbbell" | "kettlebell" | "barbell" | "stack";

// Palabras del nombre (sin mayúsculas ni tildes) que dicen el material. La primera que
// encaja gana; para añadir un caso, se añade una línea. Sin coincidencia: máquina de placas.
const KEYWORDS: [RegExp, Equipment][] = [
  [/barra fija/, "stack"],
  [/mancuerna|goblet|arnold|bulgara|zancada|patada de triceps|elevaciones frontales/, "dumbbell"],
  [/kettlebell|pesa rusa/, "kettlebell"],
  [/barra|multipower|smith|peso muerto|press cerrado|remo en t\b/, "barbell"],
];

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function equipmentOf(name: string): Equipment {
  const n = plain(name);
  return KEYWORDS.find(([re]) => re.test(n))?.[1] ?? "stack";
}

// `fixed`: los pesos son una escala fija (mancuernas 4, 6, 8…). Si no, se suma el salto a lo
// apuntado, porque la barra o la torre de placas pueden empezar en un número cualquiera.
interface Scale { step: number; min: number; max: number; fixed: boolean }

const scaleOf = (kind: Equipment, smallestPlate: number): Scale => ({
  dumbbell: { step: 2, min: 4, max: 60, fixed: true },
  kettlebell: { step: 4, min: 4, max: 48, fixed: true },
  // Un disco a cada lado de la barra.
  barbell: { step: smallestPlate * 2, min: 0, max: Infinity, fixed: false },
  stack: { step: 2.5, min: 0, max: Infinity, fixed: false },
}[kind]);

// Margen para no fallar por decimales (2,5 × 3 = 7,499999…).
const EPS = 1e-6;
const round2 = (n: number) => Math.round(n * 100) / 100;

// El peso siguiente (dir 1) o anterior (dir −1) para ese ejercicio. En una escala fija, un
// peso que no está en ella va al siguiente o al anterior que sí está.
export function nextLoad(name: string, weight: number, dir: 1 | -1, smallestPlate = 1.25): number {
  const { step, min, max, fixed } = scaleOf(equipmentOf(name), smallestPlate);
  const steps = weight / step;
  const next = !fixed ? weight + dir * step
    : dir > 0 ? (Math.floor(steps + EPS) + 1) * step : (Math.ceil(steps - EPS) - 1) * step;
  return round2(Math.min(max, Math.max(min, next)));
}
