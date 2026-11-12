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
  const { model, stats, week, day, round, actions } = useWorkout();
  const [how, setHow] = useState(false);
  const muscles = musclesFor(x.name);
  const tip = suggestNext(x, stats.lastBefore(x, week, round));
  const done = model.isExerciseDone(week, day, x, round);
  // Con todas las series anotadas ya está hecho y la marca no se puede quitar a mano.
  const filled = done && !model.isExerciseChecked(week, day, x.id, round);

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
        <button type="button" className={"focus-check" + (done ? " done" : "")} onClick={() => actions.toggleExerciseChecked(week, day, x.id, round)}>
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
// Número corto de la fila: "C1" (calentamiento) o "3".
const setLabel = (s: number) => (isWarmup(s) ? "C" + (WARMUP_SETS.indexOf(s) + 1) : String(s));
const kgText = (v?: string | number | null) => (v === undefined || v === null || String(v).trim() === "" ? "" : String(v).replace(".", ","));

// Segundos que se ofrece deshacer la última serie anotada.
const UNDO_MS = 6000;

// Tabla de series (como en Hevy o Strong): una fila por serie con su número, lo que se hizo
// la vez anterior, la carga, las repeticiones y ✓. La fila que toca se puede escribir
// (`SetEditor`); las demás se ven (`SetRow`) y su ✓ las guarda con lo propuesto. Tras anotar
// una, durante unos segundos se puede deshacer (por si se tocó sin querer o con otro
// número): vuelve a como estaba y, si empezó el descanso, lo para; la serie se vuelve a abrir
// con lo que se acababa de poner, para corregir solo lo que falle.
function SetLogger({ exercise: x }: { exercise: Exercise }) {
  const { model, stats, week, day, round, actions } = useWorkout();
  const last = stats.lastBefore(x, week, round);
  const sets = range(x.sets);
  const pending = sets.find((s) => !hasReps(model.getEntry(week, day, x.id, s, round))) ?? null;
  const [pick, setPick] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ set: number; prev: SetEntry; saved: SetEntry } | null>(null);
  const [draft, setDraft] = useState<{ set: number; entry: SetEntry } | null>(null);
  // Series de calentamiento visibles: las que ya tienen datos, o las añadidas ahora.
  const [warmups, setWarmups] = useState(() => WARMUP_SETS.filter((s) => {
    const e = model.getEntry(week, day, x.id, s, round);
    return e.weight || e.reps;
  }).length);
  const current = pick ?? pending;
  const canRepeat = !!last && sets.some((s) => {
    const e = model.getEntry(week, day, x.id, s, round);
    return !e.weight && !e.reps && last.sets.some((r) => r.set === s);
  });
  const oldOf = (s: number) => (isWarmup(s) ? undefined : last?.sets.find((r) => r.set === s));

  // Lo propuesto para una serie vacía: la carga de la serie anterior de hoy o la de esa serie
  // la última vez; las repeticiones de la última vez o el mínimo del rango. Calentamiento: vacío.
  const proposal = (s: number): SetEntry => {
    if (isWarmup(s)) return {};
    const old = oldOf(s);
    return {
      weight: suggestedWeight(range(s - 1).map((p) => model.getEntry(week, day, x.id, p, round).weight), old),
      reps: old?.reps != null ? String(old.reps) : String(parseRepRange(x.target)?.min ?? ""),
    };
  };

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  // Guarda una serie: carga, nota y por último las repeticiones (con ellas empieza el descanso).
  const save = (s: number, next: SetEntry) => {
    if (!next.reps?.trim()) return;
    // Antes lo pedía el primer toque en un ejercicio; ahora se entra con él ya abierto.
    void requestPermissions();
    const e = model.getEntry(week, day, x.id, s, round);
    const prev = { weight: e.weight, reps: e.reps, note: e.note };
    const saved = { weight: next.weight?.trim() ?? "", reps: next.reps.trim(), note: (next.note ?? e.note ?? "").trim() };
    if (saved.weight !== (e.weight ?? "").trim()) actions.setEntry(week, day, x.id, s, "weight", saved.weight, round);
    if (saved.note !== (e.note ?? "").trim()) actions.setEntry(week, day, x.id, s, "note", saved.note, round);
    actions.setEntry(week, day, x.id, s, "reps", saved.reps, round);
    // Un toque de vibración confirma que se ha guardado (Android; iPhone no vibra desde la web).
    if ("vibrate" in navigator) navigator.vibrate(12);
    setPick(null);
    setDraft(null);
    setUndo({ set: s, prev, saved });
  };

  const revert = () => {
    if (!undo) return;
    const { set: s, prev, saved } = undo;
    actions.setEntry(week, day, x.id, s, "reps", prev.reps ?? "", round);
    actions.setEntry(week, day, x.id, s, "weight", prev.weight ?? "", round);
    actions.setEntry(week, day, x.id, s, "note", prev.note ?? "", round);
    if (!hasReps(prev)) actions.stopRest();
    setDraft({ set: s, entry: saved });
    setPick(s);
    setUndo(null);
  };

  const addWarmup = () => {
    setPick(WARMUP_SETS[warmups]);
    setWarmups(warmups + 1);
  };

  const name = (s: number) => setName(s) + (x.optionalLast && s === x.sets ? " (opcional)" : "");
  const rows = [...WARMUP_SETS.slice(0, warmups), ...sets];

  return (
    <>
      {canRepeat && last && (
        <button type="button" className="repeat-last" onClick={() => actions.repeatLast(week, day, x.id, round)}>
          <RepeatIcon />Igual que la última vez <small>({last.date ? formatShortDate(last.date) : "semana " + last.week})</small>
        </button>
      )}
      <div className="series-table" role="group" aria-label={"Series de " + x.name}>
        <div className="series-head" aria-hidden="true"><span>Serie</span><span>Anterior</span><span>kg</span><span>Reps</span><span /></div>
        {rows.map((s) => (s === current
          ? <SetEditor key={s + (draft?.set === s ? "-draft" : "")} exercise={x} set={s} name={name(s)} old={oldOf(s)}
              start={draft?.set === s ? draft.entry : hasReps(model.getEntry(week, day, x.id, s, round)) ? {} : proposal(s)}
              picked={pick !== null} onSave={(next) => save(s, next)} />
          : <SetRow key={s} exercise={x} set={s} name={name(s)} old={oldOf(s)} proposal={proposal(s)}
              onPick={() => setPick(s)} onQuickSave={() => save(s, proposal(s))} />))}
      </div>
      {!current && <p className="set-alldone"><CheckIcon /> Todas las series anotadas. Toca un número para cambiar su serie.</p>}
      {warmups < WARMUP_SETS.length && (
        <button type="button" className="add-warmup" onClick={addWarmup}><PlusIcon />Añadir calentamiento</button>
      )}
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

// Lo que se hizo en esa serie la vez anterior, en corto ("65×9").
const prevText = (old?: SetResult) => (old ? (old.weight !== null ? kgText(old.weight) : "") + "×" + (old.reps ?? "—") : "—");

// Una fila de la tabla que no es la actual: hecha (verde, con sus números) o vacía (con lo
// propuesto en gris). Al tocar su número pasa a ser la actual; su ✓ la guarda tal cual viene.
function SetRow({ exercise: x, set: s, name, old, proposal, onPick, onQuickSave }: {
  exercise: Exercise; set: number; name: string; old?: SetResult; proposal: SetEntry; onPick: () => void; onQuickSave: () => void;
}) {
  const { model, week, day, round } = useWorkout();
  const e = model.getEntry(week, day, x.id, s, round);
  const done = hasReps(e);
  return (
    <div className={"series-row" + (isWarmup(s) ? " warmup" : "") + (done ? " done" : "")}>
      <button type="button" className="series-num" aria-label={name + ": " + (done ? describeEntry(e) : "vacía")} onClick={onPick}>{setLabel(s)}</button>
      <span className="series-prev">{prevText(old)}</span>
      <span className={"series-val" + (done ? "" : " ghost")}>{kgText(done ? e.weight : proposal.weight) || "—"}</span>
      <span className={"series-val" + (done ? "" : " ghost")}>{(done ? e.reps : proposal.reps) || "—"}</span>
      {done
        ? <span className="series-check on" role="img" aria-label={name + " hecha"}><CheckIcon /></span>
        : <button type="button" className="series-check" aria-label={"Guardar " + name.toLowerCase() + " con lo propuesto"} disabled={!proposal.reps} onClick={onQuickSave}><CheckIcon /></button>}
      {e.note && <p className="series-row-note"><PencilIcon />{e.note}</p>}
    </div>
  );
}

// Para sumar o restar a un número escrito (vacío cuenta como 0, nunca baja de 0).
const bump = (v: string, d: number) => String(Math.max(0, Math.round(((Number(v) || 0) + d) * 100) / 100));

// La fila que toca: carga y repeticiones para escribir (empiezan con lo propuesto o, tras
// deshacer, con lo que se acababa de poner; el calentamiento, vacío), y debajo −/+ de carga y
// repeticiones, «Discos» y «Nota». Se guarda con su ✓ o con «Serie hecha», abajo.
function SetEditor({ exercise: x, set: s, name, old, start, picked, onSave }: {
  exercise: Exercise; set: number; name: string; old?: SetResult; start: SetEntry; picked: boolean; onSave: (next: SetEntry) => void;
}) {
  const { model, week, day, round, rest } = useWorkout();
  const e = model.getEntry(week, day, x.id, s, round);
  const saved = hasReps(e);
  const filled = (v?: string | null) => (v?.trim() ? v : null);
  const [kg, setKg] = useState(() => filled(start.weight) ?? filled(e.weight) ?? "");
  const [reps, setReps] = useState(() => filled(start.reps) ?? filled(e.reps) ?? "");
  const [note, setNote] = useState(() => start.note ?? e.note ?? "");
  const [noteOpen, setNoteOpen] = useState(!!(start.note ?? e.note));
  const [plates, setPlates] = useState(false);
  const label = x.name + ", " + setName(s).toLowerCase();
  const save = () => onSave({ weight: kg, reps, note });
  const what = (Number(kg) > 0 ? String(Number(kg)).replace(".", ",") + " " : "") + "× " + reps.trim();

  return (
    <>
      <div className={"series-row current" + (isWarmup(s) ? " warmup" : "") + (saved ? " done" : "")}>
        <span className="series-num" role="img" aria-label={name + ": " + (saved ? describeEntry(e) : "ahora")}>{setLabel(s)}</span>
        <span className="series-prev">{prevText(old)}</span>
        <input className="series-input" type="number" inputMode="decimal" min="0" step="0.5" placeholder="—" value={kg} aria-label={label + ", carga en kg"} onChange={(ev) => setKg(ev.target.value)} />
        <input className="series-input" type="number" inputMode="numeric" min="0" step="1" placeholder="—" value={reps} aria-label={label + ", repeticiones"} onChange={(ev) => setReps(ev.target.value)} />
        <button type="button" className="series-check" aria-label={(saved ? "Guardar cambios de la " : "Guardar la ") + setName(s).toLowerCase()} disabled={!reps.trim()} onClick={save}><CheckIcon /></button>
      </div>
      <div className="series-tools">
        <span className="series-tool-pair">
          <button type="button" aria-label="Quitar 2,5 kg" onClick={() => setKg(bump(kg, -2.5))}><MinusIcon /></button>
          <small>kg</small>
          <button type="button" aria-label="Añadir 2,5 kg" onClick={() => setKg(bump(kg, 2.5))}><PlusIcon /></button>
        </span>
        <span className="series-tool-pair">
          <button type="button" aria-label="Una repetición menos" onClick={() => setReps(bump(reps, -1))}><MinusIcon /></button>
          <small>reps</small>
          <button type="button" aria-label="Una repetición más" onClick={() => setReps(bump(reps, 1))}><PlusIcon /></button>
        </span>
        {Number(kg) > 0 && (
          <button type="button" className="series-tool" aria-label={"Calcular discos para " + String(Number(kg)).replace(".", ",") + " kg"} onClick={() => setPlates(true)}>
            <DumbbellIcon />Discos
          </button>
        )}
        {!noteOpen && <button type="button" className="series-tool" onClick={() => setNoteOpen(true)}><PencilIcon />Añadir nota</button>}
      </div>
      {noteOpen && (
        <input className="series-note" type="text" maxLength={160} placeholder="Cómo fue esta serie" aria-label={"Nota de la " + setName(s).toLowerCase()}
          value={note} onChange={(ev) => setNote(ev.target.value)} />
      )}
      {plates && <PlateCalculator initialTotal={kg} onClose={() => setPlates(false)} />}
      {/* Bajo el pulgar. Durante el descanso en ese sitio está la cuenta atrás, salvo que se
          haya elegido una serie a mano para corregirla. */}
      {(!rest || picked) && (
        <InDock>
          <button type="button" className="set-done" disabled={!reps.trim()} onClick={save}>
            <CheckIcon /><span>{saved ? "Guardar cambios" : "Serie hecha"}</span>
            {reps.trim() && <b className="set-done-what">{what}</b>}
          </button>
        </InDock>
      )}
    </>
  );
}
