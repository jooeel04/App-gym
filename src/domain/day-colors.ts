// Colores que se pueden elegir para un día de rutina (spec rutina R7). Cada uno tiene su
// versión para tema oscuro y claro en el CSS (`--c-<color>`). Lista fija para que siempre
// se lean bien; para añadir uno: una entrada aquí y sus dos `--c-` en globals.css.
export const DAY_COLORS = [
  { id: "azul", name: "Azul" },
  { id: "naranja", name: "Naranja" },
  { id: "verde", name: "Verde" },
  { id: "amarillo", name: "Amarillo" },
  { id: "rosa", name: "Rosa" },
  { id: "morado", name: "Morado" },
  { id: "turquesa", name: "Turquesa" },
  { id: "rojo", name: "Rojo" },
] as const;

export type DayColor = (typeof DAY_COLORS)[number]["id"];

export const isDayColor = (c: unknown): c is DayColor => DAY_COLORS.some((x) => x.id === c);

// El color de siempre de cada número de día (1 azul, 2 naranja… 7 turquesa).
export const defaultDayColor = (d: number): DayColor => DAY_COLORS[(d - 1) % 7].id;
