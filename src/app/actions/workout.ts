"use server";

import { isISODate } from "@/domain/calendar";
import { isValidSnapshot } from "@/domain/snapshot";
import type { WorkoutChange, WorkoutSnapshot } from "@/domain/types";
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

const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isText = (v: unknown, max: number) => v === undefined || (typeof v === "string" && v.length <= max);

function isWorkoutChange(c: unknown): c is WorkoutChange {
  const x = c as Record<string, unknown>;
  if (!x || typeof x !== "object") return false;
  switch (x.type) {
    case "entry": {
      const e = x.entry as Record<string, unknown> | null;
      const entryOk = e === null || (typeof e === "object" && isText(e.weight, 12) && isText(e.reps, 12) && isText(e.note, 160)
        && (e.date === undefined || isISODate(e.date)));
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && isInt(x.exerciseId, 0, 1e6) && isInt(x.set, 1, 10) && entryOk;
    }
    case "completed":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && typeof x.done === "boolean";
    case "exerciseChecked":
      return isInt(x.week, 1, 520) && isInt(x.day, 1, 5) && isInt(x.exerciseId, 0, 1e6) && (x.date === null || isISODate(x.date));
    case "exerciseAdded": {
      const ex = x.exercise as Record<string, unknown>;
      return !!ex && isInt(ex.id, 0, 1e6) && isInt(ex.day, 1, 5) && isInt(ex.sets, 1, 10)
        && typeof ex.name === "string" && ex.name.length >= 1 && ex.name.length <= 80
        && isText(ex.note, 240) && isText(ex.target, 30) && isText(ex.prescription, 60) && isInt(x.position, 0, 1e6);
    }
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
    case "logsCleared":
    case "replaced":
      return true;
    default:
      return false;
  }
}
