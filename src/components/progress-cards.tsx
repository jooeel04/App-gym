"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/controllers/workout-controller";
import { formatDayMonth, formatShortDate } from "@/domain/calendar";
import { BODY_FIELDS, type BodyField, type BodyMetrics } from "@/domain/types";
import { TapLineChart } from "./tap-line-chart";
import { closeOnBackdrop } from "./backdrop";
import { askConfirm } from "./confirm-dialog";
import { CheckIcon, FlameIcon, PencilIcon, PlusIcon, TrophyIcon } from "./icons";

const fmt = (n: number, digits = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: digits });

// Resumen en tres números: racha de semanas completas, días entrenados este mes y
// récords (mejor 1RM estimado de un ejercicio) conseguidos este mes.
export function ProgressStats() {
  const { calendar, diary, stats, today, model } = useWorkout();
  if (!today) return null;
  const month = today.slice(0, 7);
  const streak = model.startDate ? calendar.streak(today) : null;
  const days = diary.days().filter((d) => d.date.startsWith(month)).length;
  const records = stats.records().filter((r) => r.best1RM.date?.startsWith(month)).length;
  return (
    <div className="stat-tiles">
      <div className="stat-tile" title={streak ? "Tu mejor racha: " + streak.best + " semanas" : undefined}>
        <FlameIcon className="flame" />
        <strong>{streak?.current ?? 0}</strong>
        <span>{streak?.current === 1 ? "semana seguida" : "semanas seguidas"}</span>
      </div>
      <div className="stat-tile">
        <CheckIcon className="accent" />
        <strong>{days}</strong>
        <span>{days === 1 ? "día este mes" : "días este mes"}</span>
      </div>
      <div className="stat-tile">
        <TrophyIcon className="gold" />
        <strong>{records}</strong>
        <span>{records === 1 ? "récord este mes" : "récords este mes"}</span>
      </div>
    </div>
  );
}

const BODY_LABELS: Record<BodyField, { label: string; unit: string }> = {
  weight: { label: "Peso", unit: "kg" }, waist: { label: "Cintura", unit: "cm" }, chest: { label: "Pecho", unit: "cm" },
  arm: { label: "Brazo", unit: "cm" }, thigh: { label: "Muslo", unit: "cm" }, hip: { label: "Cadera", unit: "cm" },
};

const HISTORY_ROWS = 5;

// Resumen de las medidas de un día: "78,5 kg · cintura 84 cm".
const describeMetrics = (m: BodyMetrics) => BODY_FIELDS.filter((f) => m[f] !== undefined)
  .map((f) => (f === "weight" ? "" : BODY_LABELS[f].label.toLowerCase() + " ") + fmt(m[f]!) + " " + BODY_LABELS[f].unit).join(" · ");

