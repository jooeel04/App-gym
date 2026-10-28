"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate } from "@/domain/calendar";
import { DAY_NAMES } from "@/domain/snapshot";
import { closeOnBackdrop } from "./backdrop";
import { Delta } from "./exercise-progress";
import { PartyIcon, StrongIcon, TrendUpIcon, TrophyIcon } from "./icons";

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

// Resumen al completar un día o terminar el entreno en curso: duración, series, carga
// movida, récords batidos y cómo fue cada ejercicio frente a la última vez.
export function DaySummary() {
  const { summary, model, stats, records, today, actions } = useWorkout();
  if (!summary) return null;
  const { week, day, minutes } = summary;
  const tally = stats.day(week, day);
  const done = model.exercisesOfDay(day).flatMap((x) => {
    const now = stats.session(x, week);
    return now ? [{ x, now, before: stats.lastBefore(x, week) }] : [];
  });
  const sessions = done.map((e) => e.now);
  const volume = sessions.reduce((sum, s) => sum + s.volume, 0);
  // Frente a la última vez: más peso máximo; con el mismo peso, más repeticiones.
  const compared = done.flatMap(({ x, now, before }) => {
    if (!before) return [];
    const kg = (now.topWeight ?? 0) - (before.topWeight ?? 0);
    const reps = now.reps - before.reps;
    return [{ x, kg, reps, better: kg > 0 || (kg === 0 && reps > 0) }];
  });
  const better = compared.filter((c) => c.better).length;
  const prevVolume = done.every((e) => e.before) ? done.reduce((sum, e) => sum + e.before!.volume, 0) : null;
  const reps = sessions.reduce((sum, s) => sum + s.reps, 0);
  const prs = records.filter((r) => r.day === day);
  // Se puede terminar un entreno sin haber completado el día.
  const complete = model.isDayCompleted(week, day);

  return (
    <div className="backdrop open summary-backdrop" role="dialog" aria-modal="true" aria-labelledby="summaryTitle" {...closeOnBackdrop(actions.closeSummary)}>
      <div className="modal summary">
        <div className="summary-emoji" aria-hidden="true">{complete ? <PartyIcon /> : <StrongIcon />}</div>
        <h2 id="summaryTitle">{complete ? "¡Día completado!" : "Entreno terminado"}</h2>
        <p>{DAY_NAMES[day]}{today && " · " + formatLongDate(today).toLowerCase()}</p>
        <div className="summary-grid">
          <div><strong>{minutes ? minutes + " min" : "—"}</strong><span>Duración</span></div>
          <div><strong>{tally.n}</strong><span>Series</span></div>
          <div><strong>{fmt(volume)} kg</strong><span>Carga movida</span>{prevVolume !== null && volume > 0 && <Delta value={volume - prevVolume} unit=" kg" />}</div>
          <div><strong>{reps}</strong><span>Repeticiones</span></div>
        </div>
        {prs.length > 0 && (
          <div className="summary-prs">
            <b><TrophyIcon /> {prs.length === 1 ? "1 récord nuevo" : prs.length + " récords nuevos"}</b>
            {prs.map((r, i) => (
              <span key={i}>{model.findExercise(r.exerciseId)?.name}: {fmt(r.weight)} kg × {r.reps}</span>
            ))}
          </div>
        )}
        {compared.length > 0 && (
          <div className="summary-vs">
            <b>{better > 0 && <TrendUpIcon />}{better > 0 ? " Mejoraste en " + better + " de " + compared.length + (compared.length === 1 ? " ejercicio" : " ejercicios") : "Frente a la última vez"}</b>
            {compared.map(({ x, kg, reps }) => (
              <div key={x.id}>
                <span>{x.name}</span>
                {kg !== 0 ? <Delta value={kg} unit=" kg" /> : reps !== 0 ? <Delta value={reps} unit=" reps" /> : <Delta value={0} />}
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions"><button className="primary" type="button" onClick={actions.closeSummary}>¡Genial!</button></div>
      </div>
    </div>
  );
}
