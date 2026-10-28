"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES } from "@/domain/snapshot";
import { clock } from "./active-workout-bar";
import { ExerciseDetail, supersetRole, useNextExercise } from "./training-view";

// Pantalla completa del entreno en curso (modo foco): un ejercicio cada vez, en
// grande. Al terminar uno pasa solo al siguiente; con las flechas se puede ir a otro.
export function WorkoutFocus() {
  const { active, focusOpen, model, week, day, actions } = useWorkout();
  const { next, editingHandlers } = useNextExercise(focusOpen);
  // Ejercicio elegido con las flechas (null = el que toca). Al terminar uno se vuelve
  // a seguir el que toca.
  const [pick, setPick] = useState<number | null>(null);
  const [seen, setSeen] = useState(next);
  if (seen !== next) {
    setSeen(next);
    setPick(null);
  }
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  const list = model.exercisesOfDay(day);
  const index = Math.min(pick ?? (next >= 0 ? next : list.length - 1), list.length - 1);

  useEffect(() => {
    if (!focusOpen) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [focusOpen]);

  // Cada ejercicio nuevo empieza desde arriba.
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [index]);

  if (!focusOpen || !active || index < 0) return null;
  const x = list[index];
  const done = model.isExerciseDone(week, day, x);
  const filled = done && !model.isExerciseChecked(week, day, x.id);
  const doneCount = list.filter((e) => model.isExerciseDone(week, day, e)).length;
  const superset = supersetRole(list, index);
  const go = (i: number) => setPick(i === next ? null : i);

  return (
    <div className="focus-mode" ref={ref} role="dialog" aria-modal="true" aria-label={"Entreno en curso: " + x.name}>
      <header className="focus-head">
        <button type="button" className="focus-min" onClick={actions.closeFocus} aria-label="Minimizar y ver la lista">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="focus-time">
          <small><span className="live-dot" aria-hidden="true" />Día {day} · {DAY_NAMES[day]}</small>
          <strong>{clock(now - active.startedAt)}</strong>
        </div>
        <button type="button" className="live-finish" onClick={actions.finishWorkout}>Terminar</button>
      </header>

      <div className="focus-steps" role="tablist" aria-label={doneCount + " de " + list.length + " ejercicios hechos"}>
        {list.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={i === index} aria-label={"Ejercicio " + (i + 1) + ": " + e.name}
            className={"focus-step" + (model.isExerciseDone(week, day, e) ? " done" : "") + (i === index ? " current" : "")}
            onClick={() => go(i)} />
        ))}
      </div>

      <div className="focus-body" key={x.id} {...editingHandlers}>
        <div className="focus-count">
          Ejercicio {index + 1} de {list.length}
          {superset && <span className="ss-tag">Superserie</span>}
          {done && <span className="focus-done">✓ Hecho</span>}
        </div>
        <h2 className="focus-name">{x.name}</h2>
        <p className="focus-pres">{x.prescription}</p>
        <ExerciseDetail exercise={x} superset={superset} />
        {!filled && (
          <button type="button" className={"focus-check" + (done ? " done" : "")} onClick={() => actions.toggleExerciseChecked(week, day, x.id)}>
            {done ? "Quitar marca de hecho" : "✓ Marcar como hecho sin anotar series"}
          </button>
        )}
      </div>

      <footer className="focus-nav">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>‹ Anterior</button>
        <span>{doneCount}/{list.length}</span>
        <button type="button" className="primary" onClick={() => go(index + 1)} disabled={index === list.length - 1}>Siguiente ›</button>
      </footer>
    </div>
  );
}
