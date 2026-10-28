"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { ExerciseSession, SetResult } from "@/domain/workout-stats";
import { Delta, fmt } from "./progress-charts";

export function describeSet(r: SetResult) {
  const kg = r.weight !== null ? fmt(r.weight) + " kg" : "—";
  return r.reps !== null ? kg + " × " + r.reps : kg;
}

// Línea con la carga máxima de cada semana en que se hizo el ejercicio.
function Sparkline({ history, color }: { history: ExerciseSession[]; color: string }) {
  const points = history.filter((s) => s.topWeight !== null) as (ExerciseSession & { topWeight: number })[];
  if (points.length < 2) return null;
  const W = 220, H = 56, pad = 6;
  const values = points.map((p) => p.topWeight);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={"Carga máxima por semana: " + points.map((p) => "S" + p.week + " " + fmt(p.topWeight) + " kg").join(", ")}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        points={points.map((p, i) => x(i) + "," + y(p.topWeight)).join(" ")} />
      {points.map((p, i) => (
        <circle key={p.week} cx={x(i)} cy={y(p.topWeight)} r={i === points.length - 1 ? 4 : 3} fill={color} stroke="var(--s)" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <title>{"Semana " + p.week + ": " + fmt(p.topWeight) + " kg"}</title>
        </circle>
      ))}
    </svg>
  );
}

function ExerciseCard({ exercise: x }: { exercise: Exercise }) {
  const { stats } = useWorkout();
  const history = stats.exerciseHistory(x);
  const last = history[history.length - 1], prev = history[history.length - 2];
  const color = "var(--day" + x.day + ")";

  return (
    <article className="exprog">
      <div className="exprog-head">
        <strong>{x.name}</strong>
        <span>{x.prescription}</span>
      </div>
      {!last
        ? <p className="exprog-empty">Aún sin registros.</p>
        : (
          <>
            <div className="lasttime">
              <span>Última vez · Semana {last.week}{last.date && " · " + formatShortDate(last.date)}</span>
              <div className="setchips">
                {last.sets.map((r) => <span key={r.set} className="setchip">{describeSet(r)}</span>)}
              </div>
            </div>
            <div className="exprog-metrics">
              <div>
                <span>Carga máx.</span>
                <strong>{last.topWeight !== null ? fmt(last.topWeight) + " kg" : "—"}</strong>
                {prev && last.topWeight !== null && prev.topWeight !== null && <Delta value={last.topWeight - prev.topWeight} unit=" kg" />}
              </div>
              <div>
                <span>Repeticiones</span>
                <strong>{last.reps}</strong>
                {prev && <Delta value={last.reps - prev.reps} />}
              </div>
              <div>
                <span>Carga total</span>
                <strong>{fmt(last.volume)} kg</strong>
                {prev && <Delta value={last.volume - prev.volume} unit=" kg" />}
              </div>
            </div>
            <Sparkline history={history} color={color} />
          </>
        )}
    </article>
  );
}

// Progreso por ejercicio de cada día de rutina: lo que hiciste la última vez y cómo evoluciona.
export function ExerciseProgress() {
  const { model, day: currentDay } = useWorkout();
  const [day, setDay] = useState(currentDay);

  return (
    <section className="chart">
      <div className="charttitle"><h2>Tus ejercicios</h2><span>Última vez y evolución de la carga</span></div>
      <div className="daychips" role="tablist" aria-label="Día de rutina">
        {DAYS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === day} className={"daychip" + (d === day ? " active" : "")} onClick={() => setDay(d)}>
            <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="exprog-list">
        {model.exercisesOfDay(day).map((x) => <ExerciseCard key={x.id} exercise={x} />)}
        {model.exercisesOfDay(day).length === 0 && <div className="empty">Este día no tiene ejercicios.</div>}
      </div>
    </section>
  );
}
