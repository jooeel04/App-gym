"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { randomQuote } from "@/domain/daily-quote";
import { raiseTargets } from "@/domain/progression";
import { getPlatePrefs } from "@/lib/preferences";
import { fmt } from "./exercise-progress";
import { TrendUpIcon } from "./icons";

// Lo que Hoy enseña antes de empezar (spec hoy R33–R35): la frase del día, la semana y en
// qué ejercicios toca subir peso.

// La frase (R35): una al azar por cada vez que se abre la app (igual al cambiar de pestaña),
// distinta de la de la vez anterior en este dispositivo.
const QUOTE_KEY = "rutina:quote";
let sessionQuote: string | null = null;
function quoteOfThisVisit() {
  if (sessionQuote) return sessionQuote;
  let previous: string | null = null;
  try { previous = localStorage.getItem(QUOTE_KEY); } catch { /* Sin almacenamiento, sin recuerdo. */ }
  sessionQuote = randomQuote(Math.random, previous);
  try { localStorage.setItem(QUOTE_KEY, sessionQuote); } catch { /* Igual, la próxima puede repetirse. */ }
  return sessionQuote;
}

export function DailyQuote() {
  const [quote] = useState(quoteOfThisVisit);
  return <p className="daily-quote">{quote}</p>;
}

// «Hoy puedes subir peso» (R34): ejercicios de hoy sin hacer cuyo consejo es subir. Al tocar
// uno, `onOpen` lo abre en la lista.
export function RaiseCard({ onOpen }: { onOpen: (id: number) => void }) {
  const { model, stats, week, day, round } = useWorkout();
  const pending = model.exercisesOfDay(day).filter((x) => !model.isExerciseDone(week, day, x, round));
  const smallest = Math.min(...getPlatePrefs().plates);
  const targets = raiseTargets(pending, (x) => stats.lastBefore(x, week, round), smallest);
  if (!targets.length) return null;
  const kg = (n: number) => fmt(n).replace(".", ",");
  return (
    <section className="raise-card" aria-label="Hoy puedes subir peso">
      <h3><TrendUpIcon />Hoy puedes subir peso</h3>
      {targets.map(({ exercise, from, to }) => (
        <button key={exercise.id} type="button" className="raise-row" onClick={() => onOpen(exercise.id)}>
          <span>{exercise.name}</span>
          <b>{kg(from)} → {kg(to)} kg</b>
        </button>
      ))}
    </section>
  );
}
