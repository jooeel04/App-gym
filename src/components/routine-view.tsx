"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { musclesFor } from "@/domain/exercise-library";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import { BodyMap } from "./body-map";
import { ExerciseModal } from "./exercise-modal";
import { ScheduleCard, WeekdayPicker } from "./schedule-card";

// Vista "Rutina": ejercicios por día con acciones para añadir, eliminar y empezar a entrenar.
export function RoutineView() {
  const { model, actions } = useWorkout();
  const [addingDay, setAddingDay] = useState<number | null>(null);

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Plan de entrenamiento</div>
          <h1>Rutina por día</h1>
          <p className="lede">Elige qué día de la semana haces cada rutina y añade o elimina ejercicios.</p>
        </div>
      </div>
      <ScheduleCard />
      <div className="routine-grid">
        {DAYS.map((d) => (
          <article className="routine-day" key={d}>
            <div className="routine-head">
              <div><span>Día {d}</span><h2>{DAY_NAMES[d]}</h2></div>
              <button className="start" onClick={() => actions.startDay(d)}>Entrenar →</button>
            </div>
            <WeekdayPicker day={d} />
            {model.exercisesOfDay(d).map((x) => {
              const muscles = musclesFor(x.name);
              return (
                <div className="routine-ex" key={x.id}>
                  <div className="routine-ex-head">
                    {muscles && <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="sm" />}
                    <div><strong>{x.name}</strong><div className="meta">{x.prescription}</div></div>
                    <button className="remove-ex" type="button" onClick={() => actions.deleteExercise(x.id)}>Eliminar</button>
                  </div>
                  {x.note && <p>{x.note}</p>}
                </div>
              );
            })}
            <div className="routine-actions">
              <button className="add-ex" type="button" onClick={() => setAddingDay(d)}>＋ Añadir ejercicio</button>
            </div>
          </article>
        ))}
      </div>
      {addingDay !== null && <ExerciseModal day={addingDay} onClose={() => setAddingDay(null)} />}
    </section>
  );
}
