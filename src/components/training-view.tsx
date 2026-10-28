"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate, WEEKDAY_SHORT } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise, SetField } from "@/domain/types";
import { ChevronIcon } from "./icons";
import { TodayPanel } from "./today-panel";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Vista "Entrenar": qué toca hoy, selector de día y series por ejercicio. El día se
// marca como completado automáticamente cuando todos sus ejercicios están anotados.
export function TrainingView() {
  const { model, stats, calendar, today, week, day, actions } = useWorkout();
  const dt = stats.day(week, day);
  const done = model.isDayCompleted(week, day);
  const planned = calendar.plannedDate(week, day);
  const recovering = !!(today && planned && planned < today && !calendar.isDone(week, day));

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu plan de entrenamiento</div>
          <h1>Entrenar</h1>
          <p className="lede">Anota tus series: cada día se marca como completado al terminar todos sus ejercicios.</p>
        </div>
        <div className="headnote">Se guarda automáticamente<br />mientras escribes.</div>
      </div>

      <TodayPanel />

      <div className="days">
        {DAYS.map((d) => (
          <button key={d} className={"day" + (d === day ? " active" : "")} onClick={() => actions.selectDay(d)}>
            <small>Día {d} · {WEEKDAY_SHORT[model.weekdayFor(d)]}</small><b>{DAY_NAMES[d]}</b>{stats.day(week, d).n > 0 && <i className="dot" />}
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
            </p>
          </div>
        </div>
        <div className={"daycount" + (done ? " done" : "")}><strong>{done ? "✓ Día completado" : dt.n + " / " + dt.p + " series"}</strong>{done ? dt.n + " / " + dt.p + " series anotadas" : "anotadas"}</div>
      </div>

      <div className="list">
        {model.exercisesOfDay(day).map((x, i) => <ExerciseCard key={x.id + "-" + week + "-" + day} exercise={x} index={i} />)}
      </div>
    </section>
  );
}

function ExerciseCard({ exercise: x, index }: { exercise: Exercise; index: number }) {
  const { model, week, day, actions } = useWorkout();
  const n = model.loggedSets(week, day, x), done = model.isExerciseDone(week, day, x);
  const checked = model.isExerciseChecked(week, day, x.id);
  // Con todas las series anotadas el tick ya está puesto y no se puede quitar a mano.
  const filled = done && !checked;
  const set = (s: number, field: SetField) => (e: React.ChangeEvent<HTMLInputElement>) => actions.setEntry(week, day, x.id, s, field, e.target.value);

  return (
    <details className="exercise" open={index === 0}>
      <summary>
        <span className="idx">{String(index + 1).padStart(2, "0")}</span>
        <span className="exmain"><span className="exname">{x.name}</span><span className="pres">{x.prescription}</span></span>
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
        {x.note && <p className="cue">{x.note}</p>}
        <div className="sethead"><span>Serie</span><span>Carga · kg</span><span>Reps</span></div>
        {range(x.sets).map((s) => {
          const e = model.getEntry(week, day, x.id, s);
          const old = week > 1 ? model.getEntry(week - 1, day, x.id, s) : {};
          const label = x.name + ", serie " + s;
          return (
            <div className="setrow" key={s}>
              <div className="setnum">{s}{x.optionalLast && s === x.sets && <span className="optional">Opcional</span>}</div>
              <label className="field"><input type="number" min="0" step="0.5" inputMode="decimal" placeholder="— kg" aria-label={label + ", carga"} value={e.weight ?? ""} onChange={set(s, "weight")} /></label>
              <label className="field"><input type="number" min="0" step="1" inputMode="numeric" placeholder="—" aria-label={label + ", repeticiones"} value={e.reps ?? ""} onChange={set(s, "reps")} /></label>
              <details className="setnote">
                <summary>{e.note ? "Ver nota" : "＋ Nota"}</summary>
                <input type="text" maxLength={160} placeholder="Anotación de esta serie" aria-label={"Nota " + label} value={e.note ?? ""} onChange={set(s, "note")} />
              </details>
              {(old.weight || old.reps) && (
                <div className="prev">Semana anterior: {old.weight ? old.weight + " kg" : "—"}{old.reps ? " · " + old.reps + " reps" : ""}</div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
