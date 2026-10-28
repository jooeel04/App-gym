"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatLongDate, formatShortDate, parseISODate, toISODate, WEEKDAY_SHORT, WEEKDAYS, weekdayOf } from "@/domain/calendar";
import { DAY_NAMES } from "@/domain/snapshot";
import type { SetEntry } from "@/domain/types";

function describeSet(e: SetEntry) {
  const load = e.weight ? e.weight.replace(".", ",") + " kg" : "";
  const reps = e.reps ? e.reps + " reps" : "";
  return [load, reps].filter(Boolean).join(" × ") || "—";
}

// Fondo del punto: el color de cada día de rutina hecho esa fecha (repartido si hay varios).
function dotBackground(days: number[]) {
  if (days.length === 1) return "var(--day" + days[0] + ")";
  const step = 100 / days.length;
  return "linear-gradient(90deg," + days.map((d, i) => "var(--day" + d + ") " + i * step + "% " + (i + 1) * step + "%").join(",") + ")";
}

// Calendario mensual: cada fecha es un punto que se colorea con el día de rutina
// que se hizo (series anotadas o ejercicios marcados con el tick). Al tocar un día
// se ve debajo qué se entrenó: cada ejercicio con sus series.
export function ActivityCalendar() {
  const { diary, today } = useWorkout();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  if (!today) return null;

  const base = parseISODate(today);
  const first = toISODate(new Date(base.getFullYear(), base.getMonth() + offset, 1));
  const firstDate = parseISODate(first);
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
  const month = firstDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const activity = diary.activity();
  const blanks = weekdayOf(first) - 1;
  const sel = selected ?? today;
  const selDays = Array.from(activity.get(sel) ?? []).sort();
  const selSessions = diary.days().find((d) => d.date === sel)?.sessions ?? [];

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
            <button type="button" className={"calday" + (date === today ? " today" : "") + (date === sel ? " selected" : "")} key={date} title={label} aria-label={label} aria-pressed={date === sel} onClick={() => setSelected(date)}>
              <i className={"caldot" + (done.length ? " done" : "")} style={done.length ? { background: dotBackground(done) } : undefined} />
              <small>{i + 1}</small>
            </button>
          );
        })}
      </div>
      <div className="calinfo" aria-live="polite" key={sel}>
        <strong>{formatLongDate(sel)}</strong>
        {selDays.length === 0 && <span className="calinfo-empty">Sin entrenar</span>}
        {selDays.map((d) => {
          const sessions = selSessions.filter((s) => s.day === d);
          return (
            <div className="calinfo-day" key={d}>
              <div className="calinfo-row">
                <i className="caldot done" style={{ background: "var(--day" + d + ")" }} />
                <span>
                  <b>Día {d} · {DAY_NAMES[d]}</b>
                  <small>
                    {sessions.map((s) => "Semana " + s.week
                      + (s.plannedDate && s.plannedDate !== sel ? (s.plannedDate < sel ? " · recuperado" : " · adelantado") + " (era el " + formatShortDate(s.plannedDate) + ")" : "")).join(" · ")}
                    {sessions.every((s) => s.exercises.length === 0) && (sessions.length ? " · " : "") + "Marcado con el tick"}
                  </small>
                </span>
              </div>
              {sessions.flatMap((s) => s.exercises).map(({ exercise, sets }) => (
                <div className="diary-ex" key={exercise.id}>
                  <span>{exercise.name}</span>
                  <span>{sets.map(({ set, entry }) => <i key={set} title={entry.note || undefined}>{describeSet(entry)}{entry.note ? " ✎" : ""}</i>)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
