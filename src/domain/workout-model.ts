import type { WorkoutRepository } from "@/repositories/workout-repository";
import { isISODate, mondayOf } from "./calendar";
import { blankSnapshot, DAY_NAMES, dayKey, DEFAULT_SCHEDULE, DEFAULT_WEEKS, entryKey, isLogged, parseKey } from "./snapshot";
import type { Exercise, NewExerciseInput, SetEntry, SetField, WeekSchedule, WorkoutChange, WorkoutSnapshot } from "./types";

type Listener = () => void;

// Modelo de dominio: rutina, registros por serie, semanas y días completados.
// Mantiene el estado en memoria, avisa a los suscriptores en cada cambio
// (patrón observador, para que React vuelva a pintar) y delega la persistencia
// en un WorkoutRepository inyectado. No conoce React ni Supabase.
export class WorkoutModel {
  private state: WorkoutSnapshot;
  private version = 0;
  private listeners = new Set<Listener>();
  private onSaveError: (error: unknown) => void = () => {};

  constructor(private readonly repository: WorkoutRepository, private readonly baseRoutine: readonly Exercise[], initial?: WorkoutSnapshot | null) {
    this.state = blankSnapshot(this.copyBaseRoutine());
    if (initial) this.applyData(initial);
  }

  // ---- Observador ----

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ---- Carga y persistencia ----

  // Carga del repositorio. Si está vacío lo inicializa con `seed`
  // (p. ej. los datos locales al crear la cuenta) o con la rutina base.
  async load(seed?: WorkoutSnapshot | null) {
    const saved = await this.repository.load();
    if (saved) {
      this.applyData(saved);
    } else {
      if (seed) this.applyData(seed);
      await this.repository.apply({ type: "replaced" }, this.state);
    }
    this.emit();
  }

  private copyBaseRoutine(): Exercise[] {
    return this.baseRoutine.map((x) => ({ ...x }));
  }

  private applyData(p: WorkoutSnapshot) {
    const routine = Array.isArray(p.routine) ? p.routine : this.copyBaseRoutine();
    this.state = { ...blankSnapshot(routine), ...p, routine };
    this.state.weeksCount = Math.max(1, Number(this.state.weeksCount) || DEFAULT_WEEKS);
  }

  private commit(change: WorkoutChange) {
    this.emit();
    this.repository.apply(change, this.state).catch((e) => this.onSaveError(e));
  }

  flush() {
    return this.repository.flush();
  }

  // Se llama cuando una escritura en el repositorio falla.
  setSaveErrorHandler(handler: (error: unknown) => void) {
    this.onSaveError = handler;
  }

  get snapshot(): Readonly<WorkoutSnapshot> { return this.state; }
  get weeksCount() { return this.state.weeksCount; }
  get routine(): readonly Exercise[] { return this.state.routine; }

  // ---- Rutina ----

  exercisesOfDay(d: number) {
    return this.state.routine.filter((x) => x.day === d);
  }

  findExercise(id: number) {
    return this.state.routine.find((x) => x.id === id);
  }

  exerciseHasEntries(id: number) {
    return Object.keys(this.state.entries).some((k) => parseKey(k)[2] === id);
  }

  addExercise(day: number, data: NewExerciseInput): Exercise {
    const sets = Math.max(1, Math.min(10, Number(data.sets) || 3));
    const target = data.target || "Sin rango";
    const id = this.state.routine.reduce((max, x) => Math.max(max, Number(x.id) || 0), -1) + 1;
    const exercise: Exercise = {
      id, day, group: DAY_NAMES[day], name: data.name, note: data.note || "",
      prescription: target === "Sin rango" ? sets + " · sin rango" : sets + " × " + target,
      sets, target, optionalLast: false, custom: true,
    };
    this.state.routine = [...this.state.routine, exercise];
    this.commit({ type: "exerciseAdded", exercise, position: this.state.routine.length });
    return exercise;
  }

  // Elimina el ejercicio y todos sus registros.
  removeExercise(id: number) {
    const entries: Record<string, SetEntry> = {};
    Object.entries(this.state.entries).forEach(([k, v]) => { if (parseKey(k)[2] !== id) entries[k] = v; });
    this.state.routine = this.state.routine.filter((x) => x.id !== id);
    this.state.entries = entries;
    this.commit({ type: "exerciseRemoved", exerciseId: id });
  }

