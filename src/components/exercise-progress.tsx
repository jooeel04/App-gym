"use client";

import { useId, useState } from "react";
import { navigateTab, useWorkout } from "@/controllers/workout-controller";
import { formatDayMonth, formatShortDate } from "@/domain/calendar";
import { progressTrend, type ProgressTrend } from "@/domain/progression";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { ChevronIcon, TrophyIcon } from "./icons";
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

// Valor de la tendencia con su unidad: "69,5 kg" (fuerza) o "6 reps" (peso corporal).
const valueText = (t: ProgressTrend, v: number) => (t.kind === "strength" ? fmt(v) + " kg" : v + (v === 1 ? " rep" : " reps"));
const unitFor = (t: ProgressTrend, change: number) => (t.kind === "strength" ? " kg" : Math.abs(change) === 1 ? " rep" : " reps");

// Un ejercicio en Progreso: plegado se ve de un vistazo cómo va (fuerza o repeticiones
// y el cambio con la vez anterior); al tocarlo se despliega con la última vez, el récord
// y la gráfica de su evolución.
function ExerciseRow({ exercise: x, open, onToggle }: { exercise: Exercise; open: boolean; onToggle: () => void }) {
  const { stats, records } = useWorkout();
  const detailId = useId();
  const history = stats.exerciseHistory(x);
  const trend = progressTrend(history);
  const last = history[history.length - 1];
  if (!trend || !last) return null;
  const record = trend.kind === "strength" ? stats.record(x) : null;
  const fresh = records.some((r) => r.exerciseId === x.id);
  const strength = trend.kind === "strength";

  return (
    <article className={"exprog" + (open ? " open" : "")}>
      <button type="button" className="exprog-row" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className="exprog-name"><b>{x.name}</b><small>{x.prescription}</small></span>
        <span className="exprog-value">
          <small>{strength ? "Fuerza" : "Mejor serie"}</small>
          <b>{valueText(trend, trend.last.value)}</b>
          {trend.change !== null && <Delta value={trend.change} unit={unitFor(trend, trend.change)} />}
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="exprog-detail" id={detailId}>
          <div className="lasttime">
            <span>La última vez · {last.date ? formatShortDate(last.date) : "semana " + last.week}</span>
            <div className="setchips">
              {last.sets.map((r) => <span key={r.set} className="setchip">{describeSet(r)}</span>)}
            </div>
          </div>
          <p className="exprog-info">
            {strength
              ? "Fuerza = lo máximo que podrías levantar una vez (1RM), calculado con tus series. Si sube, te estás haciendo más fuerte."
              : "Repeticiones de tu mejor serie. Si suben, estás mejorando."}
          </p>
          {record && (
            <p className={"exprog-record" + (fresh ? " fresh" : "")}>
              <TrophyIcon /> Récord: <b>{fmt(record.best1RM.weight)} kg × {record.best1RM.reps}</b> · fuerza {fmt(Math.round(record.best1RM.value * 2) / 2)} kg
              {record.best1RM.date && " · " + formatShortDate(record.best1RM.date)}
              {fresh && <span className="new-tag">¡Nuevo!</span>}
            </p>
          )}
          <TapLineChart color={"var(--day" + x.day + ")"} caption={(strength ? "Fuerza de " : "Repeticiones de ") + x.name + " por fecha"}
            points={trend.points.map((p) => ({
              key: String(p.week), value: p.value,
              label: (strength ? "Fuerza " : "") + valueText(trend, p.value),
              sub: (p.date ? formatShortDate(p.date) : "Semana " + p.week) + " · " + describeSet(p.best),
              tick: p.date ? formatDayMonth(p.date) : "S" + p.week,
            }))} />
        </div>
      )}
    </article>
  );
}

// Progreso por ejercicio de cada día de rutina: una fila por ejercicio con registros
// (uno desplegado a la vez). Una cuenta sin entrenos ve qué hacer para empezar.
export function ExerciseProgress() {
  const { model, stats, day: currentDay } = useWorkout();
  const [day, setDay] = useState(currentDay);
  const [openId, setOpenId] = useState<number | null>(null);
  const titleId = useId();
  const hasData = (x: Exercise) => stats.exerciseHistory(x).length > 0;
  const list = model.exercisesOfDay(day);
  const withData = list.filter(hasData);
  const started = DAYS.some((d) => model.exercisesOfDay(d).some(hasData));

  return (
    <section className="chart" aria-labelledby={titleId}>
      <div className="charttitle"><h2 id={titleId}>Tus ejercicios</h2></div>
      {!started ? (
        <div className="empty-start">
          <p><b>Aún no has anotado ningún entreno.</b> Cuando anotes tus series en Hoy, aquí verás cómo progresa cada ejercicio.</p>
          <button type="button" className="primary" onClick={() => navigateTab("/entrenar")}>Ir a Hoy</button>
        </div>
      ) : (
        <>
          <div className="daychips" role="tablist" aria-label="Día de rutina">
            {DAYS.map((d) => (
              <button key={d} type="button" role="tab" aria-selected={d === day} className={"daychip" + (d === day ? " active" : "")}
                onClick={() => { setDay(d); setOpenId(null); }}>
                <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
              </button>
            ))}
          </div>
          {withData.length > 0 && <p className="exprog-hint">Toca un ejercicio para ver cómo ha evolucionado.</p>}
          <div className="exprog-list" key={day}>
            {withData.map((x) => (
              <ExerciseRow key={x.id} exercise={x} open={openId === x.id} onToggle={() => setOpenId(openId === x.id ? null : x.id)} />
            ))}
            {list.length === 0 && <div className="empty">Este día no tiene ejercicios.</div>}
            {list.length > 0 && withData.length === 0 && <div className="empty">Todavía no has anotado series de este día.</div>}
          </div>
        </>
      )}
    </section>
  );
}
