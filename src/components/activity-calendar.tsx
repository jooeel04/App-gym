"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatLongDate, formatShortDate, parseISODate, toISODate, WEEKDAY_SHORT, WEEKDAYS, weekdayOf } from "@/domain/calendar";
import type { SetEntry } from "@/domain/types";
import type { Workout } from "@/domain/workout-diary";
import { fmt } from "./exercise-progress";
import { ArrowIcon, PencilIcon } from "./icons";

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
  const { model, diary, today } = useWorkout();
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
  // Entrenos de ese día, para «Editar», «Cambiar fecha» y «Borrar entreno».
  const workouts = diary.workouts().filter((w) => w.date === sel);
  // Tras cambiar la fecha de un entreno, el calendario salta a ese día (y a su mes).
  const show = (date: string) => {
    const d = parseISODate(date);
    setOffset((d.getFullYear() - base.getFullYear()) * 12 + d.getMonth() - base.getMonth());
    setSelected(date);
  };

  return (
    <section className="chart">
      <div className="charttitle">
        <h2>Calendario</h2>
        <div className="monthnav">
          <button type="button" aria-label="Mes anterior" onClick={() => setOffset((o) => o - 1)}><ArrowIcon dir="left" /></button>
          <span>{month.charAt(0).toUpperCase() + month.slice(1)}</span>
          <button type="button" aria-label="Mes siguiente" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}><ArrowIcon dir="right" /></button>
        </div>
      </div>
      <div className="calgrid" role="group" aria-label={"Días entrenados en " + month}>
        {WEEKDAYS.map((wd) => <span className="calhead" key={wd}>{WEEKDAY_SHORT[wd]}</span>)}
        {Array.from({ length: blanks }, (_, i) => <span key={"b" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = addDays(first, i);
          const done = Array.from(activity.get(date) ?? []).sort();
          const label = formatLongDate(date) + ": " + (done.length ? done.map((d) => model.dayName(d)).join(", ") : "sin entrenar");
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
                  <b>{model.dayName(d)}</b>
                  {(() => {
                    // Lo que antes decía el historial: series y kilos de ese día de rutina.
                    const mine = workouts.filter((w) => w.day === d);
                    const sets = mine.reduce((n, w) => n + w.sets, 0), kg = mine.reduce((n, w) => n + w.volume, 0);
                    return sets > 0 && <small className="calinfo-total">{sets} {sets === 1 ? "serie" : "series"}{kg > 0 && " · " + fmt(kg) + " kg"}</small>;
                  })()}
                  {(() => {
                    // Si se hizo otro día del que tocaba, se indica cuándo tocaba.
                    // Si se repitió en la misma semana, qué vez fue.
                    const moved = sessions.filter((s) => s.round > 1 || (s.plannedDate && s.plannedDate !== sel))
                      .map((s) => (s.round > 1 ? s.round + ".ª vez esa semana" : (s.plannedDate! < sel ? "Hecho más tarde" : "Adelantado") + " · era el " + formatShortDate(s.plannedDate!)));
                    if (sessions.every((s) => s.exercises.length === 0)) moved.push("Marcado como hecho");
                    return moved.length > 0 && <small>{moved.join(" · ")}</small>;
                  })()}
                </span>
              </div>
              {sessions.flatMap((s) => s.exercises.map((x) => ({ ...x, round: s.round }))).map(({ exercise, sets, round }) => (
                <div className="diary-ex" key={round + "-" + exercise.id}>
                  <span>{exercise.name}</span>
                  <span>{sets.map(({ set, entry }) => <i key={set} title={entry.note || undefined}>{describeSet(entry)}{entry.note && <PencilIcon className="note-mark" />}</i>)}</span>
                </div>
              ))}
              {/* Corregir, mover o quitar lo de ese día (p. ej. marcado sin querer). */}
              {workouts.filter((w) => w.day === d).map((w) => (
                <WorkoutActions key={w.round} workout={w} onMoved={show} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Botones de un entreno del día tocado: «Editar» (lo abre en Hoy), «Cambiar fecha» (un campo
// de fecha ahí mismo; al guardar avisa con `onMoved` para que el calendario salte a ese día)
// y «Borrar entreno» (pregunta antes).
function WorkoutActions({ workout: w, onMoved }: { workout: Workout; onMoved: (date: string) => void }) {
  const { model, today, actions } = useWorkout();
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(w.date);
  const name = model.dayName(w.day);
  const saveDate = () => {
    if (date === w.date) setMoving(false);
    else if (actions.moveSession(w, date)) onMoved(date);
  };

  if (moving) {
    return (
      <div className="move-date">
        <label className="form-label">Nueva fecha
          <input type="date" value={date} min={model.startDate ?? undefined} max={today ?? undefined} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={() => { setDate(w.date); setMoving(false); }}>Cancelar</button>
          <button className="primary" type="button" disabled={!date} onClick={saveDate}>Guardar fecha</button>
        </div>
      </div>
    );
  }
  return (
    <div className="calinfo-actions">
      <button type="button" className="edit-ex" aria-label={"Editar " + name} onClick={() => actions.editSession(w)}>Editar</button>
      <button type="button" className="edit-ex" aria-label={"Cambiar fecha de " + name} onClick={() => setMoving(true)}>Cambiar fecha</button>
      <button type="button" className="remove-ex" aria-label={"Borrar " + name} onClick={() => { void actions.deleteSession(w); }}>Borrar entreno</button>
    </div>
  );
}
