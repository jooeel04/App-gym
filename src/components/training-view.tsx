"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate, WEEKDAY_SHORT } from "@/domain/calendar";
import { MUSCLE_NAMES, musclesFor } from "@/domain/exercise-library";
import { suggestNext } from "@/domain/progression";
import { DAY_NAMES, DAYS, WARMUP_SETS } from "@/domain/snapshot";
import type { Exercise, SetField } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { BodyMap } from "./body-map";
import { describeSet } from "./exercise-progress";
import { ChevronIcon } from "./icons";
import { PlateCalculator } from "./plate-calculator";
import { TodayPanel } from "./today-panel";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Vista "Entrenar": qué toca hoy, selector de día y series por ejercicio. El día se
// marca como completado automáticamente cuando todos sus ejercicios están anotados.
export function TrainingView() {
  const { model, stats, calendar, today, week, day, active, actions } = useWorkout();
  const [plates, setPlates] = useState(false);
  const dt = stats.day(week, day);
  const done = model.isDayCompleted(week, day);
  const planned = calendar.plannedDate(week, day);
  const recovering = !!(today && planned && planned < today && !calendar.isDone(week, day));
  const list = model.exercisesOfDay(day);
  // Entreno en curso en este día: se abre el siguiente ejercicio por hacer.
  const live = !!active && active.week === week && active.day === day;
  const next = live ? list.findIndex((x) => !model.isExerciseDone(week, day, x)) : -1;
  const listRef = useRef<HTMLDivElement>(null);
  // Al empezar y al terminar cada ejercicio, la pantalla baja hasta el siguiente.
  useEffect(() => {
    if (next < 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.querySelector(".exercise.next")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [next]);

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu plan de entrenamiento</div>
          <h1>Entrenar</h1>
          <p className="lede">Anota tus series: cada día se marca como completado al terminar todos sus ejercicios.</p>
        </div>
        <button type="button" className="tool-btn" onClick={() => setPlates(true)}>🏋️ Discos</button>
      </div>

      <TodayPanel />

      <div className="days">
        {DAYS.map((d) => (
          <button key={d} className={"day" + (d === day ? " active" : "")} onClick={() => actions.selectDay(d)}>
            <small>Día {d}{model.weekdayFor(d) ? " · " + WEEKDAY_SHORT[model.weekdayFor(d)] : ""}</small><b>{DAY_NAMES[d]}</b>{stats.day(week, d).n > 0 && <i className="dot" />}
          </button>
        ))}
      </div>

      <div className="session">
        <div className="sessiontitle">
          <span className="mark">{day}</span>
          <div>
            <h2>Día {day}</h2>
            <p>
              {DAY_NAMES[day]} · Semana {week}
              {planned && <> · {formatShortDate(planned)}</>}
              {recovering && <span className="tag">Recuperando hoy</span>}
              {live && <span className="tag live-tag">En curso</span>}
            </p>
          </div>
        </div>
        <div className={"daycount" + (done ? " done" : "")}><strong>{done ? "✓ Día completado" : dt.n + " / " + dt.p + " series"}</strong>{done ? dt.n + " / " + dt.p + " series anotadas" : "anotadas"}</div>
      </div>

      {!live && !done && list.length > 0 && (
        <button type="button" className="start-workout" onClick={() => actions.startWorkout(week, day)}>
          <span aria-hidden="true">▶</span> Empezar entreno
          <small>Cronómetro en marcha y pantalla siempre encendida</small>
        </button>
      )}

      <div className="list" key={day} ref={listRef}>
        {list.map((x, i) => (
          <ExerciseCard key={x.id + "-" + week + "-" + day} exercise={x} index={i} open={live ? i === next : i === 0} next={i === next}
            superset={x.superset && i < list.length - 1 ? "first" : list[i - 1]?.superset ? "second" : null} />
        ))}
      </div>
      {plates && <PlateCalculator onClose={() => setPlates(false)} />}
    </section>
  );
}

// Fila de una serie: carga, repeticiones, nota y lo que se hizo la última vez.
function SetRow({ exercise: x, set: s, label, old, oldWeek }: { exercise: Exercise; set: number; label: string; old?: SetResult; oldWeek?: number }) {
  const { model, week, day, actions } = useWorkout();
  const e = model.getEntry(week, day, x.id, s);
  const warmup = s > x.sets;
  const aria = x.name + (warmup ? ", calentamiento " : ", serie ") + label;
  const set = (field: SetField) => (ev: React.ChangeEvent<HTMLInputElement>) => actions.setEntry(week, day, x.id, s, field, ev.target.value);
  return (
    <div className={"setrow" + (warmup ? " warmup" : "")}>
      <div className="setnum">{label}{x.optionalLast && s === x.sets && <span className="optional">Opcional</span>}</div>
      <label className="field"><input type="number" min="0" step="0.5" inputMode="decimal" placeholder="— kg" aria-label={aria + ", carga"} value={e.weight ?? ""} onChange={set("weight")} /></label>
      <label className="field"><input type="number" min="0" step="1" inputMode="numeric" placeholder="—" aria-label={aria + ", repeticiones"} value={e.reps ?? ""} onChange={set("reps")} /></label>
      <details className="setnote">
        <summary>{e.note ? "Ver nota" : "＋ Nota"}</summary>
        <input type="text" maxLength={160} placeholder="Anotación de esta serie" aria-label={"Nota " + aria} value={e.note ?? ""} onChange={set("note")} />
      </details>
      {old && <div className="prev">Última vez (semana {oldWeek}): {describeSet(old)}{old.reps !== null && " reps"}</div>}
    </div>
  );
}

function ExerciseCard({ exercise: x, index, open, next, superset }: { exercise: Exercise; index: number; open: boolean; next: boolean; superset: "first" | "second" | null }) {
  const { model, stats, week, day, actions } = useWorkout();
  const n = model.loggedSets(week, day, x), done = model.isExerciseDone(week, day, x);
  const checked = model.isExerciseChecked(week, day, x.id);
  const last = stats.lastBefore(x, week);
  const tip = suggestNext(x, last);
  const muscles = musclesFor(x.name);
  // Series de calentamiento visibles: las que ya tienen datos, o las añadidas ahora.
  const [warmups, setWarmups] = useState(() => WARMUP_SETS.filter((s) => {
    const e = model.getEntry(week, day, x.id, s);
    return e.weight || e.reps;
  }).length);
  // Con todas las series anotadas el tick ya está puesto y no se puede quitar a mano.
  const filled = done && !checked;

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
      <div className="exbody">
        {muscles && (
          <div className="exmuscles">
            <BodyMap primary={muscles.primary} secondary={muscles.secondary} size="sm" />
            <span><b>{muscles.primary.map((m) => MUSCLE_NAMES[m]).join(", ")}</b>{muscles.secondary.length > 0 && <small>También: {muscles.secondary.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(", ")}</small>}</span>
          </div>
        )}
        {tip && <div className={"tip " + tip.kind}><span aria-hidden="true">{tip.kind === "increase" ? "📈" : "💡"}</span>{tip.text}</div>}
        {superset === "first" && <p className="ss-note">Superserie: haz una serie de este y otra del siguiente sin descansar entre ambos.</p>}
        {x.note && <p className="cue">{x.note}</p>}
        <div className="sethead"><span>Serie</span><span>Carga · kg</span><span>Reps</span></div>
        {WARMUP_SETS.slice(0, warmups).map((s, i) => <SetRow key={s} exercise={x} set={s} label={"C" + (i + 1)} />)}
        {range(x.sets).map((s) => (
          <SetRow key={s} exercise={x} set={s} label={String(s)} old={last?.sets.find((r) => r.set === s)} oldWeek={last?.week} />
        ))}
        {warmups < WARMUP_SETS.length && (
          <button type="button" className="add-warmup" onClick={() => setWarmups(warmups + 1)}>＋ Serie de calentamiento</button>
        )}
      </div>
    </details>
  );
}