// Peso corporal y medidas: anotar las de hoy, ver su evolución y corregir o borrar las de
// cualquier día desde el historial. Solo se muestran las medidas que se han anotado alguna
// vez; sin ninguna, solo el botón.
export function BodyCard() {
  const { model, today, actions } = useWorkout();
  const [picked, setPicked] = useState<BodyField>("weight");
  // Fecha cuyas medidas se están editando (null = ninguna).
  const [editing, setEditing] = useState<string | null>(null);
  const [allRows, setAllRows] = useState(false);
  if (!today) return null;
  const log = model.bodyLog();
  const used = BODY_FIELDS.filter((f) => log.some((e) => e.metrics[f] !== undefined));
  const field = used.includes(picked) ? picked : used[0];
  const existing = editing ? log.find((e) => e.date === editing)?.metrics : undefined;
  const form = editing && <BodyForm date={editing} isToday={editing === today} initial={existing ?? {}} canDelete={!!existing}
    onSave={(m) => { actions.setBodyMetrics(editing, m); setEditing(null); }} onClose={() => setEditing(null)} />;

  if (!field) {
    return (
      <section className="chart">
        <div className="charttitle"><h2>Tu cuerpo</h2></div>
        <p className="body-hint">Anota tu peso y medidas cada semana para ver cómo cambian.</p>
        <button type="button" className="settings-btn" onClick={() => setEditing(today)}><PlusIcon />Anotar medidas de hoy</button>
        {form}
      </section>
    );
  }
  const history = [...log].reverse();
  const { unit } = BODY_LABELS[field];
  const series = log.filter((e) => e.metrics[field] !== undefined);
  const first = series[0]?.metrics[field], last = series[series.length - 1]?.metrics[field];

  return (
    <section className="chart">
      <div className="charttitle"><h2>Tu cuerpo</h2></div>
      <div className="body-fields">
        {used.map((f) => {
          // Último valor anotado de esa medida.
          const value = [...log].reverse().find((e) => e.metrics[f] !== undefined)?.metrics[f];
          return (
            <button key={f} type="button" className={"body-field" + (f === field ? " active" : "")} onClick={() => setPicked(f)}>
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
        points={series.map((e) => ({ key: e.date, value: e.metrics[field]!, label: fmt(e.metrics[field]!) + " " + unit, sub: formatShortDate(e.date), tick: formatDayMonth(e.date) }))} />
      {series.length < 2 && <p className="body-hint">Anota tus medidas cada semana para ver aquí cómo cambian.</p>}
      <button type="button" className="settings-btn" onClick={() => setEditing(today)}>
        {log.some((e) => e.date === today) ? <><PencilIcon />Cambiar las medidas de hoy</> : <><PlusIcon />Anotar medidas de hoy</>}
      </button>
      <div className="body-history">
        <div className="body-history-title">Historial · toca un día para cambiarlo o borrarlo</div>
        {history.slice(0, allRows ? history.length : HISTORY_ROWS).map((e) => (
          <button key={e.date} type="button" className="body-entry" onClick={() => setEditing(e.date)}>
            <span><b>{formatShortDate(e.date)}</b><small>{describeMetrics(e.metrics)}</small></span>
            <em aria-hidden="true"><PencilIcon /></em>
          </button>
        ))}
        {history.length > HISTORY_ROWS && (
          <button type="button" className="quiet body-more" onClick={() => setAllRows(!allRows)}>{allRows ? "Ver menos" : "Ver todo (" + history.length + ")"}</button>
        )}
      </div>
      {form}
    </section>
  );
}

// Ventana para anotar o corregir las medidas de un día. Los recuadros son de texto
// (con teclado numérico) para aceptar la coma decimal del teclado en español.
function BodyForm({ date, isToday, initial, canDelete, onSave, onClose }: {
  date: string; isToday: boolean; initial: BodyMetrics; canDelete: boolean; onSave: (m: BodyMetrics | null) => void; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(BODY_FIELDS.map((f) => [f, initial[f] !== undefined ? String(initial[f]).replace(".", ",") : ""])));
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
        <h2 id="bodyTitle">{isToday ? "Medidas de hoy" : "Medidas del " + formatShortDate(date)}</h2>
        <p>{formatShortDate(date)} · rellena solo las que quieras; deja vacía una medida para quitarla.</p>
        <div className="body-form">
          {BODY_FIELDS.map((f) => (
            <label key={f} className="form-label">{BODY_LABELS[f].label} ({BODY_LABELS[f].unit})
              <input type="text" inputMode="decimal" maxLength={6} pattern="[0-9]*[.,]?[0-9]*" value={values[f]}
                onChange={(e) => setValues({ ...values, [f]: e.target.value.replace(/[^0-9.,]/g, "") })} />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          {canDelete && (
            <button type="button" className="danger-btn" onClick={async () => { if (await askConfirm({ title: "¿Borrar las medidas del " + formatShortDate(date) + "?", action: "Borrar", danger: true })) onSave(null); }}>Borrar</button>
          )}
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit">Guardar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
