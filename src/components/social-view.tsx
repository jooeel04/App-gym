"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { LeaderboardCard } from "./leaderboard";
import { ShareRoutineCard } from "./share-routine";

// Vista "Social": todo lo de los amigos en un sitio. Clasificación del mes, quién levanta
// más en cada ejercicio, el grupo (código, crear, unirse) y compartir o importar rutinas.
// Necesita cuenta: sin ella (modo local) explica cómo usarlo.
export function SocialView() {
  const { mode, nickname } = useWorkout();
  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{nickname ? nickname + " y sus amigos" : "Tus amigos"}</div>
          <h1>Social</h1>
        </div>
      </div>
      {mode === "cloud" ? (
        <>
          <LeaderboardCard />
          <ShareRoutineCard />
        </>
      ) : (
        <section className="chart social-empty">
          <h2>Entrena con tus amigos</h2>
          <p className="body-hint">Para compararte con tus amigos, ver quién levanta más y compartir rutinas, inicia sesión con tu cuenta.</p>
        </section>
      )}
    </section>
  );
}
