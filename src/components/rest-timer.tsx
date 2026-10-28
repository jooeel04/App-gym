"use client";

import { useEffect, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { restFinishedAlert } from "@/lib/alerts";
import { showNotification } from "@/lib/permissions";
import { getRestPrefs } from "@/lib/preferences";
import { GlassLayer } from "./glass-layer";

const clock = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

// Barra flotante con la cuenta atrás del descanso entre series. Vibra y pita (según
// Ajustes: al terminar o unos segundos antes) y avisa de que toca la siguiente serie.
export function RestTimerBar() {
  const { rest, actions } = useWorkout();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!rest) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    const { alert, before } = getRestPrefs();
    const early = before > 0 && before < rest.total;
    // Con la app en segundo plano el aviso llega como notificación del sistema.
    const notify = (title: string, body: string) => {
      if (alert !== "off" && document.visibilityState === "hidden") void showNotification(title, body);
    };
    const warn = early ? setTimeout(() => {
      restFinishedAlert(alert);
      notify("Quedan " + before + " s de descanso", "Prepárate para la siguiente serie");
      actions.showToast("Quedan " + before + " s de descanso", 2500, "clock");
    }, Math.max(0, rest.endsAt - before * 1000 - Date.now())) : undefined;
    const end = setTimeout(() => {
      if (!early) restFinishedAlert(alert);
      if (!early) notify("¡Descanso terminado!", "A por la siguiente serie");
      actions.showToast("¡Descanso terminado! A por la siguiente serie", 3500, "clock");
      actions.stopRest();
    }, Math.max(0, rest.endsAt - Date.now()));
    return () => { clearInterval(tick); clearTimeout(warn); clearTimeout(end); };
  }, [rest, actions]);

  if (!rest) return null;
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const progress = Math.min(1, left / rest.total);
  const R = 18, C = 2 * Math.PI * R;

  return (
    <div className="restbar" role="timer" aria-live="off" aria-label={"Descanso: quedan " + left + " segundos"}>
      <GlassLayer radius={26} />
      <svg className="rest-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={R} className="rest-ring-bg" />
        <circle cx="22" cy="22" r={R} className="rest-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
      </svg>
      <div className="rest-text"><small>Descanso</small><strong>{clock(left)}</strong></div>
      <button type="button" onClick={() => actions.addRest(15)}>+15 s</button>
      <button type="button" className="rest-skip" onClick={actions.stopRest}>Saltar</button>
    </div>
  );
}
