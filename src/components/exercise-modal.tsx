"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { MUSCLE_NAMES, musclesFor, searchLibrary, type LibraryExercise } from "@/domain/exercise-library";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import { BodyMap } from "./body-map";

interface Draft {
  name: string;
  sets: number;
  target: string;
  note: string;
}

const EMPTY: Draft = { name: "", sets: 3, target: "", note: "" };

// Añadir un ejercicio a un día de la rutina: buscándolo en la biblioteca (con el
// mapa de músculos que trabaja) o escribiéndolo a mano.
export function ExerciseModal({ day, onClose }: { day: number; onClose: () => void }) {
  const { actions } = useWorkout();
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<number | null>(day);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const results = searchLibrary(query, filter);
  const muscles = musclesFor(draft.name);

  const pick = (x: LibraryExercise) => {
    setDraft({ name: x.name, sets: x.sets, target: x.target, note: x.note });
    setTab("custom");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (actions.addExercise(day, { ...draft, sets: Number(draft.sets) })) onClose();
  };

  return (
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="exerciseModalTitle" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal exmodal">
        <div className="exmodal-head">
          <h2 id="exerciseModalTitle">Añadir ejercicio</h2>
          <span>Día {day} · {DAY_NAMES[day]}</span>
        </div>
        <div className="segmented exmodal-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>Biblioteca</button>
          <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>{draft.name ? "Ajustar" : "A mano"}</button>
        </div>

        {tab === "library" ? (
          <>
            <input className="exsearch" type="search" placeholder="Buscar por nombre o músculo (p. ej. «remo», «glúteo»)" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Buscar ejercicio" autoFocus />
            <div className="daychips">
              {DAYS.map((d) => (
                <button key={d} type="button" className={"daychip" + (filter === d ? " active" : "")} onClick={() => setFilter(d)}>
                  <i className="swatch" style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}
                </button>
              ))}
              <button type="button" className={"daychip" + (filter === null ? " active" : "")} onClick={() => setFilter(null)}>Todos</button>
            </div>
            <div className="liblist">
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
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancelar</button>
              <button className="primary" type="submit">Añadir ejercicio</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
