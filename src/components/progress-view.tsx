"use client";

import { useRef } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { ActivityCalendar } from "./activity-calendar";
import { DailyLog } from "./daily-log";
import { ExerciseProgress } from "./exercise-progress";
import { ProgressSummary, TrendChart } from "./progress-charts";

// Vista "Progreso": resumen de la semana y el mes, evolución de cargas y repeticiones,
// calendario de días entrenados, progreso por ejercicio, registro diario y datos.
export function ProgressView() {
  const { mode, email, actions } = useWorkout();
  const fileInput = useRef<HTMLInputElement>(null);
  const cloud = mode === "cloud";

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu avance</div>
          <h1>Progreso</h1>
          <p className="lede">Cargas y repeticiones semana a semana y mes a mes, y lo que hiciste la última vez en cada ejercicio.</p>
        </div>
      </div>

      <ProgressSummary />

      <TrendChart />

      <ActivityCalendar />

      <ExerciseProgress />

      <DailyLog />

      <section className="chart">
        <div className="charttitle"><h2>Tus datos</h2><span>{cloud ? "Guardados en tu cuenta" : "Guardados localmente"}</span></div>
        {cloud && email && (
          <div className="account">
            <span>Sesión iniciada como <strong>{email}</strong></span>
            <button className="quiet" type="button" onClick={actions.signOut}>Cerrar sesión</button>
          </div>
        )}
        <div className="note-box">
          {cloud
            ? "Tus registros se guardan solo en tu cuenta: nadie más los ve, y los tienes en cualquier dispositivo donde inicies sesión."
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
