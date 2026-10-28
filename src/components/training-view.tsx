"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatLongDate, formatShortDate, WEEKDAY_NAMES, weekdayOf } from "@/domain/calendar";
import { MUSCLE_NAMES, musclesFor } from "@/domain/exercise-library";
import { suggestNext } from "@/domain/progression";
import { DAY_NAMES, DAYS, WARMUP_SETS } from "@/domain/snapshot";
import type { Exercise, SetField } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { BodyMap } from "./body-map";
import { describeSet } from "./exercise-progress";
import { BulbIcon, ChevronIcon, DumbbellIcon, FlameIcon, SleepIcon, TrendUpIcon, WarningIcon } from "./icons";
import { PlateCalculator } from "./plate-calculator";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Vista "Hoy": qué toca hoy en grande con el botón para empezar, lo que quedó pendiente
// y lo que vas a hacer (solo para mirar). Las series se apuntan en la pantalla completa
// del entreno; "Corregir series" abre la lista editable para cambiar algo después.
export function TrainingView() {
  const { model, stats, calendar, diary, today, week, day, picked, active, actions } = useWorkout();
  const [plates, setPlates] = useState(false);
  const [otherDay, setOtherDay] = useState(false);
  const [editList, setEditList] = useState(false);
  const done = model.isDayCompleted(week, day);
  const planned = calendar.plannedDate(week, day);
  const list = model.exercisesOfDay(day);
  // Entreno en curso en este día: en la lista editable se abre el siguiente ejercicio.
  const live = !!active && active.week === week && active.day === day;
  const { next, editingHandlers } = useNextExercise(live && editList);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (next < 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.querySelector(".exercise.next")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [next]);
  if (!today) return null;

  const resting = !picked && calendar.sessionsOn(today).length === 0;
  const missed = calendar.missedSessions(today).filter((s) => !(s.week === week && s.day === day));
  const lastDate = diary.days().find((d) => d.date < today && d.sessions.some((s) => s.day === day))?.date;
  const totalSets = list.reduce((n, x) => n + x.sets, 0);
  const label = live ? "Entreno en curso" : done ? "¡Hecho!" : planned && planned < today ? "Para hacer hoy · era el " + formatShortDate(planned)
    : picked && planned !== today ? "Vas a hacer" : "Hoy toca";

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{formatLongDate(today)}</div>
          <h1>Hoy</h1>
        </div>
        <button type="button" className="tool-btn" onClick={() => setPlates(true)}><DumbbellIcon /> Discos</button>
      </div>

      {resting ? <RestCard /> : (
        <section className="hero" style={{ "--hero": "var(--day" + day + ")" } as React.CSSProperties}>
          <small>{label}</small>
          <h2><i aria-hidden="true" />{DAY_NAMES[day]}</h2>
          <p>{list.length} {list.length === 1 ? "ejercicio" : "ejercicios"} · {totalSets} series</p>
          <p>{lastDate ? "La última vez: " + formatLongDate(lastDate).toLowerCase() : "Primera vez que lo haces"}</p>
          {live ? (
            <button type="button" className="start-workout" onClick={actions.openWorkout}><span aria-hidden="true">▶</span> Continuar entreno</button>
          ) : !done && list.length > 0 ? (
            <button type="button" className="start-workout" onClick={() => actions.startWorkout(week, day)}><span aria-hidden="true">▶</span> Empezar entreno</button>
          ) : list.length === 0 ? (
            <p className="hero-note">No tiene ejercicios: añádelos en Rutina.</p>
          ) : null}
        </section>
      )}
      {picked && <button type="button" className="other-day" onClick={actions.goToToday}>‹ Volver a hoy</button>}

      {missed.map((s) => (
        <div className="pending-card" key={s.week + "|" + s.day}>
          <div><b><WarningIcon /> Te quedó pendiente: {DAY_NAMES[s.day]}</b><span>Era el {formatLongDate(s.date).toLowerCase()}</span></div>
          <button type="button" onClick={() => actions.recoverSession(s)}>Hacer hoy</button>
        </div>
      ))}

      {!resting && list.length > 0 && !editList && (
        <section className="chart peek">
          <h3>{done ? "Lo que hiciste" : "Lo que vas a hacer"}</h3>
          {list.map((x, i) => {
            const now = stats.session(x, week), before = stats.lastBefore(x, week);
            const ref = now ?? before;
            const best = ref?.sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
            const hecho = model.isExerciseDone(week, day, x);
            return (
              <div className={"peek-row" + (hecho ? " done" : "")} key={x.id}>
                <span className="n">{hecho ? "✓" : i + 1}</span>
                <div><b>{x.name}</b><small>{x.prescription}</small></div>
                <em>{best ? describeSet(best) : "—"}</em>
              </div>
            );
          })}
        </section>
      )}

      <div className="hoy-links">
        <button type="button" className="other-day" onClick={() => setOtherDay(!otherDay)}>Hacer otro día {otherDay ? "⌃" : "›"}</button>
        {!resting && list.length > 0 && (
          <button type="button" className="other-day" onClick={() => setEditList(!editList)}>{editList ? "✓ Listo" : "✎ Corregir series"}</button>
        )}
      </div>
      {otherDay && (
        <div className="days">
          {DAYS.map((d) => (
            <button key={d} className={"day" + (d === day && !resting ? " active" : "")} onClick={() => { actions.selectDay(d); setOtherDay(false); }}>
              <i className="swatch" style={{ background: "var(--day" + d + ")" }} /><b>{DAY_NAMES[d]}</b>{stats.day(week, d).n > 0 && <i className="dot" />}
            </button>
          ))}
        </div>
      )}

      {editList && !resting && (
        <div className="list" key={day} ref={listRef} {...editingHandlers}>
          {list.map((x, i) => (
            <ExerciseCard key={x.id + "-" + week + "-" + day} exercise={x} index={i} open={live ? i === next : i === 0} next={live && i === next}
              superset={supersetRole(list, i)} />
          ))}
        </div>
      )}
      {plates && <PlateCalculator onClose={() => setPlates(false)} />}
    </section>
  );
}

