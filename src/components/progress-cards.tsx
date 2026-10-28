"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/controllers/workout-controller";
import { formatShortDate } from "@/domain/calendar";
import { BODY_FIELDS, type BodyField, type BodyMetrics } from "@/domain/types";
import { TapLineChart } from "./tap-line-chart";
import { closeOnBackdrop } from "./backdrop";

const fmt = (n: number, digits = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: digits });

// Racha de semanas completas y progreso de la semana actual.
export function StreakCard() {
  const { calendar, today, model } = useWorkout();
  if (!today || !model.startDate) return null;
  const s = calendar.streak(today);
  return (
    <section className="chart streak-card">
      <div className="streak-main">
        <span className="streak-flame" aria-hidden="true">🔥</span>
        <div>
          <strong>{s.current} {s.current === 1 ? "semana" : "semanas"} seguidas</strong>
          <span>sin fallar ningún día · tu mejor racha: {s.best}</span>
        </div>
      </div>
      <div className="streak-week" aria-label={"Esta semana: " + s.weekDone + " de " + s.weekTotal + " días"}>
        {Array.from({ length: s.weekTotal }, (_, i) => <i key={i} className={i < s.weekDone ? "on" : ""} />)}
        <small>{s.weekDone}/{s.weekTotal} esta semana</small>
      </div>
    </section>
  );
}

// Mejores marcas de cada ejercicio: más peso levantado y mejor 1RM estimado.
export function RecordsCard() {
  const { stats, records } = useWorkout();
  const list = stats.records().sort((a, b) => b.best1RM.value - a.best1RM.value);
  const fresh = new Set(records.map((r) => r.exerciseId));
  return (
    <section className="chart">
      <div className="charttitle"><h2>🏆 Tus récords</h2><span>Más peso y mejor 1RM estimado</span></div>
      {list.length === 0 && <div className="empty">Cuando anotes carga y repeticiones aparecerán aquí tus mejores marcas.</div>}
      <div className="records">
        {list.map((r) => (
          <div className={"record" + (fresh.has(r.exercise.id) ? " fresh" : "")} key={r.exercise.id}>
            <i className="swatch" style={{ background: "var(--day" + r.exercise.day + ")" }} />
            <div className="record-name">
              <strong>{r.exercise.name}{fresh.has(r.exercise.id) && <span className="new-tag">¡Nuevo!</span>}</strong>
              <span>{fmt(r.heaviest.weight, 2)} kg{r.heaviest.reps ? " × " + r.heaviest.reps : ""} · semana {r.heaviest.week}{r.heaviest.date ? " · " + formatShortDate(r.heaviest.date) : ""}</span>
            </div>
            <div className="record-value"><b>{fmt(Math.round(r.best1RM.value * 2) / 2)} kg</b><small>1RM est.</small></div>
          </div>
        ))}
      </div>
    </section>
  );
}

const BODY_LABELS: Record<BodyField, { label: string; unit: string }> = {
  weight: { label: "Peso", unit: "kg" }, waist: { label: "Cintura", unit: "cm" }, chest: { label: "Pecho", unit: "cm" },
  arm: { label: "Brazo", unit: "cm" }, thigh: { label: "Muslo", unit: "cm" }, hip: { label: "Cadera", unit: "cm" },
};

// Peso corporal y medidas: anotar las de hoy y ver su evolución.
export function BodyCard() {
  const { model, today, actions } = useWorkout();
  const [field, setField] = useState<BodyField>("weight");
  const [editing, setEditing] = useState(false);
  if (!today) return null;
  const log = model.bodyLog();
  const latest = log[log.length - 1];
  const series = log.filter((e) => e.metrics[field] !== undefined);
  const first = series[0]?.metrics[field], last = series[series.length - 1]?.metrics[field];
  const { unit } = BODY_LABELS[field];

  return (
    <section className="chart">
      <div className="charttitle"><h2>Tu cuerpo</h2><span>Peso y medidas</span></div>
      <div className="body-fields">
        {BODY_FIELDS.map((f) => {
          const value = latest?.metrics[f];
          return (
            <button key={f} type="button" className={"body-field" + (f === field ? " active" : "")} onClick={() => setField(f)}>
              <small>{BODY_LABELS[f].label}</small>
              <b>{value !== undefined ? fmt(value) : "—"}<em> {BODY_LABELS[f].unit}</em></b>
            </button>
          );
        })}
      </div>
      {series.length >= 2 && first !== undefined && last !== undefined && (
        <p className="body-change">
          {BODY_LABELS[field].label}: {last - first === 0 ? "sin cambios" : (last > first ? "+" : "") + fmt(last - first) + " " + unit} desde el {formatShortDate(series[0].date)}
        </p>
      )}
      <TapLineChart color="var(--accent)" caption={BODY_LABELS[field].label + " por fecha"}
        points={series.map((e) => ({ key: e.date, value: e.metrics[field]!, label: fmt(e.metrics[field]!) + " " + unit, sub: formatShortDate(e.date) }))} />
      {series.length < 2 && <p className="body-hint">Anota tus medidas cada semana para ver aquí cómo cambian.</p>}
      <button type="button" className="settings-btn" onClick={() => setEditing(true)}>＋ Anotar medidas de hoy</button>
      {editing && <BodyForm date={today} initial={model.bodyLog().find((e) => e.date === today)?.metrics ?? {}}
        onSave={(m) => { actions.setBodyMetrics(today, m); setEditing(false); }} onClose={() => setEditing(false)} />}
    </section>
  );
}

function BodyForm({ date, initial, onSave, onClose }: { date: string; initial: BodyMetrics; onSave: (m: BodyMetrics) => void; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(BODY_FIELDS.map((f) => [f, initial[f] !== undefined ? String(initial[f]) : ""])));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const metrics: BodyMetrics = {};
    BODY_FIELDS.forEach((f) => {
      const n = Number(values[f].replace(",", "."));
      if (n > 0 && n < 1000) metrics[f] = Math.round(n * 10) / 10;
    });
    onSave(metrics);
  };
  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="bodyTitle" {...closeOnBackdrop(onClose)}>
      <form className="modal" onSubmit={submit}>
        <h2 id="bodyTitle">Medidas de hoy</h2>
        <p>{formatShortDate(date)} · rellena solo las que quieras.</p>
        <div className="body-form">
          {BODY_FIELDS.map((f) => (
            <label key={f} className="form-label">{BODY_LABELS[f].label} ({BODY_LABELS[f].unit})
              <input type="number" inputMode="decimal" min={0} max={999} step={0.1} value={values[f]}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })} autoFocus={f === "weight"} />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit">Guardar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
