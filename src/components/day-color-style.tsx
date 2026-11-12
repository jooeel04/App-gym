"use client";

import { useWorkout } from "@/controllers/workout-controller";

// Pinta el color elegido de cada día de rutina (spec rutina R7): `--dayN` apunta a su
// color de la lista (`--c-<color>`, con versión para tema oscuro y claro en globals.css).
// Todo lo que usa `--dayN` (Hoy, Rutina, el calendario de Progreso…) cambia solo.
// `html:root` gana a la definición por defecto de `--dayN` en `:root`.
export function DayColorStyle() {
  const { model } = useWorkout();
  const css = model.days.map((d) => "--day" + d + ":var(--c-" + model.dayColor(d) + ")").join(";");
  return <style data-day-colors="">{"html:root{" + css + "}"}</style>;
}