  // ---- Registros por serie ----

  getEntry(w: number, d: number, id: number, s: number): SetEntry {
    return this.state.entries[entryKey(w, d, id, s)] ?? {};
  }

  // `today` es la fecha real en que se anota; se conserva la de la primera anotación.
  setEntryField(w: number, d: number, id: number, s: number, field: SetField, value: string, today: string) {
    const k = entryKey(w, d, id, s);
    const v: SetEntry = { ...this.state.entries[k], [field]: value };
    const empty = !v.weight && !v.reps && !v.note;
    if (!v.date) v.date = today;
    const entries = { ...this.state.entries };
    if (empty) delete entries[k];
    else entries[k] = v;
    this.state.entries = entries;
    this.commit({ type: "entry", week: w, day: d, exerciseId: id, set: s, entry: empty ? null : v });
  }

  // Si el día (semana y día de rutina) tiene alguna serie anotada.
  hasLoggedSets(w: number, d: number) {
    const prefix = w + "|" + d + "|";
    return Object.entries(this.state.entries).some(([k, e]) => k.startsWith(prefix) && isLogged(e));
  }

  loggedSets(w: number, d: number, exercise: Exercise) {
    let n = 0;
    for (let s = 1; s <= exercise.sets; s++) if (isLogged(this.getEntry(w, d, exercise.id, s))) n++;
    return n;
  }

  // ---- Días completados ----

  isDayCompleted(w: number, d: number) {
    return !!this.state.completed[dayKey(w, d)];
  }

  toggleDayCompleted(w: number, d: number) {
    const k = dayKey(w, d), done = !this.state.completed[k];
    const completed = { ...this.state.completed };
    if (done) completed[k] = true;
    else delete completed[k];
    this.state.completed = completed;
    this.commit({ type: "completed", week: w, day: d, done });
    return done;
  }

  // ---- Semanas ----

  addWeek() {
    this.state.weeksCount++;
    this.commit({ type: "weeksCount", weeksCount: this.state.weeksCount });
    return this.state.weeksCount;
  }

  weekHasData(w: number) {
    const inWeek = (k: string) => parseKey(k)[0] === w;
    return Object.keys(this.state.entries).some(inWeek) || Object.keys(this.state.completed).some(inWeek);
  }

  // Borra la semana indicada y renumera las posteriores.
  removeWeek(removed: number) {
    const shift = <T,>(source: Record<string, T>) => {
      const next: Record<string, T> = {};
      Object.keys(source).forEach((k) => {
        const parts = k.split("|"), w = Number(parts[0]);
        if (w === removed) return;
        if (w > removed) parts[0] = String(w - 1);
        next[parts.join("|")] = source[k];
      });
      return next;
    };
    this.state.entries = shift(this.state.entries);
    this.state.completed = shift(this.state.completed);
    this.state.weeksCount--;
    this.commit({ type: "weekRemoved", week: removed });
  }

  // ---- Calendario ----

  get schedule(): WeekSchedule {
    return { ...DEFAULT_SCHEDULE, ...this.state.schedule };
  }

  // Día de la semana (1 = lunes … 7 = domingo) en que se entrena el día de rutina `d`.
  weekdayFor(d: number) {
    return this.schedule[d];
  }

  get startDate(): string | null {
    return this.state.startDate ?? null;
  }

  setWeekday(d: number, weekday: number) {
    this.setSchedule({ ...this.schedule, [d]: weekday });
  }

  setSchedule(schedule: WeekSchedule) {
    this.state.schedule = { ...schedule };
    this.commit({ type: "schedule", schedule: this.schedule, startDate: this.startDate });
  }

  // La semana 1 siempre empieza en lunes.
  setStartDate(iso: string) {
    if (!isISODate(iso)) return;
    this.state.startDate = mondayOf(iso);
    this.commit({ type: "schedule", schedule: this.schedule, startDate: this.state.startDate });
  }

  // ---- Copias ----

  restore(backup: WorkoutSnapshot) {
    this.applyData(backup);
    this.commit({ type: "replaced" });
  }

  // Borra registros y días completados; conserva la rutina y el número de semanas.
  clearLogs() {
    this.state.entries = {};
    this.state.completed = {};
    this.commit({ type: "logsCleared" });
  }
}
