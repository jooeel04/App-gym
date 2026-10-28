"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createGroup, groupLeaderboard, joinGroup, leaveGroup, myGroups, type GroupInfo, type LeaderRow } from "@/app/actions/social";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, parseISODate, toISODate } from "@/domain/calendar";
import { closeOnBackdrop } from "./backdrop";
import { MedalIcon, UsersIcon } from "./icons";

// Oro, plata y bronce para los tres primeros puestos.
const MEDALS = ["gold", "silver", "bronze"];

// Primer y último día del mes de `today`.
function monthRange(today: string) {
  const d = parseISODate(today);
  const from = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = addDays(toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 1)), -1);
  return { from, to, label: d.toLocaleDateString("es-ES", { month: "long" }) };
}

// Clasificación con amigos: grupos con un código y ranking de días entrenados este mes.
export function LeaderboardCard() {
  const { mode, email, today } = useWorkout();
  const [groups, setGroups] = useState<GroupInfo[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [form, setForm] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (select?: string) => {
    const res = await myGroups().catch(() => null);
    if (!res?.ok) { setError("No se pudo cargar la clasificación (¿sin conexión?)."); return; }
    setGroups(res.data ?? []);
    setActive((current) => select ?? (current && res.data?.some((g) => g.code === current) ? current : res.data?.[0]?.code ?? null));
  }, []);

  useEffect(() => {
    if (mode === "cloud") queueMicrotask(() => { void refresh(); });
  }, [mode, refresh]);

  useEffect(() => {
    if (!active || !today) return;
    const { from, to } = monthRange(today);
    groupLeaderboard(active, from, to).then((res) => setRows(res.ok ? res.data ?? [] : [])).catch(() => setRows([]));
  }, [active, today]);

  if (mode !== "cloud" || !today) return null;
  const group = groups?.find((g) => g.code === active);
  const month = monthRange(today).label;

  return (
    <section className="chart">
      <div className="charttitle"><h2><UsersIcon /> Clasificación con amigos</h2><span>Días entrenados en {month}</span></div>

      {groups && groups.length > 1 && (
        <div className="daychips">
          {groups.map((g) => (
            <button key={g.code} type="button" className={"daychip" + (g.code === active ? " active" : "")} onClick={() => setActive(g.code)}>{g.name}</button>
          ))}
        </div>
      )}

      {group ? (
        <>
          <ol className="leaders">
            {(rows ?? []).map((r, i) => (
              <li key={i} className={r.is_me ? "me" : ""}>
                <span className={"medal " + (MEDALS[i] ?? "")} aria-label={"Puesto " + (i + 1)}>{MEDALS[i] ? <MedalIcon /> : i + 1}</span>
                <b>{r.display_name}{r.is_me && <small> (tú)</small>}</b>
                <span className="leader-days">{r.days} <small>{r.days === 1 ? "día" : "días"}</small></span>
              </li>
            ))}
            {rows === null && <li className="empty">Cargando…</li>}
          </ol>
          <div className="group-foot">
            <span>Código del grupo <b>{group.code}</b> · {group.members} {group.members === 1 ? "miembro" : "miembros"}</span>
            <button type="button" className="auth-link" onClick={() => navigator.clipboard.writeText(group.code).catch(() => {})}>Copiar código</button>
            <button type="button" className="auth-link danger-link" onClick={async () => {
              if (!confirm("¿Salir del grupo «" + group.name + "»?")) return;
              await leaveGroup(group.code).catch(() => null);
              setRows(null);
              void refresh();
            }}>Salir</button>
          </div>
        </>
      ) : groups && (
        <p className="body-hint">Crea un grupo y pasa el código a tus amigos, o únete al de alguien. Solo veréis vuestros nombres y cuántos días ha entrenado cada uno.</p>
      )}

      {error && <p className="auth-msg error">{error}</p>}
      <div className="modal-actions">
        <button type="button" onClick={() => setForm("join")}>Unirme a un grupo</button>
        <button className="primary" type="button" onClick={() => setForm("create")}>Crear grupo</button>
      </div>
      {form && <GroupForm kind={form} defaultName={(email ?? "").split("@")[0]} onClose={() => setForm(null)}
        onDone={(code) => { setForm(null); setRows(null); void refresh(code); }} />}
    </section>
  );
}

function GroupForm({ kind, defaultName, onClose, onDone }: { kind: "create" | "join"; defaultName: string; onClose: () => void; onDone: (code: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const display = form.get("display"), value = form.get("value");
    const res = await (kind === "create" ? createGroup(value, display) : joinGroup(value, display)).catch(() => ({ ok: false, error: "Sin conexión.", data: undefined }));
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "No se pudo completar."); return; }
    onDone(kind === "create" ? (res.data as string) : String(value).trim().toUpperCase());
  };
  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="groupTitle" {...closeOnBackdrop(onClose)}>
      <form className="modal" onSubmit={submit}>
        <h2 id="groupTitle">{kind === "create" ? "Crear grupo" : "Unirme a un grupo"}</h2>
        <label className="form-label">{kind === "create" ? "Nombre del grupo" : "Código del grupo"}
          <input name="value" required maxLength={kind === "create" ? 40 : 6} autoFocus placeholder={kind === "create" ? "Los del gym" : "ABC123"}
            style={kind === "join" ? { textTransform: "uppercase" } : undefined} />
        </label>
        <label className="form-label">Tu nombre en la clasificación
          <input name="display" required maxLength={30} defaultValue={defaultName} />
        </label>
        {error && <p className="auth-msg error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit" disabled={busy}>{busy ? "Un momento…" : kind === "create" ? "Crear" : "Unirme"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
