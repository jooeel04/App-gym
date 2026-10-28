"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";

const formatKg = (n: number) => n.toLocaleString("es-ES") + " kg";

// Una gráfica por día de rutina: volumen (kg × repeticiones) de cada semana.
export function DayProgressCharts() {
  const { model, stats, week } = useWorkout();
  const weeks = Array.from({ length: model.weeksCount }, (_, i) => i + 1);

  return (
    <section className="chart">
      <div className="charttitle"><h2>Progreso por día</h2><span>Volumen por semana · kg × reps</span></div>
      <div className="daycharts">
        {DAYS.map((d) => {
          const values = weeks.map((w) => stats.volume(w, d));
          const max = Math.max(...values);
          const done = values.map((v, i) => ({ v, w: i + 1 })).filter((x) => x.v > 0);
          const last = done[done.length - 1], prev = done[done.length - 2];
          const change = last && prev ? Math.round(((last.v - prev.v) / prev.v) * 100) : null;
          return (
            <article className="daychart" key={d}>
              <div className="daychart-head">
                <strong><i className="swatch" style={{ background: "var(--day" + d + ")" }} />Día {d} · {DAY_NAMES[d]}</strong>
                <span>
                  {last ? formatKg(last.v) + " en S" + last.w : "Sin datos"}
                  {change !== null && <b>{" " + (change > 0 ? "+" : "") + change + "%"}</b>}
                </span>
              </div>
              {max === 0
                ? <div className="empty">Anota carga y repeticiones para ver tu progreso.</div>
                : (
                  <div className="bars">
                    {values.map((v, i) => (
                      <div className="weekcol" key={i} title={"Semana " + (i + 1) + ": " + formatKg(v)}>
                        <div className="barwrap">
                          <div className="bar" style={{ height: Math.max(3, (v / max) * 100) + "%", background: "var(--day" + d + ")", opacity: v ? 1 : 0.25 }} />
                        </div>
                        <span className={"weeklabel" + (i + 1 === week ? " current" : "")}>S{i + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
