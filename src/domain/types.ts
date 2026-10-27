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

// Valores tal como se escriben en los campos del formulario.
export interface SetEntry {
  weight?: string;
  reps?: string;
  note?: string;
}

export type SetField = keyof SetEntry;

// Estado completo de la app. Es también el formato de las copias JSON.
// entries:   "semana|día|ejercicio|serie" → SetEntry
// completed: "semana|día" → true
export interface WorkoutSnapshot {
  version: 1;
  weeksCount: number;
  entries: Record<string, SetEntry>;
  completed: Record<string, boolean>;
  routine: Exercise[];
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
  | { type: "exerciseAdded"; exercise: Exercise; position: number }
  | { type: "exerciseRemoved"; exerciseId: number }
  | { type: "weeksCount"; weeksCount: number }
  | { type: "weekRemoved"; week: number }
  | { type: "logsCleared" }
  | { type: "replaced" };

export interface Tally {
  n: number; // series anotadas
  p: number; // series previstas
}