// Día de descanso: cuántos días llevas esta semana y qué toca la próxima vez.
function RestCard() {
  const { calendar, today } = useWorkout();
  if (!today) return null;
  const { weekDone, weekTotal } = calendar.streak(today);
  let nextUp: { date: string; day: number } | null = null;
  for (let i = 1; i <= 14 && !nextUp; i++) {
    const s = calendar.sessionsOn(addDays(today, i))[0];
    if (s) nextUp = { date: s.date, day: s.day };
  }
  const when = nextUp && (nextUp.date === addDays(today, 1) ? "Mañana" : "El " + WEEKDAY_NAMES[weekdayOf(nextUp.date)]);
  return (
    <section className="chart rest-card">
      <div className="rest-emoji" aria-hidden="true"><SleepIcon /></div>
      <h2>Hoy descansas</h2>
      {weekTotal > 0 && <p>Llevas {weekDone} de {weekTotal} días esta semana{weekDone > 0 && <> <FlameIcon className="flame" /></>}</p>}
      {nextUp && (
        <div className="rest-next"><i style={{ background: "var(--day" + nextUp.day + ")" }} /><div><b>{when}: {DAY_NAMES[nextUp.day]}</b><span>{formatShortDate(nextUp.date)}</span></div></div>
      )}
    </section>
  );
}

type SupersetRole = "first" | "second" | null;

// Papel del ejercicio `i` en una superserie: el primero va enlazado con el siguiente.
export const supersetRole = (list: Exercise[], i: number): SupersetRole =>
  list[i].superset && i < list.length - 1 ? "first" : list[i - 1]?.superset ? "second" : null;

