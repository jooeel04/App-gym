"use client";

import { ActivityCalendar } from "./activity-calendar";
import { ExerciseProgress } from "./exercise-progress";
import { BodyCard, ProgressStats } from "./progress-cards";
import { WorkoutHistory } from "./workout-history";

// Vista "Progreso": resumen (racha, días y récords del mes), historial de entrenos (editar o
// borrar cada uno), calendario (al tocar un día se ve lo que se entrenó),
// progreso de cada ejercicio (la última vez, su peso máximo y su récord) y peso y medidas.
// Lo de los amigos está en la pestaña Social.
export function ProgressView() {
  return (
    <section className="view active">
      <div className="pagehead">
        <h1>Progreso</h1>
      </div>

      <ProgressStats />

      <WorkoutHistory />

      <ActivityCalendar />

      <ExerciseProgress />

      <BodyCard />
    </section>
  );
}
