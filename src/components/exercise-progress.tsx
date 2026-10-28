"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import { estimate1RM } from "@/domain/progression";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { TapLineChart } from "./tap-line-chart";

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
                <span>1RM estimado</span>
                <strong>{last.e1rm ? fmt(Math.round(last.e1rm * 2) / 2) + " kg" : "—"}</strong>
                {prev && last.e1rm > 0 && prev.e1rm > 0 && <Delta value={Math.round((last.e1rm - prev.e1rm) * 2) / 2} unit=" kg" />}
              </div>
              <div>
                <span>Carga total</span>
                <strong>{fmt(last.volume)} kg</strong>
                {prev && <Delta value={last.volume - prev.volume} unit=" kg" />}
              </div>
            </div>
            <TapLineChart color={color} caption={"Fuerza estimada (1RM) por semana de " + x.name}
              points={history.filter((s) => s.e1rm > 0).map((s) => {
                const best = s.sets.reduce((a, b) => (estimate1RM(b.weight ?? 0, b.reps ?? 0) > estimate1RM(a.weight ?? 0, a.reps ?? 0) ? b : a));
                return { key: String(s.week), value: s.e1rm, label: "1RM " + fmt(Math.round(s.e1rm * 2) / 2) + " kg", sub: "Semana " + s.week + " · " + describeSet(best) + (s.date ? " · " + formatShortDate(s.date) : "") };
              })} />
          </>
        )}
    </article>
  );
}

// Progreso por ejercicio de cada día de rutina: lo que hiciste la última vez y cómo evoluciona.
export function ExerciseProgress() {
  const { model, stats, day: currentDay } = useWorkout();
  const [day, setDay] = useState(currentDay);
  // Solo los ejercicios con registros ocupan una tarjeta; el resto se agrupa en una línea.
  const list = model.exercisesOfDay(day);
  const withData = list.filter((x) => stats.exerciseHistory(x).length > 0);
  const pending = list.filter((x) => !withData.includes(x));

  return (
    <section className="chart">
      <div className="charttitle"><h2>Tus ejercicios</h2><span>Última vez y evolución de tu fuerza</span></div>
      <div className="daychips" role="tablist" aria-label="Día de rutina">
        {DAYS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === day} className={"daychip" + (d === day ? " active" : "")} onClick={() => setDay(d)}>
            <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="exprog-list">
        {withData.map((x) => <ExerciseCard key={x.id} exercise={x} />)}
        {list.length === 0 && <div className="empty">Este día no tiene ejercicios.</div>}
      </div>
      {pending.length > 0 && (
        <p className="exprog-pending"><b>Sin registros todavía:</b> {pending.map((x) => x.name).join(" · ")}</p>
      )}
    </section>
  );
}
