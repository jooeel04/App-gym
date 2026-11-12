"use client";

import { useWorkout } from "@/controllers/workout-controller";
import { workoutKcal } from "@/domain/energy";
import { getRestPrefs } from "@/lib/preferences";

// Descanso que se usa si el temporizador está apagado.
const DEFAULT_REST = 90;

// Calorías estimadas de entrenos (spec hoy R31): da una función que, para un entreno
// (semana, día, vez), devuelve las de cada ejercicio y el total, con el último peso
// corporal y el descanso elegido. Sin peso apuntado, la función devuelve null.
export function useKcalOf() {
  const { model, stats } = useWorkout();
  const bodyWeight = model.latestBodyWeight();
  const rest = getRestPrefs();
  const restSeconds = rest.enabled ? rest.seconds : DEFAULT_REST;
  return (week: number, day: number, round = 1) => {
    if (!bodyWeight) return null;
    const items = stats.workSets(week, day, round).map(({ exercise, sets }) => ({ name: exercise.name, sets }));
    return workoutKcal(items, { bodyWeight, restSeconds });
  };
}
