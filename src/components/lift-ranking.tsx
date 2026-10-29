"use client";

import { useState } from "react";
import { MedalIcon } from "./icons";

export interface LiftRow {
  exercise: string;
  display_name: string;
  weight: number;
  reps: number | null;
  is_me: boolean;
}

const MEDALS = ["gold", "silver", "bronze"];
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const kg = (n: number) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Quién levanta más en cada ejercicio del grupo: la mejor serie (más peso; con el mismo
// peso, más repeticiones) de cada amigo. El mismo ejercicio se junta aunque cada uno lo
// haya escrito distinto. Primero salen los ejercicios que hacen más personas.
export function LiftRanking({ rows }: { rows: LiftRow[] }) {
  const groups = new Map<string, { name: string; rows: LiftRow[] }>();
  for (const r of rows) {
    const k = key(r.exercise);
    const g = groups.get(k) ?? { name: r.exercise.trim(), rows: [] };
    if (r.is_me) g.name = r.exercise.trim();
    g.rows.push(r);
    groups.set(k, g);
  }
  const list = [...groups.entries()]
    .map(([k, g]) => ({ key: k, name: g.name, rows: [...g.rows].sort((a, b) => b.weight - a.weight || (b.reps ?? 0) - (a.reps ?? 0)) }))
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, "es"));
  const [picked, setPicked] = useState<string | null>(null);
  const current = list.find((g) => g.key === picked) ?? list[0];

  if (!current) return <p className="body-hint">Cuando anotéis series con peso, aquí veréis quién levanta más en cada ejercicio.</p>;
  return (
    <div className="lift-ranking">
      <div className="daychips" role="tablist" aria-label="Ejercicio">
        {list.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={g === current} className={"daychip" + (g === current ? " active" : "")} onClick={() => setPicked(g.key)}>
            {g.name}{g.rows.length > 1 && <small> · {g.rows.length}</small>}
          </button>
        ))}
      </div>
      <ol className="leaders" aria-label={"Quién levanta más en " + current.name}>
        {current.rows.map((r, i) => (
          <li key={i} className={r.is_me ? "me" : ""}>
            <span className={"medal " + (MEDALS[i] ?? "")} aria-label={"Puesto " + (i + 1)}>{MEDALS[i] ? <MedalIcon /> : i + 1}</span>
            <b>{r.display_name}{r.is_me && <small> (tú)</small>}</b>
            <span className="leader-days">{kg(r.weight)} kg{r.reps ? " × " + r.reps : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
