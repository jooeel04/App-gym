import type { SupabaseClient } from "@supabase/supabase-js";
import { blankSnapshot, dayKey, entryKey, exerciseKey, parseKey } from "@/domain/snapshot";
import { isISODate } from "@/domain/calendar";
import type { Exercise, SetEntry, WeekSchedule, WorkoutChange, WorkoutSnapshot } from "@/domain/types";
import type { WorkoutRepository } from "./workout-repository";

const ENTRY_DEBOUNCE_MS = 600;
const PAGE_SIZE = 1000;
const LOG_CONFLICT = "program_id,week,day,exercise_local_id,set_number";
// Un ejercicio marcado a mano con el tick se guarda como la "serie 0" en set_logs,
// con la fecha en logged_on: así se borra en cascada y se copia con el resto de series.
const CHECK_SET = 0;

type EntryChange = Extract<WorkoutChange, { type: "entry" }>;
type Batch = { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void };
type Result<T> = { data: T; error: unknown };

interface ExerciseRow {
  local_id: number; day: number; position: number; group_name: string; name: string; note: string;
  prescription: string; sets: number; target: string; optional_last: boolean; custom: boolean;
}
interface LogRow {
  week: number; day: number; exercise_local_id: number; set_number: number;
  weight: number | null; reps: number | null; note: string | null; logged_on: string | null;
}
interface ProgramRow { id: string; weeks_count: number; schedule: WeekSchedule | null; start_date: string | null }

// Persistencia en Supabase (Postgres). Se usa solo en el servidor, con la sesión del
// usuario: RLS limita cada consulta a su propio programa (user_id). Solo depende del
// SupabaseClient que se le inyecte.
// - Las series se agrupan durante ENTRY_DEBOUNCE_MS para no enviar una petición por tecla.
// - Las escrituras se encadenan en una cola para respetar el orden (p. ej. crear un
//   ejercicio antes de registrar sus series).
export class SupabaseWorkoutRepository implements WorkoutRepository {
  private queue: Promise<void> = Promise.resolve();
  private pending = new Map<string, EntryChange>();
  private batch: Batch | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  private programId: string | null = null;

  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  private programQuery() {
    return this.db.from("programs").select("id, weeks_count, schedule, start_date").eq("user_id", this.userId).maybeSingle();
  }

  // ---- Lectura ----

  async load(): Promise<WorkoutSnapshot | null> {
    let program = await must<ProgramRow | null>(this.programQuery());
    // Primera vez de esta cuenta: se queda con el programa sin dueño de la versión sin login, si existe.
    if (!program && await must<boolean>(this.db.rpc("claim_unowned_program"))) {
      program = await must<ProgramRow | null>(this.programQuery());
    }
    if (!program) return null;
    this.programId = program.id;

    const id = program.id;
    const [exercises, logs, completed] = await Promise.all([
      must<ExerciseRow[]>(this.db.from("exercises").select("local_id, day, position, group_name, name, note, prescription, sets, target, optional_last, custom").eq("program_id", id).order("position")),
      selectAll<LogRow>((from, to) => this.db.from("set_logs").select("week, day, exercise_local_id, set_number, weight, reps, note, logged_on").eq("program_id", id).order("week").order("day").range(from, to)),
      must<{ week: number; day: number }[]>(this.db.from("completed_days").select("week, day").eq("program_id", id)),
    ]);

    const snapshot = blankSnapshot(exercises.map(fromExerciseRow));
    snapshot.weeksCount = program.weeks_count;
    if (program.schedule) snapshot.schedule = program.schedule;
    if (program.start_date) snapshot.startDate = program.start_date;
    const checked: Record<string, string> = {};
    logs.forEach((r) => {
      if (r.set_number === CHECK_SET) checked[exerciseKey(r.week, r.day, r.exercise_local_id)] = r.logged_on ?? "";
      else snapshot.entries[entryKey(r.week, r.day, r.exercise_local_id, r.set_number)] = fromLogRow(r);
    });
    snapshot.checked = checked;
    completed.forEach((r) => { snapshot.completed[dayKey(r.week, r.day)] = true; });
    return snapshot;
  }

  // ---- Escritura ----

  apply(change: WorkoutChange, snapshot: WorkoutSnapshot): Promise<void> {
    if (change.type === "entry") return this.queueEntry(change);
    this.flush().catch(() => {});
    return this.enqueue(() => this.write(change, snapshot));
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    const batch = this.batch, changes = Array.from(this.pending.values());
    this.batch = null;
    this.pending.clear();
    if (!batch) return this.queue;
    const done = this.enqueue(() => this.writeEntries(changes));
    done.then(batch.resolve, batch.reject);
    return done;
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.catch(() => {}).then(task);
    return this.queue;
  }

