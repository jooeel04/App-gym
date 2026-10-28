"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { musclesFor } from "@/domain/exercise-library";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import { BodyMap } from "./body-map";
import { ExerciseModal } from "./exercise-modal";
import { ScheduleCard, WeekdayPicker } from "./schedule-card";
import { ShareRoutineCard } from "./share-routine";

// Vista "Rutina": ejercicios por día con acciones para añadir, editar, reordenar,
// eliminar y empezar a entrenar.
export function RoutineView() {
  const { model, actions } = useWorkout();
  const [editing, setEditing] = useState<{ day: number; exercise?: Exercise } | null>(null);

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Plan de entrenamiento</div>
          <h1>Rutina por día</h1>
          <p className="lede">Elige qué día de la semana haces cada rutina y añade, edita u ordena sus ejercicios.</p>
        </div>
      </div>
      <ScheduleCard />
      <ShareRoutineCard />
      <div className="routine-grid">
        {DAYS.map((d) => {
          const list = model.exercisesOfDay(d);
          return (
            <article className="routine-day" key={d}>
              <div className="routine-head">
                <div><span>Día {d}</span><h2>{DAY_NAMES[d]}</h2></div>
                <button className="start" onClick={() => actions.startDay(d)}>Entrenar →</button>
              </div>
              <WeekdayPicker day={d} />
              {list.map((x, i) => {
                const muscles = musclesFor(x.name);
                const inSuperset = x.superset || list[i - 1]?.superset;
                return (
                  <div className={"routine-ex" + (inSuperset ? " superset" : "")} key={x.id}>
                    <div className="routine-ex-head">
                      {muscles && <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="sm" />}
                      <div>
                        <strong>{x.name}</strong>
                        <div className="meta">{x.prescription}</div>
                        {x.superset && i < list.length - 1 && <span className="ss-tag">Superserie con el siguiente</span>}
                      </div>
                      <div className="ex-order">
                        <button type="button" aria-label={"Subir " + x.name} disabled={i === 0} onClick={() => actions.moveExercise(x.id, -1)}>↑</button>
                        <button type="button" aria-label={"Bajar " + x.name} disabled={i === list.length - 1} onClick={() => actions.moveExercise(x.id, 1)}>↓</button>
                      </div>
                    </div>
                    {x.note && <p>{x.note}</p>}
                    <div className="ex-actions">
                      <button className="edit-ex" type="button" onClick={() => setEditing({ day: d, exercise: x })}>Editar</button>
                      <button className="remove-ex" type="button" onClick={() => actions.deleteExercise(x.id)}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
              <div className="routine-actions">
                <button className="add-ex" type="button" onClick={() => setEditing({ day: d })}>＋ Añadir ejercicio</button>
              </div>
            </article>
          );
        })}
      </div>
      {editing && <ExerciseModal day={editing.day} exercise={editing.exercise} onClose={() => setEditing(null)} />}
    </section>
  );
}
