"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS } from "@/domain/calendar";
import { DAYS } from "@/domain/snapshot";
import type { WeekSchedule } from "@/domain/types";

const PRESETS: { label: string; schedule: WeekSchedule }[] = [
  { label: "Lunes a viernes", schedule: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 } },
  { label: "Martes a sábado", schedule: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 } },
  { label: "Miércoles libre", schedule: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6 } },
  { label: "Lun, mar, jue, vie, dom", schedule: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 7 } },
];

// Calendario de la rutina: fecha de inicio del ciclo y presets de días de la semana.
export function ScheduleCard() {
  const { model, actions } = useWorkout();
  const schedule = model.schedule;
  const activePreset = PRESETS.find((p) => DAYS.every((d) => p.schedule[d] === schedule[d]));

  // Días de rutina que caen el mismo día de la semana.
  const clashes = WEEKDAYS
    .map((wd) => ({ wd, days: DAYS.filter((d) => schedule[d] === wd) }))
    .filter((c) => c.days.length > 1);

  return (
    <section className="chart schedule-card">
      <div className="charttitle"><h2>Calendario</h2><span>Qué día de la semana haces cada rutina</span></div>
      <label className="form-label">
        La semana 1 empieza el lunes
        <input
          type="date"
          value={model.startDate ?? ""}
          onChange={(e) => { if (e.target.value) actions.setStartDate(e.target.value); }}
        />
      </label>
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={"quiet" + (p === activePreset ? " selected" : "")}
            onClick={() => actions.applySchedulePreset(p.schedule, p.label)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {clashes.map((c) => (
        <p className="schedule-note" key={c.wd}>
          Los días {c.days.join(" y ")} caen el {WEEKDAY_NAMES[c.wd]}.
        </p>
      ))}
    </section>
  );
}

// Selector L M X J V S D para un día de la rutina.
export function WeekdayPicker({ day }: { day: number }) {
  const { model, actions } = useWorkout();
  const current = model.weekdayFor(day);
  return (
    <div className="weekday-picker" role="radiogroup" aria-label={"Día de la semana del Día " + day}>
      {WEEKDAYS.map((wd) => (
        <button
          key={wd}
          type="button"
          role="radio"
          aria-checked={wd === current}
          aria-label={WEEKDAY_NAMES[wd]}
          className={"week" + (wd === current ? " active" : "")}
          onClick={() => actions.setWeekday(day, wd)}
        >
          {WEEKDAY_SHORT[wd]}
        </button>
      ))}
    </div>
  );
}
