"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES } from "@/domain/snapshot";

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

// Resumen al completar un día: duración, series, carga movida y récords batidos.
export function DaySummary() {
  const { summary, model, stats, records, actions } = useWorkout();
  if (!summary) return null;
  const { week, day, minutes } = summary;
  const tally = stats.day(week, day);
  const sessions = model.exercisesOfDay(day).map((x) => stats.session(x, week)).filter((s) => s !== null);
  const volume = sessions.reduce((sum, s) => sum + s.volume, 0);
  const reps = sessions.reduce((sum, s) => sum + s.reps, 0);
  const prs = records.filter((r) => r.day === day);

  return (
    <div className="backdrop open summary-backdrop" role="dialog" aria-modal="true" aria-labelledby="summaryTitle" onClick={(e) => { if (e.target === e.currentTarget) actions.closeSummary(); }}>
      <div className="modal summary">
        <div className="summary-emoji" aria-hidden="true">🎉</div>
        <h2 id="summaryTitle">¡Día completado!</h2>
        <p>Día {day} · {DAY_NAMES[day]} · Semana {week}</p>
        <div className="summary-grid">
          <div><strong>{minutes ? minutes + " min" : "—"}</strong><span>Duración</span></div>
          <div><strong>{tally.n}</strong><span>Series</span></div>
          <div><strong>{fmt(volume)} kg</strong><span>Carga movida</span></div>
          <div><strong>{reps}</strong><span>Repeticiones</span></div>
        </div>
        {prs.length > 0 && (
          <div className="summary-prs">
            <b>🏆 {prs.length === 1 ? "1 récord nuevo" : prs.length + " récords nuevos"}</b>
            {prs.map((r, i) => (
              <span key={i}>{model.findExercise(r.exerciseId)?.name}: {fmt(r.weight)} kg × {r.reps}</span>
            ))}
          </div>
        )}
        <div className="modal-actions"><button className="primary" type="button" onClick={actions.closeSummary}>¡Genial!</button></div>
      </div>
    </div>
  );
}
