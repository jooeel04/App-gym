"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { MUSCLE_NAMES, musclesFor } from "@/domain/exercise-library";
import { parseRepRange, suggestNext } from "@/domain/progression";
import type { Exercise, SetEntry } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { BodyMap } from "./body-map";
import { BulbIcon, CheckIcon, TrendUpIcon } from "./icons";
import { ExerciseDetail, range, suggestedWeight, supersetRole } from "./training-view";

// Un ejercicio desplegado en la lista de Hoy: músculos que trabaja (dibujo), consejo y
// las series con botones grandes de + / −. "Más opciones" abre la lista completa
// (calentamiento, notas…).
export function ExerciseLogger({ exercise: x, superset }: { exercise: Exercise; superset: ReturnType<typeof supersetRole> }) {
  const { model, stats, week, day, actions } = useWorkout();
  const [more, setMore] = useState(false);
  const muscles = musclesFor(x.name);
  const tip = suggestNext(x, stats.lastBefore(x, week));
  const done = model.isExerciseDone(week, day, x);
  // Con todas las series anotadas ya está hecho y la marca no se puede quitar a mano.
  const filled = done && !model.isExerciseChecked(week, day, x.id);

  return (
    <>
      {muscles && (
        <div className="focus-muscles">
          <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="md" />
          <div>
            <small>Músculos que trabajas</small>
            <b>{muscles.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</b>
            {muscles.secondary.length > 0 && <span>También: {muscles.secondary.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")}</span>}
          </div>
        </div>
      )}
      {tip && <div className={"tip " + tip.kind}>{tip.kind === "increase" ? <TrendUpIcon /> : <BulbIcon />}{tip.text}</div>}
      {superset === "first" && <p className="ss-note">Superserie: haz una serie de este y otra del siguiente sin descansar entre ambos.</p>}
      {x.note && <p className="cue">{x.note}</p>}
      {more ? <ExerciseDetail exercise={x} superset={superset} bare /> : <SetLogger exercise={x} />}
      <button type="button" className="focus-more" onClick={() => setMore(!more)}>
        {more ? "‹ Volver a los botones + / −" : "Más opciones: calentamiento, notas y todas las series"}
      </button>
      {!filled && (
        <button type="button" className={"focus-check" + (done ? " done" : "")} onClick={() => actions.toggleExerciseChecked(week, day, x.id)}>
          {done ? "Quitar marca de hecho" : "✓ Marcar como hecho sin anotar series"}
        </button>
      )}
    </>
  );
}

const hasReps = (e: SetEntry) => !!String(e.reps ?? "").trim();
const describeEntry = (e: SetEntry) => (e.weight?.trim() ? e.weight.replace(".", ",") + " × " : "× ") + (e.reps ?? "");

// Fichas de las series (hechas, la actual y las que faltan) y la serie elegida para anotar.
function SetLogger({ exercise: x }: { exercise: Exercise }) {
  const { model, stats, week, day } = useWorkout();
  const last = stats.lastBefore(x, week);
  const sets = range(x.sets);
  const pending = sets.find((s) => !hasReps(model.getEntry(week, day, x.id, s))) ?? null;
  const [pick, setPick] = useState<number | null>(null);
  const current = pick ?? pending;

  return (
    <>
      <div className="set-chips" role="tablist" aria-label="Series">
        {sets.map((s) => {
          const e = model.getEntry(week, day, x.id, s);
          const logged = hasReps(e);
          return (
            <button key={s} type="button" role="tab" aria-selected={s === current}
              className={"set-chip" + (logged ? " done" : "") + (s === current ? " current" : "")} onClick={() => setPick(s)}>
              <small>Serie {s}{x.optionalLast && s === x.sets ? " (opc.)" : ""}</small>
              <b>{logged ? describeEntry(e) : s === current ? "ahora" : "—"}</b>
            </button>
          );
        })}
      </div>
      {current
        ? <SetStepper key={current} exercise={x} set={current} old={last?.sets.find((r) => r.set === current)} onSaved={() => setPick(null)} />
        : <p className="set-alldone"><CheckIcon /> Todas las series anotadas. Toca una para cambiarla.</p>}
    </>
  );
}

// Para sumar o restar a un número escrito (vacío cuenta como 0, nunca baja de 0).
const bump = (v: string, d: number) => String(Math.max(0, Math.round(((Number(v) || 0) + d) * 100) / 100));

// Carga y repeticiones de una serie con botones grandes. Empieza con lo propuesto (peso
// de la serie anterior o de la última vez; repeticiones de la última vez o el mínimo
// del rango) y se guarda al pulsar "Serie hecha".
function SetStepper({ exercise: x, set: s, old, onSaved }: { exercise: Exercise; set: number; old?: SetResult; onSaved: () => void }) {
  const { model, week, day, actions } = useWorkout();
  const e = model.getEntry(week, day, x.id, s);
  const saved = hasReps(e);
  const [kg, setKg] = useState(() => e.weight ?? suggestedWeight(range(s - 1).map((p) => model.getEntry(week, day, x.id, p).weight), old));
  const [reps, setReps] = useState(() => e.reps ?? (old?.reps != null ? String(old.reps) : String(parseRepRange(x.target)?.min ?? "")));
  const name = x.name + ", serie " + s;

  const save = () => {
    if (!reps.trim()) return;
    if (kg.trim() !== (e.weight ?? "").trim()) actions.setEntry(week, day, x.id, s, "weight", kg.trim());
    actions.setEntry(week, day, x.id, s, "reps", reps.trim());
    onSaved();
  };

  return (
    <>
      <div className="stepper-card">
        <div className="stepper-title">Serie {s}{saved && <span> · anotada</span>}</div>
        <div className="stepper">
          <span>Carga</span>
          <div className="stepper-ctl">
            <button type="button" aria-label="Quitar 2,5 kg" onClick={() => setKg(bump(kg, -2.5))}>−</button>
            <label className="stepper-val">
              <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="—" value={kg} aria-label={name + ", carga en kg"} onChange={(ev) => setKg(ev.target.value)} />
              <small>kg</small>
            </label>
            <button type="button" aria-label="Añadir 2,5 kg" onClick={() => setKg(bump(kg, 2.5))}>+</button>
          </div>
        </div>
        <div className="stepper">
          <span>Repeticiones</span>
          <div className="stepper-ctl">
            <button type="button" aria-label="Una repetición menos" onClick={() => setReps(bump(reps, -1))}>−</button>
            <label className="stepper-val">
              <input type="number" inputMode="numeric" min="0" step="1" placeholder="—" value={reps} aria-label={name + ", repeticiones"} onChange={(ev) => setReps(ev.target.value)} />
            </label>
            <button type="button" aria-label="Una repetición más" onClick={() => setReps(bump(reps, 1))}>+</button>
          </div>
        </div>
        {old && <p className="stepper-prev">La última vez: {old.weight != null ? String(old.weight).replace(".", ",") + " kg × " : "× "}{old.reps ?? "—"}</p>}
      </div>
      <button type="button" className="set-done" disabled={!reps.trim()} onClick={save}>
        <CheckIcon />{saved ? "Guardar cambios" : "Serie hecha"}
      </button>
    </>
  );
}
