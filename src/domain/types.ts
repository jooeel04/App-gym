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

// Día de la rutina (1-5) → día de la semana en que se entrena (1 = lunes … 7 = domingo).
export type WeekSchedule = Record<string, number>;

// Estado completo de la app. Es también el formato de las copias JSON.
// entries:   "semana|día|ejercicio|serie" → SetEntry
// completed: "semana|día" → true
// checked:   "semana|día|ejercicio" → fecha en que se marcó a mano con el tick
// schedule:  día de la rutina → día de la semana
// startDate: lunes en que empieza la semana 1 del ciclo
export interface WorkoutSnapshot {
  version: 1;
  weeksCount: number;
  entries: Record<string, SetEntry>;
  completed: Record<string, boolean>;
  checked?: Record<string, string>;
  routine: Exercise[];
  schedule?: WeekSchedule;
  startDate?: string;
}

export interface NewExerciseInput {
  name: string;
  sets: number;
  target: string;
  note: string;
}

// Cambios que el modelo comunica al repositorio para persistirlos.
export type WorkoutChange =
  | { type: "entry"; week: number; day: number; exerciseId: number; set: number; entry: SetEntry | null }
  | { type: "completed"; week: number; day: number; done: boolean }
  | { type: "exerciseChecked"; week: number; day: number; exerciseId: number; date: string | null }
  | { type: "exerciseAdded"; exercise: Exercise; position: number }
  | { type: "exerciseRemoved"; exerciseId: number }
  | { type: "weeksCount"; weeksCount: number }
  | { type: "weekRemoved"; week: number }
  | { type: "schedule"; schedule: WeekSchedule; startDate: string | null }
  | { type: "logsCleared" }
  | { type: "replaced" };

export interface Tally {
  n: number; // series anotadas
  p: number; // series previstas
}
