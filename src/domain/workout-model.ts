import type { WorkoutRepository } from "@/repositories/workout-repository";
import { isISODate, mondayOf } from "./calendar";
import { blankSnapshot, DAY_NAMES, dayKey, DEFAULT_SCHEDULE, DEFAULT_WEEKS, entryKey, exerciseKey, isLogged, parseKey } from "./snapshot";
import type { BodyMetrics, Exercise, NewExerciseInput, SetEntry, SetField, WeekSchedule, WorkoutChange, WorkoutSnapshot } from "./types";

type Listener = () => void;

// Series (1–10) y repeticiones objetivo normalizadas, con su texto "3 × 8–12".
function setsAndTarget(data: NewExerciseInput) {
  const sets = Math.max(1, Math.min(10, Number(data.sets) || 3));
  const target = data.target.trim() || "Sin rango";
  return { sets, target, prescription: target === "Sin rango" ? sets + " · sin rango" : sets + " × " + target };
}

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

  // Sustituye el estado por uno ya guardado (p. ej. la copia local con cambios que
  // aún no llegaron al servidor) sin volver a persistirlo.
  adopt(snapshot: WorkoutSnapshot) {
    this.applyData(snapshot);
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
    const id = this.state.routine.reduce((max, x) => Math.max(max, Number(x.id) || 0), -1) + 1;
    const exercise: Exercise = {
      id, day, group: DAY_NAMES[day], name: data.name, note: data.note || "",
      ...setsAndTarget(data), optionalLast: false, custom: true, superset: !!data.superset,
    };
    this.state.routine = [...this.state.routine, exercise];
    this.commit({ type: "exerciseAdded", exercise, position: this.state.routine.length });
    return exercise;
  }

  // Cambia nombre, series, repeticiones, detalle o superserie. Sus registros se conservan.
  updateExercise(id: number, data: NewExerciseInput) {
    const current = this.findExercise(id);
    if (!current) return;
    const exercise: Exercise = { ...current, name: data.name, note: data.note || "", ...setsAndTarget(data), superset: !!data.superset };
    this.state.routine = this.state.routine.map((x) => (x.id === id ? exercise : x));
    this.commit({ type: "exerciseUpdated", exercise });
  }

  // Sube (-1) o baja (+1) un ejercicio dentro de su día.
  moveExercise(id: number, direction: -1 | 1) {
    const x = this.findExercise(id);
    if (!x) return;
    const sameDay = this.state.routine.filter((r) => r.day === x.day);
    const other = sameDay[sameDay.indexOf(x) + direction];
    if (!other) return;
    const i = this.state.routine.indexOf(x), j = this.state.routine.indexOf(other);
    const routine = [...this.state.routine];
    [routine[i], routine[j]] = [routine[j], routine[i]];
    this.state.routine = routine;
    this.commit({ type: "routineOrder", ids: routine.map((r) => r.id) });
  }

  // Elimina el ejercicio y todos sus registros.
  removeExercise(id: number) {
    const entries: Record<string, SetEntry> = {};
    Object.entries(this.state.entries).forEach(([k, v]) => { if (parseKey(k)[2] !== id) entries[k] = v; });
    this.state.routine = this.state.routine.filter((x) => x.id !== id);
    this.state.entries = entries;
    this.state.checked = Object.fromEntries(Object.entries(this.checked).filter(([k]) => parseKey(k)[2] !== id));
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

  // Ejercicios marcados a mano con el tick: "semana|día|ejercicio" → fecha en que se marcó.
  private get checked(): Record<string, string> {
    return this.state.checked ?? {};
  }

  isExerciseChecked(w: number, d: number, id: number) {
    return exerciseKey(w, d, id) in this.checked;
  }

  // Marca o desmarca a mano un ejercicio (p. ej. si no se pudo hacer). Devuelve el nuevo estado.
  toggleExerciseChecked(w: number, d: number, id: number, today: string) {
    const k = exerciseKey(w, d, id), checked = { ...this.checked };
    const on = !(k in checked);
    if (on) checked[k] = today;
    else delete checked[k];
    this.state.checked = checked;
    this.commit({ type: "exerciseChecked", week: w, day: d, exerciseId: id, date: on ? today : null });
    return on;
  }

  // Fechas en que se marcaron ejercicios a mano, por semana y día de rutina.
  checkedDates(): { week: number; day: number; date: string }[] {
    return Object.entries(this.checked).map(([k, date]) => {
      const [week, day] = parseKey(k);
      return { week, day, date };
    });
  }

  // Un ejercicio está hecho si se marcó con el tick o si tiene anotadas todas sus
  // series (la opcional no cuenta).
  isExerciseDone(w: number, d: number, exercise: Exercise) {
    if (this.isExerciseChecked(w, d, exercise.id)) return true;
    const required = exercise.sets - (exercise.optionalLast ? 1 : 0);
    for (let s = 1; s <= required; s++) if (!isLogged(this.getEntry(w, d, exercise.id, s))) return false;
    return true;
  }

  // ---- Días completados ----

  isDayCompleted(w: number, d: number) {
    return !!this.state.completed[dayKey(w, d)];
  }

  // Marca el día como completado cuando todos sus ejercicios están hechos (y lo
  // desmarca si deja de estarlo). Devuelve true si el día acaba de completarse.
  syncDayCompleted(w: number, d: number) {
    const list = this.exercisesOfDay(d);
    const done = list.length > 0 && list.every((x) => this.isExerciseDone(w, d, x));
    if (done === this.isDayCompleted(w, d)) return false;
    const k = dayKey(w, d);
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

  // Amplía el ciclo para que llegue al menos hasta la semana `w` (el calendario avanza solo).
  ensureWeeks(w: number) {
    if (w <= this.state.weeksCount) return;
    this.state.weeksCount = w;
    this.commit({ type: "weeksCount", weeksCount: w });
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
    this.state.checked = shift(this.checked);
    this.state.weeksCount--;
    this.commit({ type: "weekRemoved", week: removed });
  }

  // ---- Calendario ----

  get schedule(): WeekSchedule {
    return { ...DEFAULT_SCHEDULE, ...this.state.schedule };
  }

  // Día de la semana (1 = lunes … 7 = domingo) en que se entrena el día de rutina `d`;
  // 0 = sin día fijo.
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

  // ---- Peso corporal y medidas ----

  // Registros de cuerpo ordenados por fecha (del más antiguo al más reciente).
  bodyLog(): { date: string; metrics: BodyMetrics }[] {
    return Object.entries(this.state.body ?? {})
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, metrics]) => ({ date, metrics }));
  }

  // Guarda las medidas de un día (null o vacías: las borra).
  setBodyMetrics(date: string, metrics: BodyMetrics | null) {
    if (!isISODate(date)) return;
    const clean = metrics && Object.fromEntries(Object.entries(metrics).filter(([, v]) => typeof v === "number" && v > 0)) as BodyMetrics;
    const empty = !clean || Object.keys(clean).length === 0;
    const body = { ...this.state.body };
    if (empty) delete body[date];
    else body[date] = clean;
    this.state.body = body;
    this.commit({ type: "body", date, metrics: empty ? null : clean });
  }

  // ---- Copias ----

  restore(backup: WorkoutSnapshot) {
    this.applyData(backup);
    this.commit({ type: "replaced" });
  }

  // Borra registros, ticks y días completados; conserva la rutina y el número de semanas.
  clearLogs() {
    this.state.entries = {};
    this.state.checked = {};
    this.state.completed = {};
    this.commit({ type: "logsCleared" });
  }
}
