// Fechas de calendario como texto "YYYY-MM-DD" (hora local, sin zonas horarias).

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // 1 = lunes … 7 = domingo
export const WEEKDAY_SHORT: Record<number, string> = { 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 7: "D" };
export const WEEKDAY_NAMES: Record<number, string> = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(parseISODate(v).getTime());
}

export function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

// Días entre dos fechas (b - a).
export function daysBetween(a: string, b: string) {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

export function weekdayOf(iso: string) {
  const js = parseISODate(iso).getDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

export function mondayOf(iso: string) {
  return addDays(iso, 1 - weekdayOf(iso));
}

// "martes 27 oct"
export function formatShortDate(iso: string) {
  const d = parseISODate(iso);
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  return WEEKDAY_NAMES[weekdayOf(iso)] + " " + d.getDate() + " " + month;
}

// "3 nov" (para el eje de las gráficas)
export function formatDayMonth(iso: string) {
  const d = parseISODate(iso);
  return d.getDate() + " " + d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

// "Martes, 27 de octubre"
export function formatLongDate(iso: string) {
  const text = parseISODate(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
