"use client";

import { useRef } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { percent } from "@/domain/workout-stats";
import { ActivityCalendar } from "./activity-calendar";
import { DailyLog } from "./daily-log";
import { DayProgressCharts } from "./day-progress-charts";

const small = { fontSize: 12, fontWeight: 500 };

// Vista "Progreso": totales, calendario de días entrenados, progreso por día de rutina,
// registro diario y herramientas de datos.
export function ProgressView() {
  const { model, stats, week, mode, actions } = useWorkout();
  const fileInput = useRef<HTMLInputElement>(null);
  const all = stats.all(), cur = stats.week(week);
  const cloud = mode === "cloud";

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Resumen del ciclo</div>
          <h1>Progreso</h1>
          <p className="lede">Series anotadas y cargas registradas durante {model.weeksCount} semanas.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Series anotadas</span><strong>{all.n} <small style={small}>/ {all.p}</small></strong><small>en todo el ciclo</small></div>
        <div className="stat"><span>Semana actual</span><strong>{cur.n} <small style={small}>/ {cur.p}</small></strong><small>Semana {week} · {percent(cur.n, cur.p)}% de series</small></div>
      </div>

      <ActivityCalendar />

      <DayProgressCharts />

      <DailyLog />

      <section className="chart">
        <div className="charttitle"><h2>Tus datos</h2><span>{cloud ? "Sincronizados en la nube" : "Guardados localmente"}</span></div>
        <div className="note-box">
          {cloud
            ? "Los registros se guardan en tu base de datos de Supabase y los ves igual desde cualquier dispositivo."
            : "Los registros quedan en el almacenamiento local de este navegador y dispositivo. Para cambiar de móvil, descarga una copia y restáurala en el otro. No se envían a ningún servidor."}
        </div>
        <div className="tools">
          <button className="quiet" onClick={actions.exportJson}>Descargar copia JSON</button>
          <button className="quiet" onClick={actions.exportCsv}>Exportar a CSV</button>
          <button className="quiet" onClick={() => fileInput.current?.click()}>Restaurar copia</button>
          <button className="quiet danger" onClick={actions.clearData}>Borrar registros</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.importFile(file);
            e.target.value = "";
          }}
        />
      </section>
    </section>
  );
}
