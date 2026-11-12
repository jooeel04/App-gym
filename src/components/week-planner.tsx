"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate, formatShortDate, WEEKDAY_SHORT, weekdayOf } from "@/domain/calendar";
import { weekStrip, type StripDay } from "@/domain/week-strip";
import { FlameIcon } from "./icons";

// «Esta semana» (spec hoy R33, R37): la tira de 7 días y, al tocar uno, su panel con lo que
// se puede hacer ese día (editar lo hecho, recuperar o adelantar lo que toca, otra rutina u
// otra fecha). Es lo que antes era «Otro día». No hay aviso de pendientes (spec hoy R14): lo
// que falta esta semana se ve en la tira con borde.



// Fondo de un día hecho: el color de cada día de rutina hecho esa fecha (repartido si hay varios).
const doneBackground = (days: number[]) => (days.length === 1
  ? "var(--day" + days[0] + ")"
  : "linear-gradient(90deg," + days.map((d, i) => "var(--day" + d + ") " + (i * 100) / days.length + "% " + ((i + 1) * 100) / days.length + "%").join(",") + ")");

export function WeekPlanner({ today }: { today: string }) {
  const { model, calendar, diary } = useWorkout();
  // Día con el panel abierto (null: ninguno).
  const [open, setOpen] = useState<string | null>(null);
  const days = weekStrip(today, calendar, diary);
  const { weekDone, weekTotal, current } = calendar.streak(today);
  const names = (list: number[]) => list.map((x) => model.dayName(x)).join(" y ");
  const describe = (d: StripDay) => formatShortDate(d.date) + ": "
    + (d.done.length ? names(d.done) + " hecho" : d.planned.length ? "toca " + names(d.planned) : "descanso");
  const toggleDay = (date: string) => setOpen(open === date ? null : date);

  return (
    <section className="week-strip-card">
      <div className="week-strip-head">
        <h3>Esta semana</h3>
        <span className="week-strip-count">{weekDone} de {weekTotal}</span>
        {current > 0 && <span className="week-strip-streak"><FlameIcon />{current}</span>}
      </div>
      <ul className="week-dots" aria-label="Esta semana">
        {days.map((d) => {
          const state = d.done.length ? "done" : d.planned.length ? "todo" : "rest";
          const selected = open === d.date;
          return (
            <li key={d.date} aria-current={d.today ? "date" : undefined}>
              <button type="button" className={"week-dot " + state + (d.today ? " today" : "") + (selected ? " selected" : "")}
                aria-label={describe(d)} aria-expanded={selected} onClick={() => toggleDay(d.date)}
                style={state === "done" ? { "--dot": doneBackground(d.done) } as React.CSSProperties
                  : state === "todo" ? { "--dot": "var(--day" + d.planned[0] + ")" } as React.CSSProperties : undefined}>
                <span aria-hidden="true">{WEEKDAY_SHORT[weekdayOf(d.date)]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <DayPanel key={open} date={open} today={today} onDate={setOpen} onDone={() => setOpen(null)} />}
    </section>
  );
}

// Lo que se puede hacer un día: editar lo entrenado, recuperar (pasado) o adelantar (hoy o
// después) lo que tocaba, otra rutina (en un día pasado, con esa fecha) u otra fecha.
function DayPanel({ date, today, onDate, onDone }: { date: string; today: string; onDate: (date: string) => void; onDone: () => void }) {
  const { model, calendar, diary, actions } = useWorkout();
  const [otherDate, setOtherDate] = useState(false);
  const past = date < today;
  const workouts = diary.workouts().filter((w) => w.date === date);
  const pending = calendar.sessionsOn(date).filter((s) => !calendar.isDone(s.week, s.day, s.round));
  const run = (fn: () => void) => { fn(); onDone(); };
  const choose = (d: number) => run(() => (past ? actions.logPastDay(date, d) : actions.selectDay(d)));

  return (
    <div className="day-panel" role="region" aria-label={formatLongDate(date)}>
      <b className="day-panel-title">{formatLongDate(date)}</b>
      {(workouts.length > 0 || pending.length > 0) && (
        <div className="day-panel-main">
          {workouts.map((w) => (
            <button key={"w" + w.day + "-" + w.round} type="button" className="day-panel-btn" style={{ "--dc": "var(--day" + w.day + ")" } as React.CSSProperties}
              onClick={() => run(() => actions.editSession(w))}>Editar {model.dayName(w.day)}</button>
          ))}
          {pending.map((s) => (
            <button key={"p" + s.day + "-" + s.round} type="button" className="day-panel-btn primary-ish" style={{ "--dc": "var(--day" + s.day + ")" } as React.CSSProperties}
              onClick={() => run(() => (past ? actions.recoverSession(s) : actions.selectDay(s.day)))}>Hacer {model.dayName(s.day)} hoy</button>
          ))}
        </div>
      )}
      <small className="day-panel-sub">{past ? "Otra rutina (se apunta con esta fecha)" : "Otra rutina"}</small>
      <div className="day-panel-chips" role="group" aria-label="Otra rutina">
        {model.days.map((d) => (
          <button key={d} type="button" className="day-chip" onClick={() => choose(d)}>
            <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{model.dayName(d)}
          </button>
        ))}
      </div>
      {otherDate ? (
        <label className="day-panel-date">
          <span>Otra fecha</span>
          <input type="date" value={date} min={model.startDate ?? undefined} max={today} onChange={(e) => { if (e.target.value) onDate(e.target.value); }} />
        </label>
      ) : (
        <button type="button" className="day-panel-link" onClick={() => setOtherDate(true)}>Otra fecha…</button>
      )}
    </div>
  );
}
