"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { formatLongDate, formatShortDate } from "@/domain/calendar";
import { DAY_NAMES } from "@/domain/snapshot";

// Qué toca hoy según el calendario y qué días quedaron sin hacer (para recuperarlos).
export function TodayPanel() {
  const { calendar, today, week, day, model, actions } = useWorkout();
  if (!today || !model.startDate) return null;

  const todaySessions = calendar.sessionsOn(today);
  const missed = calendar.missedSessions(today);
  const focus = calendar.focusFor(today);
  const onToday = focus && focus.week === week && focus.day === day;
  const streak = calendar.streak(today);

  return (
    <section className="today-card">
      <div className="today-head">
        <div>
          <div className="eyebrow">Hoy</div>
          <strong>{formatLongDate(today)}</strong>
          <span>
            {todaySessions.length
              ? todaySessions.map((s) => "Día " + s.day + " · " + DAY_NAMES[s.day] + " (semana " + s.week + ")").join(" + ")
              : "Día de descanso"}
          </span>
        </div>
        <div className="streak-badge" title={"Mejor racha: " + streak.best + " semanas"}>
          <span aria-hidden="true">🔥</span>
          <b>{streak.current}</b>
          <small>{streak.current === 1 ? "semana" : "semanas"}</small>
        </div>
        {!onToday && <button className="weekaction" type="button" onClick={actions.goToToday}>Ir a hoy</button>}
      </div>

      {missed.length > 0 && (
        <div className="pending">
          <div className="pending-title">Pendientes de recuperar</div>
          {missed.map((s) => {
            const current = s.week === week && s.day === day;
            return (
              <div className="pending-row" key={s.week + "|" + s.day}>
                <div>
                  <strong>Día {s.day} · {DAY_NAMES[s.day]}</strong>
                  <span>{formatShortDate(s.date)} · semana {s.week}</span>
                </div>
                {current
                  ? <span className="tag">Recuperando</span>
                  : <button className="start" type="button" onClick={() => actions.recoverSession(s)}>Recuperar</button>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
