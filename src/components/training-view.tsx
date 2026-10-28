"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate, WEEKDAY_SHORT } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { Exercise, SetField } from "@/domain/types";
import { percent } from "@/domain/workout-stats";
import { ChevronIcon } from "./icons";
import { TodayPanel } from "./today-panel";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Vista "Entrenar": selector de semana y día, series por ejercicio y resumen lateral.
export function TrainingView() {
  const { model, stats, calendar, today, week, day, actions } = useWorkout();
  const dt = stats.day(week, day), wt = stats.week(week), pct = percent(wt.n, wt.p);
  const done = model.isDayCompleted(week, day);
  const planned = calendar.plannedDate(week, day);
  const recovering = !!(today && planned && planned < today && !calendar.isDone(week, day));

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu plan de entrenamiento</div>
          <h1>Entrenar</h1>
          <p className="lede">Anota tus series y sigue el avance semana a semana.</p>
        </div>
        <div className="headnote">Se guarda automáticamente<br />mientras escribes.</div>
      </div>

      <TodayPanel />

      <section className="cycle">
        <div className="cyclecopy">
          <strong>Semana {week} <span style={{ display: "inline", color: "var(--muted)", fontWeight: 500 }}>de {model.weeksCount}</span></strong>
          <span>{wt.n} series anotadas esta semana</span>
        </div>
        <div className="cyclecontrols">
          <div className="weeks">
            {range(model.weeksCount).map((w) => (
              <button key={w} className={"week" + (w === week ? " active" : "") + (stats.week(w).n ? " has" : "")} aria-label={"Semana " + w} onClick={() => actions.selectWeek(w)}>{w}</button>
            ))}
          </div>
          <div className="weekactions">
            <button className="weekaction" type="button" onClick={() => actions.removeWeek(week)}>− Eliminar semana</button>
            <button className="weekaction" type="button" onClick={actions.addWeek}>＋ Añadir semana</button>
          </div>
        </div>
      </section>

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
        <div className="daycount"><strong>{dt.n} / {dt.p} series</strong>anotadas</div>
      </div>

      <div className="layout">
        <section>
          <div className="list">
            {model.exercisesOfDay(day).map((x, i) => <ExerciseCard key={x.id + "-" + week + "-" + day} exercise={x} index={i} />)}
          </div>
          <div className="actions">
            <span className="savehint">Guardado automáticamente</span>
            <button className={"complete" + (done ? " done" : "")} onClick={() => actions.toggleDayCompleted(week, day)}>{done ? "✓ Día completado" : "Marcar día completado"}</button>
          </div>
        </section>
        <aside className="side">
          <div className="sidecard">
            <h3>Semana {week}</h3>
            <div className="kpi"><strong>{pct}%</strong><span>de las series<br />anotadas</span></div>
            <div className="track"><div className="fill" style={{ width: pct + "%" }} /></div>
            <div className="side-small"><span>{wt.n} anotadas</span><span>{wt.p} previstas</span></div>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "14px 0" }} />
            {DAYS.map((d) => {
              const t = stats.day(week, d);
              return <div className="mini" key={d}><span>Día {d} · {DAY_NAMES[d]}</span><strong>{t.n}/{t.p}</strong></div>;
            })}
          </div>
          <div className="sidecard sideinfo">
            <b>Cómo usarlo</b><br />Abre cada ejercicio, registra kg y repeticiones por serie. Las series opcionales aparecen señaladas; las notas se guardan junto a cada serie.
          </div>
        </aside>
      </div>
    </section>
  );
}

function ExerciseCard({ exercise: x, index }: { exercise: Exercise; index: number }) {
  const { model, week, day, actions } = useWorkout();
  const n = model.loggedSets(week, day, x);
  const set = (s: number, field: SetField) => (e: React.ChangeEvent<HTMLInputElement>) => actions.setEntry(week, day, x.id, s, field, e.target.value);

  return (
    <details className="exercise" open={index === 0}>
      <summary>
        <span className="idx">{String(index + 1).padStart(2, "0")}</span>
        <span className="exmain"><span className="exname">{x.name}</span><span className="pres">{x.prescription}</span></span>
        <span className={"exprogress" + (n === x.sets ? " complete" : "")}>{n}/{x.sets}</span>
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
