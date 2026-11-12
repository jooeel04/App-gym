"use server";

import { isISODate } from "@/domain/calendar";
import { isValidSnapshot, MAX_DAY_NAME, MAX_DAYS, MAX_ROUNDS } from "@/domain/snapshot";
import { isExercise, isInt, isText } from "@/domain/validation";
import { BODY_FIELDS, type WorkoutChange, type WorkoutSnapshot } from "@/domain/types";
import { getUserRepository } from "@/lib/workout-data";

// Puerta del navegador a la base de datos. Las Server Actions son endpoints
// públicos, así que se exige sesión y se valida la forma de lo que llega antes de
// escribir. Cada usuario escribe con su propia sesión: RLS impide tocar datos ajenos.

async function requireRepository() {
  const session = await getUserRepository();
  if (!session) throw new Error("Sesión caducada: vuelve a iniciar sesión");
  return session.repository;
}

export async function loadWorkout(): Promise<WorkoutSnapshot | null> {
  return (await requireRepository()).load();
}

export async function applyWorkoutChanges(changes: unknown, snapshot: unknown): Promise<void> {
  if (!Array.isArray(changes) || changes.length > 500 || !changes.every(isWorkoutChange)) {
    throw new Error("Cambios no válidos");
  }
  const needsSnapshot = changes.some((c) => c.type === "replaced");
  if (needsSnapshot && !isValidSnapshot(snapshot)) throw new Error("Copia no válida");

  const repository = await requireRepository();
  const current = (needsSnapshot ? snapshot : null) as WorkoutSnapshot;
  // Se esperan todas a la vez: si una falla, ninguna promesa queda sin gestionar
  // (un rechazo sin gestionar tumba el proceso del servidor).
  const writes = changes.map((c) => repository.apply(c, current));
  await Promise.all([...writes, repository.flush()]);
}


// Vez del día en la semana: sin ella es la 1.ª (cambios guardados antes de existir).
const isRound = (r: unknown) => r === undefined || isInt(r, 1, MAX_ROUNDS);
const isDayKey = (k: string) => /^[1-7]$/.test(k);
// Día de rutina → días de la semana: lista de 1–7 o, en el formato antiguo, un número (0 = sin día fijo).
const isSchedule = (s: unknown) => !!s && typeof s === "object" && !Array.isArray(s)
  && Object.entries(s).every(([day, v]) => isDayKey(day) && (Array.isArray(v) ? v.length <= 7 && v.every((w) => isInt(w, 1, 7)) : isInt(v, 0, 7)));
const isDayNames = (n: unknown) => !!n && typeof n === "object" && !Array.isArray(n)
  && Object.entries(n).every(([day, name]) => isDayKey(day) && typeof name === "string" && name.trim().length >= 1 && name.length <= MAX_DAY_NAME);

function isWorkoutChange(c: unknown): c is WorkoutChange {
  const x = c as Record<string, unknown>;
  if (!x || typeof x !== "object") return false;
  switch (x.type) {
    case "entry": {
      const e = x.entry as Record<string, unknown> | null;
      const entryOk = e === null || (typeof e === "object" && isText(e.weight, 12) && isText(e.reps, 12) && isText(e.note, 160)
        && (e.date === undefined || isISODate(e.date)));
      return isInt(x.week, 1, 520) && isInt(x.day, 1, MAX_DAYS) && isRound(x.round) && isInt(x.exerciseId, 0, 1e6) && isInt(x.set, 1, 13) && entryOk;
    }
    case "completed":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, MAX_DAYS) && isRound(x.round) && typeof x.done === "boolean";
    case "exerciseChecked":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, MAX_DAYS) && isRound(x.round) && isInt(x.exerciseId, 0, 1e6) && (x.date === null || isISODate(x.date));
    case "exerciseAdded":
      return isExercise(x.exercise) && isInt(x.position, 0, 1e6);
    case "exerciseUpdated":
      return isExercise(x.exercise);
    case "routineOrder":
      return Array.isArray(x.ids) && x.ids.length <= 300 && x.ids.every((id) => isInt(id, 0, 1e6));
    case "exerciseRemoved":
      return isInt(x.exerciseId, 0, 1e6);
    case "weeksCount":
      return isInt(x.weeksCount, 1, 520);
    case "weekRemoved":
      return isInt(x.week, 1, 520);
    case "schedule":
      return isSchedule(x.schedule) && (x.startDate === null || isISODate(x.startDate));
    case "dayNames":
      return isDayNames(x.dayNames);
    case "dayRemoved":
      return isInt(x.day, 1, MAX_DAYS) && isDayNames(x.dayNames) && isSchedule(x.schedule);
    case "body": {
      const m = x.metrics as Record<string, unknown> | null;
      const metricsOk = m === null || (typeof m === "object"
        && Object.entries(m).every(([k, v]) => (BODY_FIELDS as readonly string[]).includes(k) && typeof v === "number" && v > 0 && v < 1000));
      return isISODate(x.date) && metricsOk;
    }
    case "logsCleared":
    case "replaced":
      return true;
    default:
      return false;
  }
}
