"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { navigateTab, useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES } from "@/domain/snapshot";
import { ArrowIcon } from "./icons";

// Hueco fijo de abajo, encima de la barra de pestañas (bajo el pulgar): ahí va el botón
// principal de cada momento del entreno: «Serie hecha», el descanso (RestTimerBar ocupa el
// mismo sitio), «Deshacer» y, desde otras pestañas, «Seguir entreno». Lo pone AppShell.
export const DOCK_ID = "dock";

// El hueco se busca tras montar (en el primer pintado puede no estar aún en la página).
const subscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => {};
};
const findDock = () => document.getElementById(DOCK_ID);

// Pinta `children` en el hueco fijo; si no hay hueco (p. ej. una prueba suelta), en su sitio.
export function InDock({ children }: { children: ReactNode }) {
  const dock = useSyncExternalStore(subscribe, findDock, () => null);
  return dock ? createPortal(children, dock) : <>{children}</>;
}

// En las demás pestañas, con un entreno en curso: vuelve a Hoy, al ejercicio en el que se iba.
// Durante el descanso no sale: en ese sitio está la cuenta atrás.
export function ContinueWorkout({ onToday }: { onToday: boolean }) {
  const { model, active, rest, day, actions } = useWorkout();
  if (!active || onToday || rest) return null;
  const next = model.exercisesOfDay(active.day).find((x) => !model.isExerciseDone(active.week, active.day, x));
  const go = () => {
    if (active.day !== day) actions.selectDay(active.day);
    navigateTab("/entrenar");
  };
  return (
    <InDock>
      <button type="button" className="dock-continue" onClick={go}>
        <span><small>Seguir entreno</small><b>{next?.name ?? DAY_NAMES[active.day]}</b></span>
        <ArrowIcon dir="right" />
      </button>
    </InDock>
  );
}
