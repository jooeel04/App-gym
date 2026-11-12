"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { WEEKDAY_NAMES } from "@/domain/calendar";
import { musclesFor } from "@/domain/exercise-library";
import { MAX_DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import { BodyMap } from "./body-map";
import { ExerciseModal } from "./exercise-modal";
import { ArrowIcon, ChevronIcon, PlusIcon } from "./icons";
import { ScheduleCard } from "./schedule-card";
import { DayNameModal } from "./day-name-modal";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Vista "Rutina": un día de rutina por fila, plegado, ordenados por su primer día de la
// semana (de título los días de la semana y debajo su nombre); al tocarlo se ven sus
// ejercicios y el botón para hacerlo hoy. Con "Editar" aparecen las acciones para añadir, editar, reordenar
// y eliminar ejercicios, y para añadir, renombrar y eliminar días (hasta 7).
export function RoutineView() {
  const { model, actions } = useWorkout();
  const [editing, setEditing] = useState<{ day: number; exercise?: Exercise } | null>(null);
  const [edit, setEdit] = useState(false);
  // Al entrar están todos cerrados: se abre el que se toque.
  const [open, setOpen] = useState<number | null>(null);
  // Los días sin día fijo van al final.
  const order = [...model.days].sort((a, b) => (model.weekdaysFor(a)[0] ?? 8) - (model.weekdaysFor(b)[0] ?? 8));
  // Ventana del nombre: día nuevo (`day` null) o cambiar el de uno.
  const [naming, setNaming] = useState<{ day: number | null } | null>(null);

  return (
    <section className="view active">
      <div className="pagehead">
        <h1>Rutina</h1>
        <button type="button" className={"tool-btn" + (edit ? " active" : "")} aria-pressed={edit} onClick={() => setEdit(!edit)}>
          {edit ? "Listo" : "Editar"}
        </button>
      </div>

      <div className="routine-list">
        {order.map((d) => {
          const list = model.exercisesOfDay(d);
          const isOpen = open === d;
          const weekdays = model.weekdaysFor(d);
          return (
            <article className={"routine-day" + (isOpen ? " open" : "")} key={d} style={{ "--dc": "var(--day" + d + ")" } as React.CSSProperties}>
              <button type="button" className="routine-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d)}>
                <i className="routine-bar" aria-hidden="true" />
                <span className="routine-title">
                  <b>{weekdays.length ? capitalize(weekdays.map((w) => WEEKDAY_NAMES[w]).join(" y ")) : "Sin día fijo"}</b>
                  <small>{model.dayName(d)} · {list.length} {list.length === 1 ? "ejercicio" : "ejercicios"}</small>
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
                            <button type="button" aria-label={"Subir " + x.name} disabled={i === 0} onClick={() => actions.moveExercise(x.id, -1)}><ArrowIcon dir="up" /></button>
                            <button type="button" aria-label={"Bajar " + x.name} disabled={i === list.length - 1} onClick={() => actions.moveExercise(x.id, 1)}><ArrowIcon dir="down" /></button>
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
                    ? <button className="add-ex" type="button" onClick={() => setEditing({ day: d })}><PlusIcon />Añadir ejercicio</button>
                    : list.length > 0 && <button className="routine-go" type="button" onClick={() => actions.startDay(d)}>Hacer {model.dayName(d)} hoy</button>}
                  {edit && (
                    <div className="day-actions">
                      <button type="button" className="edit-ex" onClick={() => setNaming({ day: d })}>Cambiar nombre</button>
                      {model.days.length > 1 && <button type="button" className="remove-ex" onClick={() => { void actions.deleteDay(d).then((gone) => { if (gone) setOpen(null); }); }}>Eliminar día</button>}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {edit && model.days.length < MAX_DAYS && (
          <button className="add-ex add-day" type="button" onClick={() => setNaming({ day: null })}><PlusIcon />Añadir día</button>
        )}
      </div>
      <ScheduleCard />
      {editing && <ExerciseModal day={editing.day} exercise={editing.exercise} onClose={() => setEditing(null)} />}
      {naming && (
        <DayNameModal isNew={naming.day === null} initial={naming.day === null ? "" : model.dayName(naming.day)} onClose={() => setNaming(null)}
          onSave={(name) => (naming.day === null ? actions.addDay(name) !== null : actions.renameDay(naming.day, name))} />
      )}
    </section>
  );
}