// Siguiente ejercicio por hacer del día en pantalla (-1 si no hay o `live` es false).
// Mientras se escribe en un ejercicio no se salta al siguiente (al poner el peso de la
// última serie ya cuenta como anotada, pero faltan las repeticiones): se avanza al
// cerrar el teclado o tocar fuera. `editingHandlers` va en el contenedor de las series.
export function useNextExercise(live: boolean) {
  const { model, week, day } = useWorkout();
  const pending = live ? model.exercisesOfDay(day).findIndex((x) => !model.isExerciseDone(week, day, x)) : -1;
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState(pending);
  if (!editing && next !== pending) setNext(pending);
  const editingHandlers = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => setEditing(e.target instanceof HTMLInputElement),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      if (!(e.relatedTarget instanceof HTMLInputElement && e.currentTarget.contains(e.relatedTarget))) setEditing(false);
    },
  };
  return { next, editingHandlers };
}

// Peso que se propone para una serie de trabajo vacía: el de la serie anterior de hoy
// o, si no hay, el de esa serie la última vez.
function suggestedWeight(prevWeights: (string | undefined)[], old?: SetResult) {
  const today = [...prevWeights].reverse().find((w) => !!w?.trim());
  if (today) return today;
  return old?.weight != null ? String(old.weight) : "";
}

// Fila de una serie: carga, repeticiones, nota y lo que se hizo la última vez. En gris
// se ve lo propuesto (peso de la serie anterior o de la última vez); si solo se
// escriben las repeticiones, ese peso se guarda también.
function SetRow({ exercise: x, set: s, label, old, oldWhen }: { exercise: Exercise; set: number; label: string; old?: SetResult; oldWhen?: string }) {
  const { model, week, day, actions } = useWorkout();
  const e = model.getEntry(week, day, x.id, s);
  const warmup = s > x.sets;
  const aria = x.name + (warmup ? ", calentamiento " : ", serie ") + label;
  const prevWeights = warmup ? [] : range(s - 1).map((p) => model.getEntry(week, day, x.id, p).weight);
  const weightTip = warmup || e.weight ? "" : suggestedWeight(prevWeights, old);
  const repsTip = warmup || e.reps || old?.reps == null ? "" : String(old.reps);
  const set = (field: SetField) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (field === "reps" && weightTip && ev.target.value.trim()) actions.setEntry(week, day, x.id, s, "weight", weightTip);
    actions.setEntry(week, day, x.id, s, field, ev.target.value);
  };
  return (
    <div className={"setrow" + (warmup ? " warmup" : "")}>
      <div className="setnum">{label}{x.optionalLast && s === x.sets && <span className="optional">Opcional</span>}</div>
      <label className="field"><input type="number" min="0" step="0.5" inputMode="decimal" placeholder={weightTip ? weightTip.replace(".", ",") + " kg" : "— kg"} className={weightTip ? "suggested" : undefined} aria-label={aria + ", carga" + (weightTip ? " (propuesto " + weightTip + " kg)" : "")} value={e.weight ?? ""} onChange={set("weight")} /></label>
      <label className="field"><input type="number" min="0" step="1" inputMode="numeric" placeholder={repsTip || "—"} className={repsTip ? "suggested" : undefined} aria-label={aria + ", repeticiones"} value={e.reps ?? ""} onChange={set("reps")} /></label>
      <details className="setnote">
        <summary>{e.note ? "Ver nota" : "＋ Nota"}</summary>
        <input type="text" maxLength={160} placeholder="Anotación de esta serie" aria-label={"Nota " + aria} value={e.note ?? ""} onChange={set("note")} />
      </details>
      {old && <div className="prev">La última vez ({oldWhen}): {describeSet(old)}{old.reps !== null && " reps"}</div>}
    </div>
  );
}

