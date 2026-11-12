import type { WorkoutRepository } from "@/repositories/workout-repository";
import { defaultDayColor, isDayColor, type DayColor } from "./day-colors";
import { daysBetween, isISODate, mondayOf } from "./calendar";
import { blankSnapshot, dayKey, DEFAULT_DAY_NAMES, DEFAULT_SCHEDULE, DEFAULT_WEEKS, entryKey, exerciseKey, isLogged, MAX_DAY_NAME, MAX_DAYS, MAX_ROUNDS, normalizeSchedule, parseKey, roundOf } from "./snapshot";
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
  // Última vez de cada día en cada semana ("semana|día" → vez); null = hay que recalcularla.
  private rounds: Map<string, number> | null = null;

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
    this.rounds = null;
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
    this.rounds = null;
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

  // ---- Días de rutina ----

  // Nombre de cada día que existe ("1" → "Torso"). Sin guardar, los 5 de siempre.
  get dayNames(): Record<string, string> {
    return { ...(this.state.dayNames ?? DEFAULT_DAY_NAMES) };
  }

  // Días de rutina que existen, en orden (1–7).
  get days(): number[] {
    return Object.keys(this.dayNames).map(Number).sort((a, b) => a - b);
  }

  dayName(d: number) {
    return this.dayNames[d] ?? "Día " + d;
  }

  // Color de un día: el elegido o, si no, el de siempre de su número.
  dayColor(d: number): DayColor {
    const c = this.state.dayColors?.[d];
    return isDayColor(c) ? c : defaultDayColor(d);
  }

  // Elige el color de un día (solo de DAY_COLORS).
  setDayColor(d: number, color: string) {
    if (!this.days.includes(d) || !isDayColor(color)) return;
    const dayColors = { ...this.state.dayColors, [d]: color };
    this.state.dayColors = dayColors;
    this.commit({ type: "dayColors", dayColors });
  }

  // Crea un día vacío con ese nombre en el número `at` o, sin él, en el primero libre.
  // Devuelve el número, o
  // null si el nombre está vacío, ese número ya existe o ya hay MAX_DAYS.
  addDay(name: string, at?: number): number | null {
    const clean = name.trim().slice(0, MAX_DAY_NAME);
    const days = this.days;
    const free = Array.from({ length: MAX_DAYS }, (_, i) => i + 1).find((d) => !days.includes(d) && (at === undefined || d === at));
    if (!clean || free === undefined) return null;
    this.setDayNames({ ...this.dayNames, [free]: clean });
    return free;
  }

  renameDay(d: number, name: string) {
    const clean = name.trim().slice(0, MAX_DAY_NAME);
    if (!clean || !this.days.includes(d)) return;
    this.setDayNames({ ...this.dayNames, [d]: clean });
  }

  // Borra el día con sus ejercicios, series, ticks, días completados y su sitio en el
  // calendario. El último día que queda no se borra.
  removeDay(d: number) {
    if (!this.days.includes(d) || this.days.length <= 1) return;
    const other = <T,>(source: Record<string, T>) => Object.fromEntries(Object.entries(source).filter(([k]) => parseKey(k)[1] !== d));
    const dayNames = this.dayNames, schedule = this.schedule, dayColors = { ...this.state.dayColors };
    delete dayNames[d];
    delete schedule[d];
    delete dayColors[d];
    this.state.routine = this.state.routine.filter((x) => x.day !== d);
    this.state.entries = other(this.state.entries);
    this.state.checked = other(this.checked);
    this.state.completed = other(this.state.completed);
    this.state.dayNames = dayNames;
    this.state.schedule = schedule;
    this.state.dayColors = dayColors;
    this.commit({ type: "dayRemoved", day: d, dayNames, schedule, dayColors });
  }

  private setDayNames(dayNames: Record<string, string>) {
    this.state.dayNames = dayNames;
    this.commit({ type: "dayNames", dayNames });
  }

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
      id, day, group: this.dayName(day), name: data.name, note: data.note || "",
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
  // `r` es la vez del día en esa semana: 1 la primera, 2 si se repite… (ver lastRound).

  getEntry(w: number, d: number, id: number, s: number, r = 1): SetEntry {
    return this.state.entries[entryKey(w, d, id, s, r)] ?? {};
  }

  // `today` es la fecha real en que se anota; se conserva la de la primera anotación.
  setEntryField(w: number, d: number, id: number, s: number, field: SetField, value: string, today: string, r = 1) {
    const k = entryKey(w, d, id, s, r);
    const v: SetEntry = { ...this.state.entries[k], [field]: value };
    const empty = !v.weight && !v.reps && !v.note;
    if (!v.date) v.date = today;
    const entries = { ...this.state.entries };
    if (empty) delete entries[k];
    else entries[k] = v;
    this.state.entries = entries;
    this.commit({ type: "entry", week: w, day: d, round: r, exerciseId: id, set: s, entry: empty ? null : v });
  }

  // Si el día (semana y día de rutina) tiene alguna serie anotada: en la vez `r` o, sin
  // ella, en cualquiera.
  hasLoggedSets(w: number, d: number, r?: number) {
    const prefix = w + "|" + d + "|";
    return Object.entries(this.state.entries).some(([k, e]) => k.startsWith(prefix) && (r === undefined || roundOf(k, 4) === r) && isLogged(e));
  }

  loggedSets(w: number, d: number, exercise: Exercise, r = 1) {
    let n = 0;
    for (let s = 1; s <= exercise.sets; s++) if (isLogged(this.getEntry(w, d, exercise.id, s, r))) n++;
    return n;
  }

  // ---- Veces del mismo día en una semana ----

  // Última vez del día en esa semana con algo anotado, marcado o completado (1 si ninguna).
  // Se calcula de una pasada para todos los días y se guarda hasta el siguiente cambio
  // (Progreso lo pregunta para cada semana de cada ejercicio).
  lastRound(w: number, d: number) {
    if (!this.rounds) {
      const rounds = new Map<string, number>();
      const see = (source: Record<string, unknown>, size: number) => Object.keys(source).forEach((k) => {
        const [week, day] = parseKey(k), key = dayKey(week, day);
        rounds.set(key, Math.max(rounds.get(key) ?? 1, roundOf(k, size)));
      });
      see(this.state.entries, 4);
      see(this.checked, 3);
      see(this.state.completed, 2);
      this.rounds = rounds;
    }
    return this.rounds.get(dayKey(w, d)) ?? 1;
  }

  // Vez en la que se sigue anotando: la última si está a medias, la siguiente si ya se completó.
  openRound(w: number, d: number) {
    const last = this.lastRound(w, d);
    return this.isDayCompleted(w, d, last) ? Math.min(last + 1, MAX_ROUNDS) : last;
  }

  // Alguna de las veces del día en esa semana está completada o tiene series.
  isDayDone(w: number, d: number) {
    if (this.hasLoggedSets(w, d)) return true;
    for (let r = this.lastRound(w, d); r >= 1; r--) if (this.isDayCompleted(w, d, r)) return true;
    return false;
  }

  // Ejercicios marcados a mano con el tick: "semana|día|ejercicio" → fecha en que se marcó.
  private get checked(): Record<string, string> {
    return this.state.checked ?? {};
  }

  isExerciseChecked(w: number, d: number, id: number, r = 1) {
    return exerciseKey(w, d, id, r) in this.checked;
  }

  // Marca o desmarca a mano un ejercicio (p. ej. si no se pudo hacer). Devuelve el nuevo estado.
  toggleExerciseChecked(w: number, d: number, id: number, today: string, r = 1) {
    const k = exerciseKey(w, d, id, r), checked = { ...this.checked };
    const on = !(k in checked);
    if (on) checked[k] = today;
    else delete checked[k];
    this.state.checked = checked;
    this.commit({ type: "exerciseChecked", week: w, day: d, round: r, exerciseId: id, date: on ? today : null });
    return on;
  }

  // Fechas en que se marcaron ejercicios a mano, por semana y día de rutina.
  checkedDates(): { week: number; day: number; round: number; id: number; date: string }[] {
    return Object.entries(this.checked).map(([k, date]) => {
      const [week, day, id] = parseKey(k);
      return { week, day, round: roundOf(k, 3), id, date };
    });
  }

  // Un ejercicio está hecho si se marcó con el tick o si tiene anotadas todas sus
  // series (la opcional no cuenta).
  isExerciseDone(w: number, d: number, exercise: Exercise, r = 1) {
    if (this.isExerciseChecked(w, d, exercise.id, r)) return true;
    const required = exercise.sets - (exercise.optionalLast ? 1 : 0);
    for (let s = 1; s <= required; s++) if (!isLogged(this.getEntry(w, d, exercise.id, s, r))) return false;
    return true;
  }

  // Borra un entreno entero (la vez `r` del día `d` en la semana `w`): sus series, ticks y
  // día completado. Para quitar lo marcado sin querer.
  removeSession(w: number, d: number, r: number) {
    const sizeOf = { entries: 4, checked: 3, completed: 2 };
    const keep = <T,>(source: Record<string, T>, size: number) => Object.fromEntries(Object.entries(source).filter(([k]) => {
      const [week, day] = parseKey(k);
      return !(week === w && day === d && roundOf(k, size) === r);
    }));
    this.state.entries = keep(this.state.entries, sizeOf.entries);
    this.state.checked = keep(this.checked, sizeOf.checked);
    this.state.completed = keep(this.state.completed, sizeOf.completed);
    this.commit({ type: "sessionRemoved", week: w, day: d, round: r });
  }

  // Cambia la fecha de un entreno entero (la vez `r` del día `d` en la semana `w`). Si la
  // fecha cae en otra semana del ciclo, el entreno pasa a esa semana en la primera vez libre
  // de ese día. Fechas no válidas o anteriores a la semana 1 se ignoran.
  moveSession(w: number, d: number, r: number, date: string) {
    const start = this.startDate;
    if (!isISODate(date) || !start || date < start) return;
    const toWeek = Math.floor(daysBetween(start, date) / 7) + 1;
    const hasData = (week: number) => [this.state.entries, this.checked, this.state.completed]
      .some((source) => Object.keys(source).some((k) => { const [kw, kd] = parseKey(k); return kw === week && kd === d; }));
    const toRound = toWeek === w ? r : hasData(toWeek) ? Math.min(this.lastRound(toWeek, d) + 1, MAX_ROUNDS) : 1;
    const mine = (k: string, size: number) => { const [kw, kd] = parseKey(k); return kw === w && kd === d && roundOf(k, size) === r; };
    const entries: Record<string, SetEntry> = {}, checked: Record<string, string> = {}, completed: Record<string, boolean> = {};
    Object.entries(this.state.entries).forEach(([k, e]) => {
      if (!mine(k, 4)) { entries[k] = e; return; }
      const [, , id, s] = parseKey(k);
      entries[entryKey(toWeek, d, id, s, toRound)] = { ...e, date };
    });
    Object.entries(this.checked).forEach(([k, v]) => {
      if (!mine(k, 3)) { checked[k] = v; return; }
      checked[exerciseKey(toWeek, d, parseKey(k)[2], toRound)] = date;
    });
    Object.entries(this.state.completed).forEach(([k, v]) => {
      if (!mine(k, 2)) { completed[k] = v; return; }
      completed[dayKey(toWeek, d, toRound)] = v;
    });
    this.state.entries = entries;
    this.state.checked = checked;
    this.state.completed = completed;
    this.commit({ type: "sessionMoved", week: w, day: d, round: r, toWeek, toRound, date });
  }

  // ---- Días completados ----

  isDayCompleted(w: number, d: number, r = 1) {
    return !!this.state.completed[dayKey(w, d, r)];
  }

  // Marca el día como completado cuando todos sus ejercicios están hechos (y lo
  // desmarca si deja de estarlo). Devuelve true si el día acaba de completarse.
  syncDayCompleted(w: number, d: number, r = 1) {
    const list = this.exercisesOfDay(d);
    const done = list.length > 0 && list.every((x) => this.isExerciseDone(w, d, x, r));
    if (done === this.isDayCompleted(w, d, r)) return false;
    const k = dayKey(w, d, r);
    const completed = { ...this.state.completed };
    if (done) completed[k] = true;
    else delete completed[k];
    this.state.completed = completed;
    this.commit({ type: "completed", week: w, day: d, round: r, done });
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

  // Días de la semana de cada día de rutina que existe (lista vacía = sin día fijo).
  // Los datos antiguos (un número por día) se leen como una lista de uno.
  get schedule(): WeekSchedule {
    const saved = normalizeSchedule(this.state.schedule ?? DEFAULT_SCHEDULE);
    return Object.fromEntries(this.days.map((d) => [d, saved[d] ?? []]));
  }

  // Días de la semana (1 = lunes … 7 = domingo) en que se entrena el día de rutina `d`,
  // en orden: el primero es la 1.ª vez de la semana, el segundo la 2.ª… ([] = sin día fijo).
  weekdaysFor(d: number): number[] {
    return this.schedule[d] ?? [];
  }

  get startDate(): string | null {
    return this.state.startDate ?? null;
  }

  setWeekdays(d: number, weekdays: number[]) {
    this.setSchedule({ ...this.schedule, [d]: weekdays });
  }

  setSchedule(schedule: WeekSchedule) {
    this.state.schedule = normalizeSchedule(schedule);
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

  // Borra registros, ticks, días completados y medidas; conserva la rutina y el número de semanas.
  clearLogs() {
    this.state.entries = {};
    this.state.checked = {};
    this.state.completed = {};
    this.state.body = {};
    this.commit({ type: "logsCleared" });
  }
}
