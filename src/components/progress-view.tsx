"use client";

import { ActivityCalendar } from "./activity-calendar";
import { DailyLog } from "./daily-log";
import { ExerciseProgress } from "./exercise-progress";

// Vista "Progreso": calendario de días entrenados, progreso de cada ejercicio
// (la última vez y su evolución) y registro diario.
export function ProgressView() {
  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu avance</div>
          <h1>Progreso</h1>
          <p className="lede">Qué días entrenaste y lo que hiciste la última vez en cada ejercicio.</p>
        </div>
      </div>

      <ActivityCalendar />

      <ExerciseProgress />

      <DailyLog />
    </section>
  );
}
