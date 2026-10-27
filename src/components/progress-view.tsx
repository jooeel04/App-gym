"use client";

import { useRef } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import { percent } from "@/domain/workout-stats";

const small = { fontSize: 12, fontWeight: 500 };

// Vista "Progreso": totales, actividad por semana, historial de cargas y herramientas de datos.
export function ProgressView() {
  const { model, stats, week, account, actions } = useWorkout();
  const fileInput = useRef<HTMLInputElement>(null);
  const all = stats.all(), cur = stats.week(week);
  const history = stats.loadHistory();
  const cloud = account.mode === "cloud";

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
        <div className="stat"><span>Semana seleccionada</span><strong>{cur.n} <small style={small}>/ {cur.p}</small></strong><small>Semana {week} · {percent(cur.n, cur.p)}% de series</small></div>
      </div>

      <section className="chart">
        <div className="charttitle"><h2>Actividad por semana</h2><span>Series anotadas</span></div>
        <div className="bars">
          {Array.from({ length: model.weeksCount }, (_, i) => i + 1).map((w) => {
            const t = stats.week(w);
            return (
              <div className="weekcol" key={w}>
                <div className="barwrap"><div className={"bar" + (w === week ? " current" : "")} style={{ height: Math.max(3, percent(t.n, t.p)) + "%" }}><span className="barval">{t.n}</span></div></div>
                <span className="weeklabel">S{w}</span>
              </div>
            );
          })}
        </div>
        <div className="breakdown">
          {DAYS.map((d) => {
            const t = stats.day(week, d);
            return <div className="break" key={d}><span>Día {d}</span><strong>{t.n}<small> / {t.p}</small></strong><small>{DAY_NAMES[d]}</small></div>;
          })}
        </div>
      </section>

      <section className="chart">
        <div className="charttitle"><h2>Historial de cargas</h2><span>Primera a última carga</span></div>
        <div className="history">
          {history.length === 0 && <div className="empty">Al registrar una carga, aparecerá aquí la evolución por ejercicio.</div>}
          {history.map(({ exercise: x, first, last, delta }) => (
            <div className="historyrow" key={x.id}>
              <div><strong>{x.name}</strong><span>Día {x.day} · {DAY_NAMES[x.day]}</span></div>
              <div className="historyvalue">
                <span>{first} kg → {last} kg</span>
                {delta !== 0 && <b> {delta > 0 ? "+" : ""}{String(Number(delta.toFixed(1))).replace(".", ",")} kg</b>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="chart">
        <div className="charttitle"><h2>Tus datos</h2><span>{cloud ? "Sincronizados en la nube" : "Guardados localmente"}</span></div>
        <div className="note-box">
          {cloud
            ? <>Sesión iniciada como <strong>{account.email}</strong>. Los registros se guardan en tu cuenta y puedes verlos desde cualquier dispositivo.</>
            : "Los registros quedan en el almacenamiento local de este navegador y dispositivo. Para cambiar de móvil, descarga una copia y restáurala en el otro. No se envían a ningún servidor."}
        </div>
        <div className="tools">
          <button className="quiet" onClick={actions.exportJson}>Descargar copia JSON</button>
          <button className="quiet" onClick={actions.exportCsv}>Exportar a CSV</button>
          <button className="quiet" onClick={() => fileInput.current?.click()}>Restaurar copia</button>
          {cloud && <button className="quiet" onClick={actions.signOut}>Cerrar sesión</button>}
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
