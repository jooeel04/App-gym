"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { WEEKDAY_NAMES } from "@/domain/calendar";
import { musclesFor } from "@/domain/exercise-library";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import { BodyMap } from "./body-map";
import { ExerciseModal } from "./exercise-modal";
import { ChevronIcon } from "./icons";
import { ScheduleCard } from "./schedule-card";
import { ShareRoutineCard } from "./share-routine";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Vista "Rutina": un día por fila, plegado, ordenados de lunes a domingo (de título el
// día de la semana y debajo lo que se entrena); al tocarlo se ven sus ejercicios y el botón
// para hacerlo hoy. Con "Editar" aparecen las acciones para añadir, editar, reordenar
// y eliminar ejercicios.
export function RoutineView() {
  const { model, calendar, today, actions } = useWorkout();
  const [editing, setEditing] = useState<{ day: number; exercise?: Exercise } | null>(null);
  const [edit, setEdit] = useState(false);
  // Abierto al entrar: el día que toca hoy (si hay alguno).
  const [open, setOpen] = useState<number | null>(() => (today ? calendar.sessionsOn(today)[0]?.day ?? null : null));
  // Los días sin día fijo van al final.
  const order = [...DAYS].sort((a, b) => (model.weekdayFor(a) || 8) - (model.weekdayFor(b) || 8));

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu plan · {DAYS.length} días</div>
          <h1>Rutina</h1>
        </div>
        <button type="button" className={"tool-btn" + (edit ? " active" : "")} aria-pressed={edit} onClick={() => setEdit(!edit)}>
          {edit ? "Listo" : "Editar"}
        </button>
      </div>

      <div className="routine-list">
        {order.map((d) => {
          const list = model.exercisesOfDay(d);
          const isOpen = open === d;
          const weekday = model.weekdayFor(d);
          return (
            <article className={"routine-day" + (isOpen ? " open" : "")} key={d} style={{ "--dc": "var(--day" + d + ")" } as React.CSSProperties}>
              <button type="button" className="routine-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d)}>
                <i className="routine-bar" aria-hidden="true" />
                <span className="routine-title">
                  <b>{weekday ? capitalize(WEEKDAY_NAMES[weekday]) : "Sin día fijo"}</b>
                  <small>{DAY_NAMES[d]} · {list.length} {list.length === 1 ? "ejercicio" : "ejercicios"}</small>
                </span>
                <ChevronIcon />
              </button>
              {isOpen && (
                <div className="routine-body">
                  {list.length === 0 && !edit && <p className="routine-empty">Aún no tiene ejercicios. Pulsa «Editar» para añadirlos.</p>}
                  {list.map((x, i) => {
                    const inSuperset = x.superset || list[i - 1]?.superset;
                    if (!edit) {
                      return (
                        <div className={"routine-line" + (inSuperset ? " superset" : "")} key={x.id}>
                          <span className="n">{i + 1}</span>
                          <b>{x.name}</b>
                          <small>{x.prescription}</small>
                        </div>
                      );
                    }
                    const muscles = musclesFor(x.name);
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
                  {edit
                    ? <button className="add-ex" type="button" onClick={() => setEditing({ day: d })}>＋ Añadir ejercicio</button>
                    : list.length > 0 && <button className="routine-go" type="button" onClick={() => actions.startDay(d)}>Hacer {DAY_NAMES[d]} hoy</button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <ScheduleCard />
      <ShareRoutineCard />
      {editing && <ExerciseModal day={editing.day} exercise={editing.exercise} onClose={() => setEditing(null)} />}
    </section>
  );
}
