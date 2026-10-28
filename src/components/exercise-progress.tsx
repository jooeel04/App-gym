"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { ExerciseSession, SetResult } from "@/domain/workout-stats";

export const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Diferencia con la vez anterior: ▲ sube, ▼ baja.
function Delta({ value, unit = "" }: { value: number; unit?: string }) {
  if (value === 0) return <span className="delta same">= igual</span>;
  return <span className={"delta " + (value > 0 ? "up" : "down")}>{value > 0 ? "▲ +" : "▼ "}{fmt(value)}{unit}</span>;
}

export function describeSet(r: SetResult) {
  const kg = r.weight !== null ? fmt(r.weight) + " kg" : "—";
  return r.reps !== null ? kg + " × " + r.reps : kg;
}

// Línea con la carga máxima de cada semana en que se hizo el ejercicio. Cada bolita
// se puede tocar (o pasar el ratón) para ver su semana, fecha y carga.
function Sparkline({ history, color }: { history: ExerciseSession[]; color: string }) {
  const points = history.filter((s) => s.topWeight !== null) as (ExerciseSession & { topWeight: number })[];
  const [selected, setSelected] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 300, H = 70, pad = 10;
  const values = points.map((p) => p.topWeight);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const active = selected ?? points.length - 1, p = points[active];
  return (
    <div className="spark-wrap">
      <div className="spark-label">
        <strong>{fmt(p.topWeight)} kg</strong>
        <span>Semana {p.week}{p.date ? " · " + formatShortDate(p.date) : ""}{selected === null ? " · última" : ""}</span>
      </div>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Carga máxima por semana">
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          points={points.map((pt, i) => x(i) + "," + y(pt.topWeight)).join(" ")} />
        {points.map((pt, i) => (
          <g key={pt.week} className="spark-point" role="button" tabIndex={0} aria-label={"Semana " + pt.week + ": " + fmt(pt.topWeight) + " kg"}
            onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(i); }}>
            <circle cx={x(i)} cy={y(pt.topWeight)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(pt.topWeight)} r={i === active ? 6 : 4} fill={color} stroke="var(--s0)" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </div>
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
