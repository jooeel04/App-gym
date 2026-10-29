"use client";

import { useState } from "react";
import { EXERCISE_GROUPS, exerciseGroup, type ExerciseGroup } from "@/domain/exercise-library";
import { ChevronIcon, MedalIcon } from "./icons";

export interface LiftRow {
  exercise: string;
  display_name: string;
  weight: number;
  reps: number | null;
  is_me: boolean;
}

const MEDALS = ["gold", "silver", "bronze"];
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const mark = (r: LiftRow) => Number(r.weight).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " kg" + (r.reps ? " × " + r.reps : "");

// Quién levanta más, de un vistazo: una fila por ejercicio con quién va primero (su mejor
// serie: más peso; con el mismo peso, más repeticiones) y, al lado, tu puesto y tu marca.
// El mismo ejercicio se junta aunque cada uno lo haya escrito distinto. Primero los que
// hacen más personas. Al tocar una fila se ve el ranking completo de ese ejercicio.
// Los ejercicios van divididos por grupo muscular (Pecho, Espalda, Pierna…), y con los
// botones de arriba se puede ver solo un grupo.
export function LiftRanking({ rows }: { rows: LiftRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [only, setOnly] = useState<ExerciseGroup | null>(null);
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

  if (!list.length) return <p className="body-hint">Cuando anotéis series con peso, aquí veréis quién levanta más en cada ejercicio.</p>;
  const sections = EXERCISE_GROUPS
    .map((group) => ({ group, items: list.filter((g) => exerciseGroup(g.name) === group) }))
    .filter((s) => s.items.length);
  const shown = sections.filter((s) => !only || s.group === only);
  return (
    <div className="lift-groups">
      {sections.length > 1 && (
        <div className="daychips lift-chips" aria-label="Grupo muscular">
          {[null, ...sections.map((s) => s.group)].map((group) => (
            <button key={group ?? "todos"} type="button" className={"daychip" + (only === group ? " active" : "")} aria-pressed={only === group} onClick={() => setOnly(group)}>
              {group ?? "Todos"}
            </button>
          ))}
        </div>
      )}
      {shown.map((s) => (
        <section key={s.group} className="lift-group">
          <h3 className="lift-group-title">{s.group}</h3>
          <LiftList items={s.items} label={s.group} open={open} setOpen={setOpen} />
        </section>
      ))}
    </div>
  );
}

type Item = { key: string; name: string; rows: LiftRow[] };

function LiftList({ items, label, open, setOpen }: { items: Item[]; label: string; open: string | null; setOpen: (k: string | null) => void }) {
  return (
    <ul className="lift-list" aria-label={label}>
      {items.map((g) => {
        const leader = g.rows[0];
        const me = g.rows.findIndex((r) => r.is_me);
        const isOpen = open === g.key;
        return (
          <li key={g.key} className={"lift-row" + (isOpen ? " open" : "") + (me === 0 ? " winning" : "")}>
            <button type="button" className="lift-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.key)}>
              <span className="lift-ex">
                <b>{g.name}</b>
                <small>{g.rows.length} {g.rows.length === 1 ? "persona" : "personas"}</small>
              </span>
              <span className="lift-leader">
                <span className="medal gold" aria-hidden="true"><MedalIcon /></span>
                <span><b>{leader.is_me ? "Tú" : leader.display_name}</b><small>{mark(leader)}</small></span>
              </span>
              <ChevronIcon />
            </button>
            {me === 0 && <p className="lift-me first">¡Vas primero!</p>}
            {me > 0 && <p className="lift-me">Tú · {me + 1}º · {mark(g.rows[me])}</p>}
            {isOpen && (
              <ol className="leaders lift-full" aria-label={"Ranking de " + g.name}>
                {g.rows.map((r, i) => (
                  <li key={i} className={r.is_me ? "me" : ""}>
                    <span className={"medal " + (MEDALS[i] ?? "")} aria-label={"Puesto " + (i + 1)}>{MEDALS[i] ? <MedalIcon /> : i + 1}</span>
                    <b>{r.display_name}{r.is_me && <small> (tú)</small>}</b>
                    <span className="leader-days">{mark(r)}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}
