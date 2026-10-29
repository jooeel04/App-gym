"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/controllers/workout-controller";
import { MUSCLE_NAMES, musclesFor, searchLibrary, type LibraryExercise } from "@/domain/exercise-library";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import { BodyMap } from "./body-map";
import { ExerciseDemo } from "./exercise-demo";
import { closeOnBackdrop } from "./backdrop";

interface Draft {
  name: string;
  sets: number;
  target: string;
  note: string;
  superset: boolean;
}

const EMPTY: Draft = { name: "", sets: 3, target: "", note: "", superset: false };

// Añadir un ejercicio a un día de la rutina (buscándolo en la biblioteca, con el
// mapa de músculos que trabaja, o escribiéndolo a mano) o editar uno existente.
export function ExerciseModal({ day, exercise, onClose }: { day: number; exercise?: Exercise; onClose: () => void }) {
  const { actions } = useWorkout();
  const editing = !!exercise;
  const [tab, setTab] = useState<"library" | "custom">(editing ? "custom" : "library");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<number | null>(day);
  const [draft, setDraft] = useState<Draft>(exercise
    ? { name: exercise.name, sets: exercise.sets, target: exercise.target === "Sin rango" ? "" : exercise.target, note: exercise.note, superset: !!exercise.superset }
    : EMPTY);
  // Al escribir se busca en todos los días; los botones de día filtran la lista sin búsqueda.
  const searching = query.trim().length > 0;
  const results = searchLibrary(query, searching ? null : filter);
  const muscles = musclesFor(draft.name);
  // Al cambiar de día o de búsqueda, la lista vuelve arriba (si no, al haber bajado
  // parecía que no cambiaba: muchos ejercicios están en varios días).
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo(0, 0); }, [filter, query]);

  const pick = (x: LibraryExercise) => {
    setDraft({ ...draft, name: x.name, sets: x.sets, target: x.target, note: x.note });
    setTab("custom");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = { ...draft, sets: Number(draft.sets) };
    if (exercise ? actions.updateExercise(exercise.id, data) : actions.addExercise(day, data)) onClose();
  };

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="exerciseModalTitle" {...closeOnBackdrop(onClose)}>
      <div className={"modal exmodal" + (tab === "library" ? " library" : "")}>
        <div className="exmodal-head">
          <h2 id="exerciseModalTitle">{editing ? "Editar ejercicio" : "Añadir ejercicio"}</h2>
          <span>{DAY_NAMES[day]}</span>
        </div>
        <div className="segmented exmodal-tabs" role="tablist" hidden={editing}>
          <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>Biblioteca</button>
          <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>{draft.name ? "Ajustar" : "A mano"}</button>
        </div>

        {tab === "library" ? (
          <>
            <input className="exsearch" type="search" placeholder="Buscar por nombre o músculo (p. ej. «remo», «glúteo»)" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Buscar ejercicio" />
            <div className="daychips">
              {DAYS.map((d) => (
                <button key={d} type="button" className={"daychip" + (!searching && filter === d ? " active" : "")} onClick={() => { setFilter(d); setQuery(""); }}>
                  <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
                </button>
              ))}
              <button type="button" className={"daychip" + (searching || filter === null ? " active" : "")} onClick={() => { setFilter(null); setQuery(""); }}>Todos</button>
            </div>
            <div className="liblist" ref={listRef}>
              {results.length === 0 && <div className="empty">No hay ejercicios con esa búsqueda. Puedes añadirlo «A mano».</div>}
              {results.map((x) => (
                <div key={x.name} className="libitem">
                  <BodyMap primary={x.primary} secondary={x.secondary} size="sm" />
                  <button type="button" className="libpick" onClick={() => pick(x)}>
                    <span className="libtext">
                      <strong>{x.name}</strong>
                      <small>{x.primary.map((m) => MUSCLE_NAMES[m]).join(" · ")}</small>
                      <em>{x.sets} × {x.target}</em>
                    </span>
                    <span className="libadd" aria-hidden="true">＋</span>
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            {muscles && (
              <div className="expreview">
                <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="lg" labels />
                <p>
                  <b>{muscles.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</b>
                  {muscles.secondary.length > 0 && <> · también {muscles.secondary.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")}</>}
                </p>
                <ExerciseDemo name={draft.name} />
              </div>
            )}
            <label className="form-label">Nombre del ejercicio
              <input name="name" maxLength={80} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <div className="form-cols">
              <label className="form-label">Series
                <input name="sets" type="number" min={1} max={10} required value={draft.sets} onChange={(e) => setDraft({ ...draft, sets: Number(e.target.value) })} />
              </label>
              <label className="form-label">Repeticiones objetivo
                <input name="target" maxLength={30} placeholder="8–12" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
              </label>
            </div>
            <label className="form-label">Detalle técnico (opcional)
              <textarea name="note" maxLength={240} placeholder="Indicaciones para este ejercicio" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <label className="check-label">
              <input type="checkbox" checked={draft.superset} onChange={(e) => setDraft({ ...draft, superset: e.target.checked })} />
              <span><b>Superserie con el siguiente ejercicio</b><small>Se hacen seguidos, sin descanso entre ellos.</small></span>
            </label>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancelar</button>
              <button className="primary" type="submit">{editing ? "Guardar cambios" : "Añadir ejercicio"}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
