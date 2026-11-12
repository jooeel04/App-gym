"use client";

import { useState, useSyncExternalStore } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DEFAULT_ENERGY, getEnergyPrefs, subscribePrefs } from "@/lib/preferences";

// Campo para apuntar las kcal que dice el reloj en una fecha (spec hoy R32, progreso R12).
// Solo sale si se activó en Ajustes → Calorías. Vacío y «Guardar kcal» las borra.
export function WatchKcalInput({ date }: { date: string }) {
  const { model, actions } = useWorkout();
  const prefs = useSyncExternalStore(subscribePrefs, getEnergyPrefs, () => DEFAULT_ENERGY);
  const saved = model.watchKcal(date);
  const [value, setValue] = useState(saved ? String(saved) : "");
  if (!prefs.watchInput) return null;
  const n = Number(value);
  const valid = value.trim() === "" || (Number.isInteger(n) && n >= 1 && n <= 9999);
  return (
    <div className="watch-kcal">
      <label>
        <span>kcal del reloj</span>
        <input type="number" inputMode="numeric" min="1" max="9999" step="1" placeholder="—" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="button" disabled={!valid} onClick={() => actions.setWatchKcal(date, value.trim() ? n : null)}>Guardar kcal</button>
    </div>
  );
}
