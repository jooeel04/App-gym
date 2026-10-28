"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate, formatShortDate } from "@/domain/calendar";
import { DAY_NAMES } from "@/domain/snapshot";
import type { SetEntry } from "@/domain/types";

const PAGE_DAYS = 10;

function describeSet(e: SetEntry) {
  const load = e.weight ? e.weight.replace(".", ",") + " kg" : "";
  const reps = e.reps ? e.reps + " reps" : "";
  return [load, reps].filter(Boolean).join(" × ") || "—";
}

// Registro diario: qué se hizo cada fecha, indicando los días recuperados.
export function DailyLog() {
  const { diary } = useWorkout();
  const [visible, setVisible] = useState(PAGE_DAYS);
  const days = diary.days();
  const undated = diary.undatedCount();

  return (
    <section className="chart">
      <div className="charttitle"><h2>Registro diario</h2><span>Por fecha en que entrenaste</span></div>
      {days.length === 0 && <div className="empty">Cuando anotes series, aparecerán aquí agrupadas por día.</div>}
      <div className="diary">
        {days.slice(0, visible).map(({ date, sessions }) => (
          <article className="diary-day" key={date}>
            <h3>{formatLongDate(date)}</h3>
            {sessions.map((s) => {
              const shifted = s.plannedDate && s.plannedDate !== date;
              return (
                <div className="diary-session" key={s.week + "|" + s.day}>
                  <div className="diary-session-head">
                    <strong>Día {s.day} · {DAY_NAMES[s.day]}</strong>
                    <span>Semana {s.week}</span>
                    {shifted && (
                      <span className="tag">
                        {s.plannedDate! < date ? "Recuperado" : "Adelantado"} · planificado el {formatShortDate(s.plannedDate!)}
                      </span>
                    )}
                  </div>
                  {s.exercises.map(({ exercise, sets }) => (
                    <div className="diary-ex" key={exercise.id}>
                      <span>{exercise.name}</span>
                      <span>{sets.map(({ set, entry }) => <i key={set} title={entry.note || undefined}>{describeSet(entry)}{entry.note ? " ✎" : ""}</i>)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </article>
        ))}
      </div>
      {days.length > visible && (
        <button className="quiet diary-more" type="button" onClick={() => setVisible((v) => v + PAGE_DAYS)}>Ver días anteriores</button>
      )}
      {undated > 0 && (
        <p className="schedule-note">{undated} series anotadas antes de esta función no tienen fecha y no aparecen aquí.</p>
      )}
    </section>
  );
}
