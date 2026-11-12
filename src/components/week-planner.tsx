"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate, formatShortDate, WEEKDAY_SHORT, weekdayOf } from "@/domain/calendar";
import { weekStrip, type StripDay } from "@/domain/week-strip";
import { FlameIcon, WarningIcon } from "./icons";

// «Esta semana» (spec hoy R33, R37): la tira de 7 días y, al tocar uno, su panel con lo que
// se puede hacer ese día (editar lo hecho, recuperar o adelantar lo que toca, otra rutina u
// otra fecha). También los pendientes de los últimos 14 días. Es lo que antes era «Otro día».

type Open = { kind: "day"; date: string } | { kind: "pending" } | null;

// Fondo de un día hecho: el color de cada día de rutina hecho esa fecha (repartido si hay varios).
const doneBackground = (days: number[]) => (days.length === 1
  ? "var(--day" + days[0] + ")"
  : "linear-gradient(90deg," + days.map((d, i) => "var(--day" + d + ") " + (i * 100) / days.length + "% " + ((i + 1) * 100) / days.length + "%").join(",") + ")");

export function WeekPlanner({ today }: { today: string }) {
  const { model, calendar, diary, picked, week, day, round } = useWorkout();
  const [open, setOpen] = useState<Open>(null);
  const days = weekStrip(today, calendar, diary);
  const { weekDone, weekTotal, current } = calendar.streak(today);
  // El día en pantalla no se ofrece como pendiente; en un día de descanso no hay día en
  // pantalla (week/day apuntan al último de la semana), así que sí sale.
  const resting = !picked && calendar.sessionsOn(today).length === 0;
  const missed = calendar.missedSessions(today).filter((s) => resting || !(s.week === week && s.day === day && s.round === round));
  const names = (list: number[]) => list.map((x) => model.dayName(x)).join(" y ");
  const describe = (d: StripDay) => formatShortDate(d.date) + ": "
    + (d.done.length ? names(d.done) + " hecho" : d.planned.length ? "toca " + names(d.planned) : "descanso");
  const toggleDay = (date: string) => setOpen(open?.kind === "day" && open.date === date ? null : { kind: "day", date });

  return (
    <section className="week-strip-card">
      <div className="week-strip-head">
        <h3>Esta semana</h3>
        {missed.length > 0 && (
          <button type="button" className={"week-pending" + (open?.kind === "pending" ? " on" : "")} aria-expanded={open?.kind === "pending"}
            onClick={() => setOpen(open?.kind === "pending" ? null : { kind: "pending" })}>
            {missed.length} {missed.length === 1 ? "pendiente" : "pendientes"}
          </button>
        )}
        <span className="week-strip-count">{weekDone} de {weekTotal}</span>
        {current > 0 && <span className="week-strip-streak"><FlameIcon />{current}</span>}
      </div>
      <ul className="week-dots" aria-label="Esta semana">
        {days.map((d) => {
          const state = d.done.length ? "done" : d.planned.length ? "todo" : "rest";
          const selected = open?.kind === "day" && open.date === d.date;
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
      {open?.kind === "day" && <DayPanel key={open.date} date={open.date} today={today} onDate={(date) => setOpen({ kind: "day", date })} onDone={() => setOpen(null)} />}
      {open?.kind === "pending" && <PendingPanel missed={missed} onDone={() => setOpen(null)} />}
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

// Pendientes de los últimos 14 días, cada uno con «Hacer hoy».
function PendingPanel({ missed, onDone }: { missed: ReturnType<ReturnType<typeof useWorkout>["calendar"]["missedSessions"]>; onDone: () => void }) {
  const { model, actions } = useWorkout();
  return (
    <div className="day-panel pending-list">
      <div className="pending-title">Pendientes</div>
      {missed.map((s) => (
        <div className="pending-card" key={s.week + "|" + s.day + "|" + s.round}>
          <div><b><WarningIcon /> {model.dayName(s.day)}</b><span>Era el {formatLongDate(s.date).toLowerCase()}</span></div>
          <button type="button" aria-label={"Hacer hoy " + model.dayName(s.day)} onClick={() => { actions.recoverSession(s); onDone(); }}>Hacer hoy</button>
        </div>
      ))}
    </div>
  );
}
