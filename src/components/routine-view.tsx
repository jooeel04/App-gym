"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import { ExerciseModal } from "./exercise-modal";

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
          <p className="lede">Añade ejercicios a cada día o elimina los que ya no uses.</p>
        </div>
      </div>
      <div className="routine-grid">
        {DAYS.map((d) => (
          <article className="routine-day" key={d}>
            <div className="routine-head">
              <div><span>Día {d}</span><h2>{DAY_NAMES[d]}</h2></div>
              <button className="start" onClick={() => actions.startDay(d)}>Entrenar →</button>
            </div>
            {model.exercisesOfDay(d).map((x) => (
              <div className="routine-ex" key={x.id}>
                <div className="routine-ex-head">
                  <div><strong>{x.name}</strong><div className="meta">{x.prescription}</div></div>
                  <button className="remove-ex" type="button" onClick={() => actions.deleteExercise(x.id)}>Eliminar</button>
                </div>
                {x.note && <p>{x.note}</p>}
              </div>
            ))}
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
