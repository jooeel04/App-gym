"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { navigateTab, useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import type { Workout } from "@/domain/workout-diary";
import { closeOnBackdrop } from "./backdrop";
import { compactSets, fmt } from "./exercise-progress";
import { ChevronIcon, TrophyIcon } from "./icons";

const PAGE = 5;

// Series de trabajo de un ejercicio del historial, en corto ("55×8 · 55×8"); sin series,
// es que se marcó con el tick.
const setsText = (sets: Workout["exercises"][number]["sets"]) => {
  const work = sets.filter((s) => s.set >= 1 && s.set <= 10 && (s.entry.weight || s.entry.reps));
  if (!work.length) return "Hecho sin anotar series";
  return compactSets(work.map((s) => ({ set: s.set, weight: s.entry.weight ? Number(s.entry.weight) : null, reps: s.entry.reps ? Number(s.entry.reps) : null })));
};

// Historial de entrenos (como el de Hevy o Strong): uno por fila, el más reciente primero,
// con su día, fecha, series y kilos. Al tocar uno se ve el detalle con «Editar» y «Borrar
// entreno» (para quitar lo marcado sin querer).
export function WorkoutHistory() {
  const { diary } = useWorkout();
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Workout | null>(null);
  const all = diary.workouts();

  return (
    <section className="chart history" aria-labelledby="historyTitle">
      <div className="charttitle"><h2 id="historyTitle">Historial</h2>{all.length > 0 && <span>{all.length} {all.length === 1 ? "entreno" : "entrenos"}</span>}</div>
      {all.length === 0 ? (
        <div className="empty-start">
          <p>Aquí aparecerá cada entreno que anotes.</p>
          <button type="button" className="primary" onClick={() => navigateTab("/entrenar")}>Ir a Hoy</button>
        </div>
      ) : (
        <>
          <ul className="history-list">
            {all.slice(0, shown).map((w) => <HistoryItem key={[w.week, w.day, w.round].join("|")} workout={w} onOpen={() => setOpen(w)} />)}
          </ul>
          {shown < all.length && <button type="button" className="history-more" onClick={() => setShown(shown + 10)}>Ver más</button>}
        </>
      )}
      {open && <WorkoutDetail workout={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

// Récords conseguidos en ese entreno: ejercicios cuyo día de más peso es este.
function useRecordsIn(w: Workout) {
  const { stats } = useWorkout();
  return w.exercises.filter(({ exercise }) => {
    const r = stats.record(exercise);
    return !!r && r.heaviest.week === w.week && r.heaviest.round === w.round && exercise.day === w.day;
  }).length;
}

function HistoryItem({ workout: w, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { model } = useWorkout();
  const records = useRecordsIn(w);
  return (
    <li>
      <button type="button" className="history-item" style={{ "--dc": "var(--day" + w.day + ")" } as React.CSSProperties} onClick={onOpen}>
        <i className="history-bar" aria-hidden="true" />
        <span className="history-main">
          <b>{model.dayName(w.day)}</b>
          <small><span className="history-date">{formatShortDate(w.date)}</span> · {w.exercises.length} {w.exercises.length === 1 ? "ejercicio" : "ejercicios"}</small>
        </span>
        <span className="history-nums">
          <b>{w.sets} {w.sets === 1 ? "serie" : "series"}</b>
          <small>{w.volume > 0 ? fmt(w.volume) + " kg" : "sin carga"}{records > 0 && <> · <TrophyIcon className="gold" /> {records}</>}</small>
        </span>
        <ChevronIcon />
      </button>
    </li>
  );
}

// Detalle de un entreno: sus ejercicios con las series, y «Editar», «Cambiar fecha» o
// «Borrar entreno».
function WorkoutDetail({ workout: w, onClose }: { workout: Workout; onClose: () => void }) {
  const { model, today, actions } = useWorkout();
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(w.date);
  const title = model.dayName(w.day);
  const saveDate = () => { if (date === w.date || actions.moveSession(w, date)) onClose(); };
  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="workoutDetailTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal workout-detail">
        <h2 id="workoutDetailTitle">{title}</h2>
        <p>{formatShortDate(w.date)} · {w.sets} {w.sets === 1 ? "serie" : "series"}{w.volume > 0 && " · " + fmt(w.volume) + " kg"}</p>
        {moving ? (
          <div className="move-date">
            <label className="form-label">Nueva fecha
              <input type="date" value={date} min={model.startDate ?? undefined} max={today ?? undefined} onChange={(e) => setDate(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setMoving(false)}>Cancelar</button>
              <button className="primary" type="button" disabled={!date} onClick={saveDate}>Guardar fecha</button>
            </div>
          </div>
        ) : (
          <>
            <ul className="detail-list">
              {w.exercises.map(({ exercise, sets }) => (
                <li key={exercise.id}><b>{exercise.name}</b><span>{setsText(sets)}</span></li>
              ))}
            </ul>
            <button type="button" className="history-more" onClick={() => setMoving(true)}>Cambiar fecha</button>
            <div className="modal-actions">
              <button type="button" className="danger" onClick={() => { void actions.deleteSession(w).then((gone) => { if (gone) onClose(); }); }}>Borrar entreno</button>
              <button className="primary" type="button" onClick={() => { onClose(); actions.editSession(w); }}>Editar</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
