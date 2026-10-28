"use client";

import { ActivityCalendar } from "./activity-calendar";
import { DailyLog } from "./daily-log";
import { ExerciseProgress } from "./exercise-progress";
import { LeaderboardCard } from "./leaderboard";
import { BodyCard, RecordsCard, StreakCard } from "./progress-cards";

// Vista "Progreso": racha, calendario de días entrenados, progreso de cada ejercicio
// (la última vez y su fuerza), récords, peso y medidas, y registro diario.
export function ProgressView() {
  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu avance</div>
          <h1>Progreso</h1>
          <p className="lede">Tu racha, qué días entrenaste, tu fuerza en cada ejercicio, tus récords y tus medidas.</p>
        </div>
      </div>

      <StreakCard />

      <ActivityCalendar />

      <ExerciseProgress />

      <RecordsCard />

      <BodyCard />

      <LeaderboardCard />

      <DailyLog />
    </section>
  );
}
