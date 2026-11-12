export interface Exercise {
  id: number;
  day: number;
  group: string;
  name: string;
  note: string;
  prescription: string;
  sets: number;
  target: string;
  optionalLast: boolean;
  custom?: boolean;
  // Superserie: se hace seguido del siguiente ejercicio del día, sin descanso entre ambos.
  superset?: boolean;
}

// Valores tal como se escriben en los campos del formulario, más la fecha real
// (YYYY-MM-DD) en que se anotó la serie por primera vez.
export interface SetEntry {
  weight?: string;
  reps?: string;
  note?: string;
  date?: string;
}

export type SetField = "weight" | "reps" | "note";

// Día de rutina (1-7) → días de la semana en que se entrena (1 = lunes … 7 = domingo),
// en orden; vacía = sin día fijo. (Antes era un solo número: ver normalizeSchedule.)
export type WeekSchedule = Record<string, number[]>;

// Estado completo de la app. Es también el formato de las copias JSON.
// entries:   "semana|día|ejercicio|serie" → SetEntry
// completed: "semana|día" → true
// checked:   "semana|día|ejercicio" → fecha en que se marcó a mano con el tick
//            (la 2.ª, 3.ª… vez de un día en la misma semana añade "|vez" al final)
// schedule:  día de la rutina → día de la semana
// startDate: lunes en que empieza la semana 1 del ciclo
// body:      fecha → peso corporal y medidas de ese día
// dayNames:  día de rutina → su nombre (qué días existen)
export interface WorkoutSnapshot {
  version: 1;
  weeksCount: number;
  entries: Record<string, SetEntry>;
  completed: Record<string, boolean>;
  checked?: Record<string, string>;
  routine: Exercise[];
  schedule?: WeekSchedule;
  startDate?: string;
  body?: Record<string, BodyMetrics>;
  // Nombre de cada día de rutina ("1" → "Torso"); sin él, los 5 de siempre.
  dayNames?: Record<string, string>;
}

// Peso corporal (kg) y medidas (cm) de un día. Todos opcionales.
export interface BodyMetrics {
  weight?: number;
  waist?: number;
  chest?: number;
  arm?: number;
  thigh?: number;
  hip?: number;
}

export const BODY_FIELDS = ["weight", "waist", "chest", "arm", "thigh", "hip"] as const;
export type BodyField = (typeof BODY_FIELDS)[number];

export interface NewExerciseInput {
  name: string;
  sets: number;
  target: string;
  note: string;
  superset?: boolean;
}

// Cambios que el modelo comunica al repositorio para persistirlos.
export type WorkoutChange =
  // round: vez del día en esa semana (sin ella, la 1.ª: cambios guardados antes de existir).
  | { type: "entry"; week: number; day: number; round?: number; exerciseId: number; set: number; entry: SetEntry | null }
  | { type: "completed"; week: number; day: number; round?: number; done: boolean }
  | { type: "exerciseChecked"; week: number; day: number; round?: number; exerciseId: number; date: string | null }
  | { type: "exerciseAdded"; exercise: Exercise; position: number }
  | { type: "exerciseRemoved"; exerciseId: number }
  | { type: "exerciseUpdated"; exercise: Exercise }
  | { type: "routineOrder"; ids: number[] }
  | { type: "weeksCount"; weeksCount: number }
  | { type: "weekRemoved"; week: number }
  | { type: "schedule"; schedule: WeekSchedule; startDate: string | null }
  | { type: "body"; date: string; metrics: BodyMetrics | null }
  | { type: "dayNames"; dayNames: Record<string, string> }
  // Día de rutina borrado con todo lo suyo; lleva cómo quedan los nombres y el calendario.
  | { type: "dayRemoved"; day: number; dayNames: Record<string, string>; schedule: WeekSchedule }
  | { type: "logsCleared" }
  | { type: "replaced" };

export interface Tally {
  n: number; // series anotadas
  p: number; // series previstas
}
