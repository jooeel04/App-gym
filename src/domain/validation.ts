// Validación de datos que llegan del navegador (las Server Actions son endpoints públicos).

export const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
export const isText = (v: unknown, max: number) => v === undefined || (typeof v === "string" && v.length <= max);

export function isExercise(e: unknown) {
  const ex = e as Record<string, unknown>;
  return !!ex && isInt(ex.id, 0, 1e6) && isInt(ex.day, 1, 5) && isInt(ex.sets, 1, 10)
    && typeof ex.name === "string" && ex.name.length >= 1 && ex.name.length <= 80
    && isText(ex.note, 240) && isText(ex.target, 30) && isText(ex.prescription, 60)
    && (ex.superset === undefined || typeof ex.superset === "boolean");
}
