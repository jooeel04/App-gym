import { hasAny, isValidSnapshot } from "./snapshot";
import type { WorkoutSnapshot } from "./types";
import type { WorkoutModel } from "./workout-model";

// Formatos de intercambio: copia JSON (restaurable) y exportación CSV para Excel.
export class BackupService {
  constructor(private readonly model: WorkoutModel) {}

  toJSON() {
    return JSON.stringify(this.model.snapshot, null, 2);
  }

  // Devuelve la copia si es válida o null.
  parse(text: string): WorkoutSnapshot | null {
    try {
      const backup: unknown = JSON.parse(text);
      return isValidSnapshot(backup) ? backup : null;
    } catch {
      return null;
    }
  }

  toCsv() {
    const m = this.model;
    const rows: (string | number)[][] = [["Semana", "Día", "Vez", "Grupo", "Ejercicio", "Serie", "Carga (kg)", "Repeticiones", "Notas"]];
    for (let w = 1; w <= m.weeksCount; w++) {
      m.days.forEach((d) => {
        // Cada vez que se hizo el día en esa semana (1.ª, 2.ª…).
        for (let r = 1; r <= m.lastRound(w, d); r++) {
          m.exercisesOfDay(d).forEach((x) => {
            for (let s = 1; s <= x.sets; s++) {
              const e = m.getEntry(w, d, x.id, s, r);
              if (hasAny(e)) rows.push([w, d, r, m.dayName(d), x.name, s, e.weight || "", e.reps || "", e.note || ""]);
            }
          });
        }
      });
    }
    return "﻿" + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  }
}
