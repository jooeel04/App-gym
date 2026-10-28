"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { MUSCLE_NAMES, musclesFor } from "@/domain/exercise-library";
import { parseRepRange, suggestNext } from "@/domain/progression";
import { DAY_NAMES } from "@/domain/snapshot";
import type { Exercise, SetEntry } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { clock } from "./active-workout-bar";
import { BodyMap } from "./body-map";
import { BulbIcon, CheckIcon, DumbbellIcon, TrendUpIcon } from "./icons";
import { PlateCalculator } from "./plate-calculator";
import { ExerciseDetail, range, suggestedWeight, supersetRole, useNextExercise } from "./training-view";

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
  const [plates, setPlates] = useState(false);
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
  // Lo que viene después: el siguiente ejercicio sin hacer tras este (o el primero que quede).
  const after = list.find((e, i) => i > index && !model.isExerciseDone(week, day, e))
    ?? list.find((e, i) => i !== index && !model.isExerciseDone(week, day, e));

  return (
    <div className="focus-mode" ref={ref} role="dialog" aria-modal="true" aria-label={"Entreno en curso: " + x.name}>
      <header className="focus-head">
        <button type="button" className="focus-min" onClick={actions.closeFocus} aria-label="Minimizar y ver la lista">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="focus-time">
          <small><span className="live-dot" aria-hidden="true" />{DAY_NAMES[day]}</small>
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
        <div className="focus-sub">
          <p className="focus-pres">{x.prescription}</p>
          <button type="button" className="tool-btn" onClick={() => setPlates(true)}><DumbbellIcon /> Discos</button>
        </div>
        <FocusExercise exercise={x} superset={superset} />
        {!filled && (
          <button type="button" className={"focus-check" + (done ? " done" : "")} onClick={() => actions.toggleExerciseChecked(week, day, x.id)}>
            {done ? "Quitar marca de hecho" : "✓ Marcar como hecho sin anotar series"}
          </button>
        )}
        <p className="focus-after">
          {after ? <>Después: <b>{after.name}</b></> : done ? "¡Era el último! Pulsa Terminar para ver el resumen." : "Es el último ejercicio que te queda."}
        </p>
      </div>

      <footer className="focus-nav">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>‹ Anterior</button>
        <span>{doneCount}/{list.length}</span>
        <button type="button" className="primary" onClick={() => go(index + 1)} disabled={index === list.length - 1}>Siguiente ›</button>
      </footer>
      {plates && <PlateCalculator onClose={() => setPlates(false)} />}
    </div>
  );
}

// Un ejercicio en el modo foco: músculos que trabaja (dibujo), consejo y las series con
// botones grandes de + / −. "Más opciones" abre la lista completa (calentamiento, notas…).
function FocusExercise({ exercise: x, superset }: { exercise: Exercise; superset: ReturnType<typeof supersetRole> }) {
  const { stats, week } = useWorkout();
  const [more, setMore] = useState(false);
  const muscles = musclesFor(x.name);
  const tip = suggestNext(x, stats.lastBefore(x, week));

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
      {more ? <ExerciseDetail exercise={x} superset={superset} bare /> : <SetLogger exercise={x} />}
      <button type="button" className="focus-more" onClick={() => setMore(!more)}>
        {more ? "‹ Volver a los botones + / −" : "Más opciones: calentamiento, notas y todas las series"}
      </button>
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
