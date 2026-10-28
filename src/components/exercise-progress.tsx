"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatDayMonth, formatShortDate } from "@/domain/calendar";
import { estimate1RM } from "@/domain/progression";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { TrophyIcon } from "./icons";
import { TapLineChart } from "./tap-line-chart";

export const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Diferencia con la vez anterior: ▲ sube, ▼ baja.
export function Delta({ value, unit = "" }: { value: number; unit?: string }) {
  if (value === 0) return <span className="delta same">= igual</span>;
  return <span className={"delta " + (value > 0 ? "up" : "down")}>{value > 0 ? "▲ +" : "▼ "}{fmt(value)}{unit}</span>;
}

export function describeSet(r: SetResult) {
  const kg = r.weight !== null ? fmt(r.weight) + " kg" : "—";
  return r.reps !== null ? kg + " × " + r.reps : kg;
}

// Tarjeta de un ejercicio: la última vez, su 1RM estimado (con la diferencia con la
// vez anterior), el récord y la evolución de la fuerza.
function ExerciseCard({ exercise: x }: { exercise: Exercise }) {
  const { stats, records } = useWorkout();
  const history = stats.exerciseHistory(x);
  const last = history[history.length - 1], prev = history[history.length - 2];
  const record = stats.record(x);
  const fresh = records.some((r) => r.exerciseId === x.id);
  const [info, setInfo] = useState(false);
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
              <span>La última vez · {last.date ? formatShortDate(last.date) : "semana " + last.week}</span>
              <div className="setchips">
                {last.sets.map((r) => <span key={r.set} className="setchip">{describeSet(r)}</span>)}
              </div>
            </div>
            <div className="exprog-1rm">
              <span>Fuerza<button type="button" className="info-btn" aria-expanded={info} aria-label="¿Qué es la fuerza?" onClick={() => setInfo(!info)}>i</button></span>
              <strong>{last.e1rm ? fmt(Math.round(last.e1rm * 2) / 2) + " kg" : "—"}</strong>
              {prev && last.e1rm > 0 && prev.e1rm > 0 && <Delta value={Math.round((last.e1rm - prev.e1rm) * 2) / 2} unit=" kg" />}
            </div>
            {info && <p className="exprog-info">Fuerza = lo máximo que podrías levantar una vez (1RM), calculado con tus series. Si sube, te estás haciendo más fuerte.</p>}
            {record && (
              <p className={"exprog-record" + (fresh ? " fresh" : "")}>
                <TrophyIcon /> Récord: <b>{fmt(record.best1RM.weight)} kg × {record.best1RM.reps}</b> · fuerza {fmt(Math.round(record.best1RM.value * 2) / 2)} kg
                {record.best1RM.date && " · " + formatShortDate(record.best1RM.date)}
                {fresh && <span className="new-tag">¡Nuevo!</span>}
              </p>
            )}
            <TapLineChart color={color} caption={"Fuerza de " + x.name + " por fecha"}
              points={history.filter((s) => s.e1rm > 0).map((s) => {
                const best = s.sets.reduce((a, b) => (estimate1RM(b.weight ?? 0, b.reps ?? 0) > estimate1RM(a.weight ?? 0, a.reps ?? 0) ? b : a));
                return { key: String(s.week), value: s.e1rm, label: "Fuerza " + fmt(Math.round(s.e1rm * 2) / 2) + " kg", sub: (s.date ? formatShortDate(s.date) : "Semana " + s.week) + " · " + describeSet(best), tick: s.date ? formatDayMonth(s.date) : "S" + s.week };
              })} />
          </>
        )}
    </article>
  );
}

// Progreso por ejercicio de cada día de rutina: lo que hiciste la última vez, tu récord
// y cómo evoluciona tu fuerza.
export function ExerciseProgress() {
  const { model, stats, day: currentDay } = useWorkout();
  const [day, setDay] = useState(currentDay);
  // Solo los ejercicios con registros ocupan una tarjeta.
  const list = model.exercisesOfDay(day);
  const withData = list.filter((x) => stats.exerciseHistory(x).length > 0);

  return (
    <section className="chart">
      <div className="charttitle"><h2>Tus ejercicios</h2></div>
      <div className="daychips" role="tablist" aria-label="Día de rutina">
        {DAYS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === day} className={"daychip" + (d === day ? " active" : "")} onClick={() => setDay(d)}>
            <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="exprog-list" key={day}>
        {withData.map((x) => <ExerciseCard key={x.id} exercise={x} />)}
        {list.length === 0 && <div className="empty">Este día no tiene ejercicios.</div>}
        {list.length > 0 && withData.length === 0 && <div className="empty">Todavía no has anotado series de este día.</div>}
      </div>
    </section>
  );
}
