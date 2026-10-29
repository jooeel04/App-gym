"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatShortDate, mondayOf, WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS, weekdayOf } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { WeekSchedule } from "@/domain/types";
import { closeOnBackdrop } from "./backdrop";
import { SettingsIcon, SleepIcon } from "./icons";

// Planes rápidos: día de rutina (1-5) → día de la semana (0 = sin día fijo).
const PRESETS: { label: string; schedule: WeekSchedule }[] = [
  { label: "Lunes a viernes", schedule: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } },
  { label: "Martes a sábado", schedule: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 } },
  { label: "Miércoles libre", schedule: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6 } },
  { label: "Jueves libre", schedule: { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6 } },
  { label: "Libre miércoles y sábado", schedule: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 7 } },
  { label: "Lun, mié, vie y finde", schedule: { 1: 1, 2: 3, 3: 5, 4: 6, 5: 7 } },
  { label: "Días alternos", schedule: { 1: 1, 2: 3, 3: 5, 4: 7, 5: 0 } },
  { label: "4 días", schedule: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 0 } },
  { label: "3 días", schedule: { 1: 1, 2: 3, 3: 5, 4: 0, 5: 0 } },
];

// Fondo de un día de la semana: el color de su rutina (repartido si hay varias).
function dayColor(routines: number[]) {
  if (routines.length === 1) return "var(--day" + routines[0] + ")";
  const step = 100 / routines.length;
  return "linear-gradient(180deg," + routines.map((d, i) => "var(--day" + d + ") " + i * step + "% " + (i + 1) * step + "%").join(",") + ")";
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "Tu semana": qué rutina toca cada día de la semana. Cada día va del color de su
// rutina (sin abreviaturas, que no se entendían) y la leyenda de debajo dice qué rutina
// es cada color. Los planes rápidos y la semana del ciclo (se configuran una vez) están
// en la ventana "Cambiar mis días".
export function ScheduleCard() {
  const { model, today } = useWorkout();
  const [picking, setPicking] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const schedule = model.schedule;
  const trainingDays = WEEKDAYS.filter((wd) => DAYS.some((d) => schedule[d] === wd)).length;
  const unscheduled = DAYS.filter((d) => !schedule[d]);

  return (
    <section className="chart planner">
      <div className="charttitle">
        <h2>Tu semana</h2>
        <span>{trainingDays} {trainingDays === 1 ? "día" : "días"} · {7 - trainingDays} de descanso</span>
      </div>
      <p className="planner-hint">Toca un día para elegir qué rutina haces.</p>
      <div className="week-strip">
        {WEEKDAYS.map((wd) => {
          const routines = DAYS.filter((d) => schedule[d] === wd);
          const isToday = today !== null && weekdayOf(today) === wd;
          return (
            <button key={wd} type="button" className={"wk-day" + (routines.length ? " train" : " rest") + (isToday ? " today" : "")}
              aria-label={capitalize(WEEKDAY_NAMES[wd]) + ": " + (routines.length ? routines.map((d) => DAY_NAMES[d]).join(" y ") : "descanso")}
              style={routines.length ? { background: dayColor(routines) } : undefined}
              onClick={() => setPicking(wd)}>
              <b aria-hidden="true">{WEEKDAY_SHORT[wd]}</b>
              {!routines.length && <span className="wk-rest" aria-hidden="true"><SleepIcon /></span>}
              {isToday && <i className="wk-today">hoy</i>}
            </button>
          );
        })}
      </div>
      <ul className="wk-legend" aria-label="Qué rutina es cada color">
        {DAYS.map((d) => <li key={d}><i style={{ background: "var(--day" + d + ")" }} aria-hidden="true" />{DAY_NAMES[d]}</li>)}
      </ul>
      {unscheduled.length > 0 && (
        <p className="schedule-note">Sin día fijo: {unscheduled.map((d) => DAY_NAMES[d]).join(", ")}. Puedes hacerlos cuando quieras desde Hoy.</p>
      )}

      <button type="button" className="settings-btn" onClick={() => setSettings(true)}><SettingsIcon />Cambiar mis días</button>
      {picking !== null && <DaySheet weekday={picking} onClose={() => setPicking(null)} />}
      {settings && <WeekSettings onClose={() => setSettings(false)} />}
    </section>
  );
}

// "Cambiar mis días": planes rápidos y semana del ciclo, que se configuran una vez.
function WeekSettings({ onClose }: { onClose: () => void }) {
  const { model, actions } = useWorkout();
  const schedule = model.schedule;
  const activePreset = PRESETS.find((p) => DAYS.every((d) => p.schedule[d] === schedule[d]));
  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="weekSettingsTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal week-settings">
        <h2 id="weekSettingsTitle">Cambiar mis días</h2>
        <p>Lo configuras una vez y te olvidas. También puedes tocar cada día de «Tu semana».</p>
        <div className="planner-section">
          <b>Planes rápidos</b>
          <div className="preset-list">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className={"preset" + (p === activePreset ? " active" : "")}
                onClick={() => actions.applySchedulePreset(p.schedule, p.label)}>
                <span className="preset-dots" aria-hidden="true">
                  {WEEKDAYS.map((wd) => <i key={wd} className={Object.values(p.schedule).includes(wd) ? "on" : ""} />)}
                </span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <CycleWeek />
        <div className="modal-actions"><button className="primary" type="button" onClick={onClose}>Listo</button></div>
      </div>
    </div>,
    document.body,
  );
}

