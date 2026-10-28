"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays } from "@/domain/calendar";
import type { PeriodTotals } from "@/domain/workout-stats";

export const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Diferencia con el periodo anterior: ▲ sube, ▼ baja.
export function Delta({ value, unit = "" }: { value: number | null; unit?: string }) {
  if (value === null || value === 0) return value === 0 ? <span className="delta same">= igual</span> : null;
  return <span className={"delta " + (value > 0 ? "up" : "down")}>{value > 0 ? "▲ +" : "▼ "}{fmt(value)}{unit}</span>;
}

const METRICS = {
  volume: { label: "Carga", unit: " kg", hint: "kg × repeticiones" },
  reps: { label: "Repeticiones", unit: " reps", hint: "repeticiones totales" },
} as const;
type Metric = keyof typeof METRICS;

// Resumen: carga movida y repeticiones de esta semana y este mes, frente a los anteriores.
export function ProgressSummary() {
  const { stats, week, today } = useWorkout();
  const weeks = stats.weeklyTotals(), months = stats.monthlyTotals();
  const thisWeek = weeks[week - 1], lastWeek = weeks[week - 2] ?? null;
  const monthKey = today?.slice(0, 7) ?? "";
  const prevMonthKey = today ? addDays(monthKey + "-01", -1).slice(0, 7) : "";
  const thisMonth = months.find((m) => m.key === monthKey) ?? null;
  const lastMonth = months.find((m) => m.key === prevMonthKey) ?? null;

  const tile = (title: string, sub: string, cur: PeriodTotals | null, prev: PeriodTotals | null, metric: Metric) => {
    const value = cur?.[metric] ?? 0;
    return (
      <div className="stat">
        <span>{title}</span>
        <strong>{fmt(value)}<small className="unit">{METRICS[metric].unit}</small></strong>
        <small>{sub}</small>
        {prev && <Delta value={value - prev[metric]} unit={METRICS[metric].unit} />}
      </div>
    );
  };

  return (
    <div className="stats stats4">
      {tile("Carga · semana " + week, "kg × reps esta semana", thisWeek ?? null, lastWeek, "volume")}
      {tile("Reps · semana " + week, "repeticiones esta semana", thisWeek ?? null, lastWeek, "reps")}
      {tile("Carga · este mes", "kg × reps este mes", thisMonth, lastMonth, "volume")}
      {tile("Reps · este mes", "repeticiones este mes", thisMonth, lastMonth, "reps")}
    </div>
  );
}

// Evolución semanal o mensual de la carga movida o de las repeticiones.
export function TrendChart() {
  const { stats, week, today } = useWorkout();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<Metric>("volume");
  const data = period === "week" ? stats.weeklyTotals() : stats.monthlyTotals();
  const currentKey = period === "week" ? String(week) : today?.slice(0, 7);
  const max = Math.max(0, ...data.map((d) => d[metric]));
  const current = data.find((d) => d.key === currentKey);
  const unit = METRICS[metric].unit;

  return (
    <section className="chart">
      <div className="charttitle">
        <h2>Evolución</h2>
        <span>{METRICS[metric].hint} por {period === "week" ? "semana" : "mes"}</span>
      </div>
      <div className="segments">
        <div className="segmented" role="group" aria-label="Periodo">
          <button type="button" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>Semanal</button>
          <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>Mensual</button>
        </div>
        <div className="segmented" role="group" aria-label="Dato">
          <button type="button" aria-pressed={metric === "volume"} onClick={() => setMetric("volume")}>Carga</button>
          <button type="button" aria-pressed={metric === "reps"} onClick={() => setMetric("reps")}>Repeticiones</button>
        </div>
      </div>
      {max === 0
        ? <div className="empty">Cuando anotes carga y repeticiones verás aquí tu evolución.</div>
        : (
          <>
            <div className="trendnow">
              <strong>{fmt(current?.[metric] ?? 0)}{unit}</strong>
              <span>{period === "week" ? "esta semana" : "este mes"}</span>
            </div>
            <div className="bars trend">
              {data.map((d) => (
                <div className="weekcol" key={d.key} title={d.label + ": " + fmt(d[metric]) + unit}>
                  <div className="barwrap">
                    <div className={"bar" + (d.key === currentKey ? " current" : "")} style={{ height: Math.max(2, (d[metric] / max) * 100) + "%" }} />
                  </div>
                  <span className={"weeklabel" + (d.key === currentKey ? " current" : "")}>{d.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
    </section>
  );
}
