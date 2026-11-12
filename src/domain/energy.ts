// Calorías estimadas de un entreno (spec hoy R31), con METs: kcal = MET × peso (kg) × horas.
// Es una aproximación (puede fallar un 30 %): la app la enseña con «≈».

export type Intensity = "big" | "compound" | "isolation";

// MET de cada tipo (Compendium of Physical Activities: pesas moderadas 3,5, vigorosas 6).
const MET: Record<Intensity, number> = { big: 6, compound: 5, isolation: 3.5 };

// Palabras del nombre (sin mayúsculas ni tildes) que dicen cuánto músculo mueve. La primera
// que encaja gana; para añadir un caso, se añade una línea. Sin coincidencia: compuesto.
const KEYWORDS: [RegExp, Intensity][] = [
  [/curl|extension|elevacion|apertura|cruce|contractor|pec deck|patada|frances|face pull|encogimiento|gemelo|crunch|pullover|plancha|abdominal|pallof|rueda/, "isolation"],
  [/sentadilla|peso muerto|hip thrust|prensa|zancada|bulgara|hack|goblet/, "big"],
];

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function intensityOf(name: string): Intensity {
  const n = plain(name);
  return KEYWORDS.find(([re]) => re.test(n))?.[1] ?? "compound";
}

// Kcal del reloj que se aceptan (spec datos R6).
export const MAX_WATCH_KCAL = 9999;
export const isWatchKcal = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_WATCH_KCAL;

// Segundos de trabajo de cada serie (además del descanso).
const WORK_SECONDS = 40;

export interface EnergyContext {
  restSeconds: number; // descanso entre series
  bodyWeight: number; // kg
}

// Calorías de un entreno: las de cada ejercicio y el total.
export function workoutKcal(items: { name: string; sets: number }[], ctx: EnergyContext) {
  const each = items.map((x) => ({ name: x.name, kcal: estimateKcal(x, ctx) }));
  return { total: each.reduce((n, x) => n + x.kcal, 0), each };
}

// Calorías de un ejercicio con `sets` series de trabajo, redondeadas.
export function estimateKcal(x: { name: string; sets: number }, ctx: EnergyContext): number {
  if (x.sets <= 0) return 0;
  const hours = (x.sets * (WORK_SECONDS + ctx.restSeconds)) / 3600;
  return Math.round(MET[intensityOf(x.name)] * ctx.bodyWeight * hours);
}
