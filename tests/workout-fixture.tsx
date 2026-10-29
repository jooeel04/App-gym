import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { WorkoutProvider } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { blankSnapshot, entryKey } from "@/domain/snapshot";
import type { SetEntry, WorkoutSnapshot } from "@/domain/types";

// "Hoy" en las pruebas: miércoles 28 de octubre de 2026 (semana 4 del ciclo).
export const TODAY = "2026-10-28";
export const START = "2026-10-05";

// Fecha fija sin falsear los temporizadores (las promesas y efectos siguen igual).
export function freezeToday() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(TODAY + "T10:00:00"));
}

const set = (weight: string | undefined, reps: string, date: string): SetEntry => (weight ? { weight, reps, date } : { reps, date });

// Ejercicios del Día 1 (Torso) de la rutina base.
export const PRESS = BASE_ROUTINE[0]; // con carga
export const DOMINADAS = BASE_ROUTINE[1]; // peso corporal: solo repeticiones
export const REMO = BASE_ROUTINE[4]; // con carga

// Tres semanas de Torso: el press y el remo suben de carga; las dominadas, de repeticiones.
export function historySnapshot(): WorkoutSnapshot {
  const snap = blankSnapshot(BASE_ROUTINE.map((x) => ({ ...x })));
  snap.startDate = START;
  snap.schedule = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  const weeks = [
    { w: 1, date: "2026-10-05", press: "50", remo: "55", dom: ["4", "3"] },
    { w: 2, date: "2026-10-12", press: "52.5", remo: "57.5", dom: ["5", "4"] },
    { w: 3, date: "2026-10-19", press: "55", remo: "60", dom: ["6", "5"] },
  ];
  for (const { w, date, press, remo, dom } of weeks) {
    for (let s = 1; s <= 3; s++) {
      snap.entries[entryKey(w, 1, PRESS.id, s)] = set(press, "8", date);
      snap.entries[entryKey(w, 1, REMO.id, s)] = set(remo, "10", date);
    }
    dom.forEach((reps, i) => { snap.entries[entryKey(w, 1, DOMINADAS.id, i + 1)] = set(undefined, reps, date); });
    snap.completed[w + "|1"] = true;
  }
  snap.body = { "2026-10-05": { weight: 80 }, "2026-10-19": { weight: 79.4 } };
  return snap;
}

// Cuenta recién creada: rutina base sin ningún registro.
export function freshSnapshot(): WorkoutSnapshot {
  const snap = blankSnapshot(BASE_ROUTINE.map((x) => ({ ...x })));
  snap.startDate = "2026-10-26";
  snap.schedule = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  return snap;
}

export function renderWithWorkout(ui: ReactNode, snapshot: WorkoutSnapshot = historySnapshot(), mode: "local" | "cloud" = "local") {
  return render(<WorkoutProvider mode={mode} initialSnapshot={snapshot} email={mode === "cloud" ? "demo@rutina.local" : null}>{ui}</WorkoutProvider>);
}