// En qué semana del ciclo estás: se ajusta con − / + (cambia la fecha de inicio).
function CycleWeek() {
  const { model, today, actions } = useWorkout();
  const [custom, setCustom] = useState(false);
  if (!today || !model.startDate) return null;
  const monday = mondayOf(today);
  const current = Math.floor((Date.parse(monday) - Date.parse(model.startDate)) / (7 * 86400000)) + 1;
  const setWeek = (n: number) => {
    if (n < 1) return;
    actions.setStartDate(addDays(monday, -(n - 1) * 7));
  };

  return (
    <div className="planner-section">
      <b>¿En qué semana vas?</b>
      <div className="cycle-week">
        <button type="button" aria-label="Semana anterior" onClick={() => setWeek(current - 1)} disabled={current <= 1}>−</button>
        <div><strong>Semana {Math.max(current, 1)}</strong><small>esta semana · empezó el {formatShortDate(model.startDate)}</small></div>
        <button type="button" aria-label="Semana siguiente" onClick={() => setWeek(current + 1)}>＋</button>
      </div>
      <p className="planner-hint">Los registros se guardan por semana: cambia esto solo si la app se ha desfasado (por ejemplo, tras unas vacaciones).</p>
      {custom ? (
        <label className="form-label">Fecha en que empezó la semana 1
          <input type="date" value={model.startDate} onChange={(e) => { if (e.target.value) actions.setStartDate(e.target.value); }} />
        </label>
      ) : (
        <button type="button" className="auth-link" onClick={() => setCustom(true)}>Elegir la fecha de inicio a mano</button>
      )}
    </div>
  );
}

// Ventana para elegir qué rutinas se hacen un día de la semana.
function DaySheet({ weekday, onClose }: { weekday: number; onClose: () => void }) {
  const { model, actions } = useWorkout();
  const schedule = model.schedule;
  const toggle = (d: number) => actions.setWeekday(d, schedule[d] === weekday ? 0 : weekday);
  const rest = () => DAYS.filter((d) => schedule[d] === weekday).forEach((d) => actions.setWeekday(d, 0));

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="daySheetTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal day-sheet">
        <h2 id="daySheetTitle">{capitalize(WEEKDAY_NAMES[weekday])}</h2>
        <p>¿Qué rutina haces este día? Puedes elegir más de una.</p>
        <div className="settings-list">
          {DAYS.map((d) => {
            const on = schedule[d] === weekday;
            const elsewhere = !on && schedule[d] ? "ahora el " + WEEKDAY_NAMES[schedule[d]] : !on ? "sin día fijo" : "";
            return (
              <button key={d} type="button" role="checkbox" aria-checked={on} className={"settings-row routine-pick" + (on ? " on" : "")} onClick={() => toggle(d)}>
                <span className="row-icon" style={{ background: "var(--day" + d + ")", color: "#fff" }}>{d}</span>
                <span className="row-text"><strong>{DAY_NAMES[d]}</strong>{elsewhere && <small>{elsewhere}{schedule[d] ? " · se moverá aquí" : ""}</small>}</span>
                <span className="pick-check" aria-hidden="true">{on ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={rest}><SleepIcon /> Día de descanso</button>
          <button className="primary" type="button" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
