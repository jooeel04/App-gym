"use client";

import { useEffect, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import { MUSCLE_NAMES, musclesFor } from "@/domain/exercise-library";
import { parseRepRange, suggestNext } from "@/domain/progression";
import { WARMUP_SETS } from "@/domain/snapshot";
import type { Exercise, SetEntry } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { requestPermissions } from "@/lib/permissions";
import { BodyMap } from "./body-map";
import { InDock } from "./dock";
import { ExerciseDemo } from "./exercise-demo";
import { PlateCalculator } from "./plate-calculator";
import { BulbIcon, CheckIcon, ChevronIcon, DumbbellIcon, MinusIcon, PencilIcon, PlusIcon, RepeatIcon, TrendUpIcon } from "./icons";
import { range, suggestedWeight, supersetRole } from "./training-view";

// Un ejercicio desplegado en la lista de Hoy: el consejo de progresión y la tarjeta para
// anotar las series con botones grandes de + / − (también el calentamiento y las notas: es
// la única forma de anotar). Lo que no se usa en cada serie (músculos, foto de cómo se hace
// e indicaciones) está plegado en «Cómo se hace».
export function ExerciseLogger({ exercise: x, superset }: { exercise: Exercise; superset: ReturnType<typeof supersetRole> }) {
  const { model, stats, week, day, actions } = useWorkout();
  const [how, setHow] = useState(false);
  const muscles = musclesFor(x.name);
  const tip = suggestNext(x, stats.lastBefore(x, week));
  const done = model.isExerciseDone(week, day, x);
  // Con todas las series anotadas ya está hecho y la marca no se puede quitar a mano.
  const filled = done && !model.isExerciseChecked(week, day, x.id);

  return (
    <>
      {(muscles || x.note) && (
        <button type="button" className="how-toggle" aria-expanded={how} onClick={() => setHow(!how)}>
          Cómo se hace<ChevronIcon />
        </button>
      )}
      {how && muscles && (
        <div className="focus-muscles">
          <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="md" />
          <div>
            <small>Músculos que trabajas</small>
            <b>{muscles.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</b>
            {muscles.secondary.length > 0 && <span>También: {muscles.secondary.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")}</span>}
          </div>
          <ExerciseDemo name={x.name} />
        </div>
      )}
      {how && x.note && <p className="cue">{x.note}</p>}
      {tip && <div className={"tip " + tip.kind}>{tip.kind === "increase" ? <TrendUpIcon /> : <BulbIcon />}{tip.text}</div>}
      {superset === "first" && <p className="ss-note">Superserie: haz una serie de este y otra del siguiente sin descansar entre ambos.</p>}
      <SetLogger exercise={x} />
      {!filled && (
        <button type="button" className={"focus-check" + (done ? " done" : "")} onClick={() => actions.toggleExerciseChecked(week, day, x.id)}>
          {done ? "Quitar marca de hecho" : <><CheckIcon />Marcar como hecho sin anotar series</>}
        </button>
      )}
    </>
  );
}

const hasReps = (e: SetEntry) => !!String(e.reps ?? "").trim();
const describeEntry = (e: SetEntry) => (e.weight?.trim() ? e.weight.replace(".", ",") + " × " : "× ") + (e.reps ?? "");
const isWarmup = (s: number) => WARMUP_SETS.includes(s);
// "Calentamiento 1" o "Serie 3", para títulos y avisos.
const setName = (s: number) => (isWarmup(s) ? "Calentamiento " + (WARMUP_SETS.indexOf(s) + 1) : "Serie " + s);

// Segundos que se ofrece deshacer la última serie anotada.
const UNDO_MS = 6000;

// Fichas de las series (calentamiento, hechas, la actual y las que faltan) y la serie
// elegida para anotar. Tras anotar una, durante unos segundos se puede deshacer (por si
// se tocó sin querer o con otro número): vuelve a como estaba y, si empezó el descanso, lo
// para. La serie se vuelve a abrir con lo que se acababa de poner, para corregir solo lo que falle.
function SetLogger({ exercise: x }: { exercise: Exercise }) {
  const { model, stats, week, day, actions } = useWorkout();
  const last = stats.lastBefore(x, week);
  const sets = range(x.sets);
  const pending = sets.find((s) => !hasReps(model.getEntry(week, day, x.id, s))) ?? null;
  const [pick, setPick] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ set: number; prev: SetEntry; saved: SetEntry } | null>(null);
  const [draft, setDraft] = useState<{ set: number; entry: SetEntry } | null>(null);
  // Series de calentamiento visibles: las que ya tienen datos, o las añadidas ahora.
  const [warmups, setWarmups] = useState(() => WARMUP_SETS.filter((s) => {
    const e = model.getEntry(week, day, x.id, s);
    return e.weight || e.reps;
  }).length);
  const current = pick ?? pending;
  const canRepeat = !!last && sets.some((s) => {
    const e = model.getEntry(week, day, x.id, s);
    return !e.weight && !e.reps && last.sets.some((r) => r.set === s);
  });

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const revert = () => {
    if (!undo) return;
    const { set: s, prev, saved } = undo;
    actions.setEntry(week, day, x.id, s, "reps", prev.reps ?? "");
    actions.setEntry(week, day, x.id, s, "weight", prev.weight ?? "");
    actions.setEntry(week, day, x.id, s, "note", prev.note ?? "");
    if (!hasReps(prev)) actions.stopRest();
    setDraft({ set: s, entry: saved });
    setPick(s);
    setUndo(null);
  };

  const addWarmup = () => {
    setPick(WARMUP_SETS[warmups]);
    setWarmups(warmups + 1);
  };

  const chip = (s: number) => {
    const e = model.getEntry(week, day, x.id, s);
    const logged = hasReps(e);
    const label = isWarmup(s) ? "Calent. " + (WARMUP_SETS.indexOf(s) + 1) : "Serie " + s + (x.optionalLast && s === x.sets ? " (opc.)" : "");
    return (
      <button key={s} type="button" role="tab" aria-selected={s === current}
        className={"set-chip" + (isWarmup(s) ? " warmup" : "") + (logged ? " done" : "") + (s === current ? " current" : "")} onClick={() => setPick(s)}>
        <small>{label}</small>
        <b>{logged ? describeEntry(e) : s === current ? "ahora" : "—"}</b>
      </button>
    );
  };

  return (
    <>
      {canRepeat && last && (
        <button type="button" className="repeat-last" onClick={() => actions.repeatLast(week, day, x.id)}>
          <RepeatIcon />Igual que la última vez <small>({last.date ? formatShortDate(last.date) : "semana " + last.week})</small>
        </button>
      )}
      <div className="set-chips" role="tablist" aria-label="Series">
        {WARMUP_SETS.slice(0, warmups).map(chip)}
        {sets.map(chip)}
      </div>
      {warmups < WARMUP_SETS.length && (
        <button type="button" className="add-warmup" onClick={addWarmup}><PlusIcon />Añadir calentamiento</button>
      )}
      {current
        ? <SetStepper key={current + (draft?.set === current ? "-draft" : "")} exercise={x} set={current}
            old={isWarmup(current) ? undefined : last?.sets.find((r) => r.set === current)}
            draft={draft?.set === current ? draft.entry : undefined} picked={pick !== null}
            onSaved={(prev, saved) => { setPick(null); setDraft(null); setUndo({ set: current, prev, saved }); }} />
        : <p className="set-alldone"><CheckIcon /> Todas las series anotadas. Toca una para cambiarla.</p>}
      {undo && (
        <InDock>
          <p className="set-undo" role="status">
            <span>{setName(undo.set)} {isWarmup(undo.set) ? "anotado" : "anotada"}</span>
            <button type="button" onClick={revert}>Deshacer</button>
          </p>
        </InDock>
      )}
    </>
  );
}

// Para sumar o restar a un número escrito (vacío cuenta como 0, nunca baja de 0).
const bump = (v: string, d: number) => String(Math.max(0, Math.round(((Number(v) || 0) + d) * 100) / 100));

// Carga, repeticiones y nota de una serie con botones grandes. Una serie de trabajo
// empieza con lo propuesto (peso de la serie anterior o de la última vez; repeticiones de
// la última vez o el mínimo del rango; tras deshacer, lo que se acababa de poner); el
// calentamiento, vacío. Se guarda al pulsar "Serie hecha".
function SetStepper({ exercise: x, set: s, old, draft, picked, onSaved }: {
  exercise: Exercise; set: number; old?: SetResult; draft?: SetEntry; picked: boolean; onSaved: (prev: SetEntry, saved: SetEntry) => void;
}) {
  const { model, week, day, rest, actions } = useWorkout();
  const e = model.getEntry(week, day, x.id, s);
  const saved = hasReps(e);
  const warmup = isWarmup(s);
  const filled = (v?: string | null) => (v?.trim() ? v : null);
  const [kg, setKg] = useState(() => filled(draft?.weight) ?? filled(e.weight)
    ?? (warmup ? "" : suggestedWeight(range(s - 1).map((p) => model.getEntry(week, day, x.id, p).weight), old)));
  const [reps, setReps] = useState(() => filled(draft?.reps) ?? filled(e.reps)
    ?? (warmup ? "" : old?.reps != null ? String(old.reps) : String(parseRepRange(x.target)?.min ?? "")));
  const [note, setNote] = useState(() => draft?.note ?? e.note ?? "");
  const [noteOpen, setNoteOpen] = useState(!!(draft?.note ?? e.note));
  const [plates, setPlates] = useState(false);
  const title = setName(s);
  const name = x.name + ", " + title.toLowerCase();

  const save = () => {
    if (!reps.trim()) return;
    // Antes lo pedía el primer toque en un ejercicio; ahora se entra con él ya abierto.
    void requestPermissions();
    const prev = { weight: e.weight, reps: e.reps, note: e.note };
    if (kg.trim() !== (e.weight ?? "").trim()) actions.setEntry(week, day, x.id, s, "weight", kg.trim());
    if (note.trim() !== (e.note ?? "").trim()) actions.setEntry(week, day, x.id, s, "note", note.trim());
    actions.setEntry(week, day, x.id, s, "reps", reps.trim());
    // Un toque de vibración confirma que se ha guardado (Android; iPhone no vibra desde la web).
    if ("vibrate" in navigator) navigator.vibrate(12);
    onSaved(prev, { weight: kg.trim(), reps: reps.trim(), note: note.trim() });
  };

  return (
    <>
      <div className={"stepper-card" + (warmup ? " warmup" : "")}>
        <div className="stepper-title">{title}{saved && <span> · anotada</span>}</div>
        <div className="stepper">
          <span>Carga</span>
          <div className="stepper-ctl">
            <button type="button" aria-label="Quitar 2,5 kg" onClick={() => setKg(bump(kg, -2.5))}><MinusIcon /></button>
            <label className="stepper-val">
              <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="—" value={kg} aria-label={name + ", carga en kg"} onChange={(ev) => setKg(ev.target.value)} />
              <small>kg</small>
            </label>
            <button type="button" aria-label="Añadir 2,5 kg" onClick={() => setKg(bump(kg, 2.5))}><PlusIcon /></button>
          </div>
        </div>
        <div className="stepper">
          <span>Repeticiones</span>
          <div className="stepper-ctl">
            <button type="button" aria-label="Una repetición menos" onClick={() => setReps(bump(reps, -1))}><MinusIcon /></button>
            <label className="stepper-val">
              <input type="number" inputMode="numeric" min="0" step="1" placeholder="—" value={reps} aria-label={name + ", repeticiones"} onChange={(ev) => setReps(ev.target.value)} />
            </label>
            <button type="button" aria-label="Una repetición más" onClick={() => setReps(bump(reps, 1))}><PlusIcon /></button>
          </div>
        </div>
        {Number(kg) > 0 && (
          <button type="button" className="stepper-plates" aria-label={"Calcular discos para " + String(Number(kg)).replace(".", ",") + " kg"} onClick={() => setPlates(true)}>
            <DumbbellIcon /><span>Calcular discos</span><b>{String(Number(kg)).replace(".", ",")} kg</b>
          </button>
        )}
        {plates && <PlateCalculator initialTotal={kg} onClose={() => setPlates(false)} />}
        {old && <p className="stepper-prev">La última vez: {old.weight != null ? String(old.weight).replace(".", ",") + " kg × " : "× "}{old.reps ?? "—"}</p>}
        {noteOpen
          ? <input className="stepper-note" type="text" maxLength={160} placeholder="Cómo fue esta serie" aria-label={"Nota de la " + title.toLowerCase()}
              value={note} onChange={(ev) => setNote(ev.target.value)} />
          : <button type="button" className="stepper-note-btn" onClick={() => setNoteOpen(true)}><PencilIcon />Añadir nota</button>}
      </div>
      {/* Bajo el pulgar. Durante el descanso en ese sitio está la cuenta atrás, salvo que se
          haya elegido una serie a mano para corregirla. */}
      {(!rest || picked) && (
        <InDock>
          <button type="button" className="set-done" disabled={!reps.trim()} onClick={save}>
            <CheckIcon /><span>{saved ? "Guardar cambios" : "Serie hecha"}</span>
            {reps.trim() && <b className="set-done-what">{(Number(kg) > 0 ? String(Number(kg)).replace(".", ",") + " " : "") + "× " + reps.trim()}</b>}
          </button>
        </InDock>
      )}
    </>
  );
}
