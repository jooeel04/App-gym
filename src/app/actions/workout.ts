"use server";

import { isISODate } from "@/domain/calendar";
import { isValidSnapshot } from "@/domain/snapshot";
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


function isWorkoutChange(c: unknown): c is WorkoutChange {
  const x = c as Record<string, unknown>;
  if (!x || typeof x !== "object") return false;
  switch (x.type) {
    case "entry": {
      const e = x.entry as Record<string, unknown> | null;
      const entryOk = e === null || (typeof e === "object" && isText(e.weight, 12) && isText(e.reps, 12) && isText(e.note, 160)
        && (e.date === undefined || isISODate(e.date)));
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && isInt(x.exerciseId, 0, 1e6) && isInt(x.set, 1, 13) && entryOk;
    }
    case "completed":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && typeof x.done === "boolean";
    case "exerciseChecked":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && isInt(x.exerciseId, 0, 1e6) && (x.date === null || isISODate(x.date));
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
    case "schedule": {
      const schedule = x.schedule as Record<string, unknown>;
      const scheduleOk = !!schedule && typeof schedule === "object"
        && Object.entries(schedule).every(([day, weekday]) => /^[1-5]$/.test(day) && isInt(weekday, 1, 7));
      return scheduleOk && (x.startDate === null || isISODate(x.startDate));
    }
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