function ExerciseCard({ exercise: x, index, open, next, superset }: { exercise: Exercise; index: number; open: boolean; next: boolean; superset: SupersetRole }) {
  const { model, week, day, actions } = useWorkout();
  const n = model.loggedSets(week, day, x), done = model.isExerciseDone(week, day, x);
  // Con todas las series anotadas el tick ya está puesto y no se puede quitar a mano.
  const filled = done && !model.isExerciseChecked(week, day, x.id);

  return (
    <details className={"exercise" + (superset ? " superset " + superset : "") + (next ? " next" : "")} open={open}>
      <summary>
        <span className="idx">{String(index + 1).padStart(2, "0")}</span>
        <span className="exmain">
          <span className="exname">{x.name}</span>
          <span className="pres">{x.prescription}{superset && <span className="ss-tag">Superserie</span>}{next && <span className="next-tag">Ahora</span>}</span>
        </span>
        <span className="exprogress">{n}/{x.sets}</span>
        <button
          type="button"
          className={"excheck" + (done ? " done" : "")}
          role="checkbox"
          aria-checked={done}
          aria-disabled={filled}
          aria-label={x.name + (done ? ", hecho" : ", marcar como hecho")}
          title={filled ? "Hecho: todas las series anotadas" : done ? "Quitar marca" : "Marcar como hecho"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!filled) actions.toggleExerciseChecked(week, day, x.id); }}
        >
          {done && "✓"}
        </button>
        <ChevronIcon />
      </summary>
      <div className="exbody"><ExerciseDetail exercise={x} superset={superset} /></div>
    </details>
  );
}

// Contenido de un ejercicio: músculos, consejo, indicaciones y series. Se usa en la
// tarjeta de la lista y en la pantalla completa del entreno en curso.
export function ExerciseDetail({ exercise: x, superset }: { exercise: Exercise; superset: SupersetRole }) {
  const { model, stats, week, day, actions } = useWorkout();
  const last = stats.lastBefore(x, week);
  const lastWhen = last ? (last.date ? formatShortDate(last.date) : "semana " + last.week) : "";
  const tip = suggestNext(x, last);
  const muscles = musclesFor(x.name);
  // Series de calentamiento visibles: las que ya tienen datos, o las añadidas ahora.
  const [warmups, setWarmups] = useState(() => WARMUP_SETS.filter((s) => {
    const e = model.getEntry(week, day, x.id, s);
    return e.weight || e.reps;
  }).length);

  return (
    <>
      {muscles && (
        <div className="exmuscles">
          <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="sm" />
          <span><b>{muscles.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</b>{muscles.secondary.length > 0 && <small>También: {muscles.secondary.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")}</small>}</span>
        </div>
      )}
      {tip && <div className={"tip " + tip.kind}>{tip.kind === "increase" ? <TrendUpIcon /> : <BulbIcon />}{tip.text}</div>}
      {superset === "first" && <p className="ss-note">Superserie: haz una serie de este y otra del siguiente sin descansar entre ambos.</p>}
      {x.note && <p className="cue">{x.note}</p>}
      {last && range(x.sets).some((s) => {
        const e = model.getEntry(week, day, x.id, s);
        return !e.weight && !e.reps && last.sets.some((r) => r.set === s);
      }) && (
        <button type="button" className="repeat-last" onClick={() => actions.repeatLast(week, day, x.id)}>
          ↺ Igual que la última vez <small>({lastWhen})</small>
        </button>
      )}
      <div className="sethead"><span>Serie</span><span>Carga · kg</span><span>Reps</span></div>
      {WARMUP_SETS.slice(0, warmups).map((s, i) => <SetRow key={s} exercise={x} set={s} label={"C" + (i + 1)} />)}
      {range(x.sets).map((s) => (
        <SetRow key={s} exercise={x} set={s} label={String(s)} old={last?.sets.find((r) => r.set === s)} oldWhen={lastWhen} />
      ))}
      {warmups < WARMUP_SETS.length && (
        <button type="button" className="add-warmup" onClick={() => setWarmups(warmups + 1)}>＋ Serie de calentamiento</button>
      )}
    </>
  );
}
