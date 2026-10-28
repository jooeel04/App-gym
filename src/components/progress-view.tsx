"use client";

import { ActivityCalendar } from "./activity-calendar";
import { ExerciseProgress } from "./exercise-progress";
import { BodyCard, ProgressStats } from "./progress-cards";

// Vista "Progreso": resumen (racha, días y récords del mes), calendario (al tocar un día se ve lo que se entrenó),
// progreso de cada ejercicio (la última vez, su fuerza y su récord) y peso y medidas.
export function ProgressView() {
  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu avance</div>
          <h1>Progreso</h1>
        </div>
      </div>

      <ProgressStats />

      <ActivityCalendar />

      <ExerciseProgress />

      <BodyCard />
    </section>
  );
}
