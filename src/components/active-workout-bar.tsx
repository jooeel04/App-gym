"use client";

import { useEffect, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES } from "@/domain/snapshot";

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s % 60).padStart(2, "0");
};

// Barra flotante del entreno en curso: tiempo transcurrido, ejercicios hechos y
// botones para abrirlo a pantalla completa o terminarlo. Mientras dura, la pantalla no se apaga.
export function ActiveWorkoutBar() {
  const { active, model, actions } = useWorkout();
  const [now, setNow] = useState(() => Date.now());
  const startedAt = active?.startedAt;

  useEffect(() => {
    if (!startedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  useScreenAwake(!!startedAt);

  if (!active) return null;
  const list = model.exercisesOfDay(active.day);
  const done = list.filter((x) => model.isExerciseDone(active.week, active.day, x)).length;

  return (
    <div className="livebar" role="status" aria-label={"Entreno en curso: " + DAY_NAMES[active.day] + ", " + done + " de " + list.length + " ejercicios"}>
      <button type="button" className="live-info" onClick={actions.openWorkout} aria-label="Abrir el entreno en curso a pantalla completa">
        <span className="live-dot" aria-hidden="true" />
        <span className="live-text">
          <small>En curso · {DAY_NAMES[active.day]}</small>
          <strong>{clock(now - active.startedAt)}</strong>
        </span>
        <span className="live-count">{done}/{list.length}<small>ejercicios</small></span>
      </button>
      <button type="button" className="live-finish" onClick={actions.finishWorkout}>Terminar</button>
    </div>
  );
}

// Mantiene la pantalla encendida (Screen Wake Lock) mientras `on` sea true. El
// navegador suelta el bloqueo al pasar a segundo plano, así que se pide de nuevo al volver.
function useScreenAwake(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      navigator.wakeLock.request("screen")
        .then((l) => { if (stopped) void l.release(); else lock = l; })
        .catch(() => {}); // Sin permiso o sin batería: la pantalla se apaga como siempre.
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      if (lock) void lock.release().catch(() => {});
    };
  }, [on]);
}