  private queueEntry(change: EntryChange) {
    this.pending.set(entryKey(change.week, change.day, change.exerciseId, change.set), change);
    if (!this.batch) {
      let resolve!: () => void, reject!: (e: unknown) => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      this.batch = { promise, resolve, reject };
    }
    clearTimeout(this.timer);
    // El error llega al modelo a través de batch.promise.
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, ENTRY_DEBOUNCE_MS);
    return this.batch.promise;
  }

  private async writeEntries(changes: EntryChange[]) {
    const programId = await this.requireProgram();
    const upserts: Record<string, unknown>[] = [], deletes: Record<string, unknown>[] = [];
    changes.forEach((c) => {
      const row = toLogRow(c.week, c.day, c.exerciseId, c.set, c.entry);
      if (row) upserts.push({ program_id: programId, ...row });
      else deletes.push({ program_id: programId, week: c.week, day: c.day, exercise_local_id: c.exerciseId, set_number: c.set });
    });
    if (upserts.length) await must(this.db.from("set_logs").upsert(upserts, { onConflict: LOG_CONFLICT }));
    await Promise.all(deletes.map((key) => must(this.db.from("set_logs").delete().match(key))));
  }

  private async write(change: Exclude<WorkoutChange, EntryChange>, snapshot: WorkoutSnapshot) {
    if (change.type === "replaced") {
      this.programId = await must<string>(this.db.rpc("replace_program", toProgramPayload(snapshot)));
      return;
    }
    const db = this.db, programId = await this.requireProgram();
    switch (change.type) {
      case "completed": {
        const key = { program_id: programId, week: change.week, day: change.day };
        if (change.done) await must(db.from("completed_days").upsert(key, { onConflict: "program_id,week,day", ignoreDuplicates: true }));
        else await must(db.from("completed_days").delete().match(key));
        return;
      }
      case "exerciseChecked": {
        const key = { program_id: programId, week: change.week, day: change.day, exercise_local_id: change.exerciseId, set_number: CHECK_SET };
        if (change.date) await must(db.from("set_logs").upsert({ ...key, logged_on: change.date }, { onConflict: LOG_CONFLICT }));
        else await must(db.from("set_logs").delete().match(key));
        return;
      }
      case "exerciseAdded":
        await must(db.from("exercises").insert(toExerciseRow(programId, change.exercise, change.position)));
        return;
      case "exerciseRemoved":
        // Las series del ejercicio se borran en cascada.
        await must(db.from("exercises").delete().match({ program_id: programId, local_id: change.exerciseId }));
        return;
      case "weeksCount":
        await must(db.from("programs").update({ weeks_count: change.weeksCount }).eq("id", programId));
        return;
      case "schedule":
        await must(db.from("programs").update({ schedule: change.schedule, start_date: change.startDate }).eq("id", programId));
        return;
      case "weekRemoved":
        await must(db.rpc("remove_week", { p_program_id: programId, p_week: change.week }));
        return;
      case "logsCleared":
        await must(db.from("set_logs").delete().eq("program_id", programId));
        await must(db.from("completed_days").delete().eq("program_id", programId));
        return;
    }
  }

  private async requireProgram() {
    if (!this.programId) {
      const program = await must<{ id: string } | null>(this.programQuery());
      if (!program) throw new Error("No hay programa creado");
      this.programId = program.id;
    }
    return this.programId;
  }
}

// ---- Utilidades de consulta ----

async function must<T = unknown>(request: PromiseLike<Result<unknown>>): Promise<T> {
  const res = await request;
  if (res.error) throw res.error;
  return res.data as T;
}

// PostgREST limita cada respuesta; se pide por páginas hasta tenerlo todo.
async function selectAll<T>(page: (from: number, to: number) => PromiseLike<Result<unknown>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const chunk = await must<T[]>(page(from, from + PAGE_SIZE - 1));
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

// ---- Mapeo entre filas de Postgres y el dominio ----

function toNumber(v: string | undefined) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fromExerciseRow(r: ExerciseRow): Exercise {
  return {
    id: r.local_id, day: r.day, group: r.group_name, name: r.name, note: r.note,
    prescription: r.prescription, sets: r.sets, target: r.target,
    optionalLast: r.optional_last, custom: r.custom,
  };
}

function toExerciseRow(programId: string, x: Exercise, position: number) {
  return {
    program_id: programId, local_id: x.id, day: x.day, position,
    group_name: x.group || "", name: x.name, note: x.note || "", prescription: x.prescription || "",
    sets: x.sets, target: x.target || "Sin rango", optional_last: !!x.optionalLast, custom: !!x.custom,
  };
}

function fromLogRow(r: LogRow): SetEntry {
  const e: SetEntry = {};
  if (r.weight != null) e.weight = String(r.weight);
  if (r.reps != null) e.reps = String(r.reps);
  if (r.note) e.note = r.note;
  if (r.logged_on) e.date = r.logged_on;
  return e;
}

// Devuelve null si la serie quedó vacía y hay que borrarla.
function toLogRow(week: number, day: number, exerciseId: number, set: number, entry: SetEntry | null) {
  const weight = toNumber(entry?.weight), reps = toNumber(entry?.reps);
  const note = String(entry?.note ?? "").trim() || null;
  if (weight === null && reps === null && note === null) return null;
  return {
    week, day, exercise_local_id: exerciseId, set_number: set,
    weight, reps: reps === null ? null : Math.round(reps), note,
    logged_on: isISODate(entry?.date) ? entry.date : null,
  };
}

function toProgramPayload(snapshot: WorkoutSnapshot) {
  const logs: Record<string, unknown>[] = [], completed: { week: number; day: number }[] = [];
  Object.entries(snapshot.entries).forEach(([k, entry]) => {
    const [week, day, exercise, set] = parseKey(k);
    const row = toLogRow(week, day, exercise, set, entry);
    if (row) logs.push({ week, day, exercise, set, weight: row.weight, reps: row.reps, note: row.note, date: row.logged_on });
  });
  Object.entries(snapshot.checked ?? {}).forEach(([k, date]) => {
    const [week, day, exercise] = parseKey(k);
    logs.push({ week, day, exercise, set: CHECK_SET, weight: null, reps: null, note: null, date: isISODate(date) ? date : null });
  });
  Object.keys(snapshot.completed).forEach((k) => {
    if (!snapshot.completed[k]) return;
    const [week, day] = parseKey(k);
    completed.push({ week, day });
  });
  return {
    p_weeks_count: snapshot.weeksCount, p_exercises: snapshot.routine, p_logs: logs, p_completed: completed,
    p_schedule: snapshot.schedule ?? null, p_start_date: isISODate(snapshot.startDate) ? snapshot.startDate : null,
  };
}
