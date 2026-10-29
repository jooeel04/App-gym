"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { ActivityCalendar } from "./activity-calendar";
import { ExerciseProgress } from "./exercise-progress";
import { LeaderboardCard } from "./leaderboard";
import { BodyCard, ProgressStats } from "./progress-cards";

// Vista "Progreso": resumen (racha, días y récords del mes), calendario (al tocar un día se ve lo que se entrenó),
// progreso de cada ejercicio (la última vez, su fuerza y su récord) y peso y medidas.
// Con cuenta, arriba se elige entre «Tú» y «Amigos» (clasificación del grupo: días
// entrenados y quién levanta más en cada ejercicio), a un toque.
export function ProgressView() {
  const { mode } = useWorkout();
  const [tab, setTab] = useState<"me" | "friends">("me");
  const friends = mode === "cloud" && tab === "friends";

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu avance</div>
          <h1>Progreso</h1>
        </div>
      </div>

      {mode === "cloud" && (
        <div className="segmented progress-tabs" role="tablist" aria-label="Ver">
          <button type="button" role="tab" aria-selected={!friends} onClick={() => setTab("me")}>Tú</button>
          <button type="button" role="tab" aria-selected={friends} onClick={() => setTab("friends")}>Amigos</button>
        </div>
      )}

      {friends ? <LeaderboardCard /> : (
        <>
          <ProgressStats />
          <ActivityCalendar />
          <ExerciseProgress />
          <BodyCard />
        </>
      )}
    </section>
  );
}
