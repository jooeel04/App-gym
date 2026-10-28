"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatLongDate, parseISODate, toISODate, WEEKDAY_SHORT, WEEKDAYS, weekdayOf } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";

// Fondo del punto: el color de cada día de rutina hecho esa fecha (repartido si hay varios).
function dotBackground(days: number[]) {
  if (days.length === 1) return "var(--day" + days[0] + ")";
  const step = 100 / days.length;
  return "linear-gradient(90deg," + days.map((d, i) => "var(--day" + d + ") " + i * step + "% " + (i + 1) * step + "%").join(",") + ")";
}

// Calendario mensual: cada fecha es un punto que se colorea con el día de rutina
// que se hizo (series anotadas o ejercicios marcados con el tick).
export function ActivityCalendar() {
  const { diary, today } = useWorkout();
  const [offset, setOffset] = useState(0);
  if (!today) return null;

  const base = parseISODate(today);
  const first = toISODate(new Date(base.getFullYear(), base.getMonth() + offset, 1));
  const firstDate = parseISODate(first);
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
  const month = firstDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const activity = diary.activity();
  const blanks = weekdayOf(first) - 1;

  return (
    <section className="chart">
      <div className="charttitle">
        <h2>Calendario</h2>
        <div className="monthnav">
          <button type="button" aria-label="Mes anterior" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <span>{month.charAt(0).toUpperCase() + month.slice(1)}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>›</button>
        </div>
      </div>
      <div className="calgrid" role="group" aria-label={"Días entrenados en " + month}>
        {WEEKDAYS.map((wd) => <span className="calhead" key={wd}>{WEEKDAY_SHORT[wd]}</span>)}
        {Array.from({ length: blanks }, (_, i) => <span key={"b" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = addDays(first, i);
          const done = Array.from(activity.get(date) ?? []).sort();
          const label = formatLongDate(date) + ": " + (done.length ? done.map((d) => "Día " + d + " · " + DAY_NAMES[d]).join(", ") : "sin entrenar");
          return (
            <span className={"calday" + (date === today ? " today" : "")} key={date} title={label} aria-label={label}>
              <i className={"caldot" + (done.length ? " done" : "")} style={done.length ? { background: dotBackground(done) } : undefined} />
              <small>{i + 1}</small>
            </span>
          );
        })}
      </div>
      <div className="legend">
        {DAYS.map((d) => (
          <span key={d}><i className="caldot done" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}</span>
        ))}
      </div>
    </section>
  );
}
