"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate } from "@/domain/calendar";
import { closeOnBackdrop } from "./backdrop";
import { Delta } from "./exercise-progress";
import { FlameIcon, PartyIcon, StrongIcon, TrendUpIcon, TrophyIcon } from "./icons";
import { useKcalOf } from "./use-workout-kcal";
import { WatchKcalInput } from "./watch-kcal-input";

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

// Resumen al completar un día o terminar el entreno en curso: duración, series, carga
// movida, calorías estimadas, récords batidos y cómo fue cada ejercicio frente a la última vez.
export function DaySummary() {
  const { summary } = useWorkout();
  return summary ? <Summary {...summary} /> : null;
}

function Summary({ week, day, round, minutes, date }: { week: number; day: number; round: number; minutes: number | null; date: string }) {
  const { model, stats, records, today, nickname, actions } = useWorkout();
  const kcal = useKcalOf()(week, day, round);
  // Las del reloj, si se apuntaron (spec hoy R32): mandan sobre la estimación.
  const watch = model.watchKcal(date);
  const tally = stats.day(week, day, round);
  const done = model.exercisesOfDay(day).flatMap((x) => {
    const now = stats.session(x, week, round);
    return now ? [{ x, now, before: stats.lastBefore(x, week, round) }] : [];
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
  const complete = model.isDayCompleted(week, day, round);

  return (
    <div className="backdrop open summary-backdrop" role="dialog" aria-modal="true" aria-labelledby="summaryTitle" {...closeOnBackdrop(actions.closeSummary)}>
      <div className="modal summary">
        <div className="summary-emoji" aria-hidden="true">{complete ? <PartyIcon /> : <StrongIcon />}</div>
        <h2 id="summaryTitle">{complete ? "¡Día completado" + (nickname ? ", " + nickname : "") + "!" : "Entreno terminado" + (nickname ? ", " + nickname : "")}</h2>
        <p>{model.dayName(day)}{today && " · " + formatLongDate(today).toLowerCase()}</p>
        <div className="summary-grid">
          <div><strong>{minutes ? minutes + " min" : "—"}</strong><span>Duración</span></div>
          <div><strong>{tally.n}</strong><span>Series</span></div>
          <div><strong>{fmt(volume)} kg</strong><span>Carga movida</span>{prevVolume !== null && volume > 0 && <Delta value={volume - prevVolume} unit=" kg" />}</div>
          <div><strong>{reps}</strong><span>Repeticiones</span></div>
        </div>
        <div className="summary-kcal">
          {watch ? <b><FlameIcon /> {watch} kcal ⌚</b> : kcal && <b><FlameIcon /> ≈ {kcal.total} kcal</b>}
          {watch && kcal && <small>Estimación: ≈ {kcal.total} kcal</small>}
          {!watch && kcal && (
            <ul aria-label="Calorías de cada ejercicio">
              {kcal.each.map((x) => <li key={x.name}><span>{x.name}</span><span>≈ {x.kcal} kcal</span></li>)}
            </ul>
          )}
          {!watch && !kcal && <p className="summary-kcal-hint">Apunta tu peso en Progreso para ver las calorías</p>}
          <WatchKcalInput date={date} />
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
