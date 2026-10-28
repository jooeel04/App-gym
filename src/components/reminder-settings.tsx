"use client";

import { useEffect, useState } from "react";
import { getReminder, saveReminder } from "@/app/actions/reminders";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS } from "@/domain/calendar";
import { requestPermissions } from "@/lib/permissions";
import { DEFAULT_REMINDER, subscribeThisDevice, type ReminderMode, type ReminderSettings } from "@/lib/push";
import { AlarmIcon } from "./icons";
import { Row } from "./settings-rows";

const MODES: { value: ReminderMode; label: string; hint: string }[] = [
  { value: "training", label: "Mis días de entreno", hint: "Solo los días que tienen rutina en tu calendario" },
  { value: "daily", label: "Todos los días", hint: "De lunes a domingo" },
  { value: "custom", label: "Elegir días", hint: "Tú decides qué días" },
];

const summary = (r: ReminderSettings) => !r.enabled ? "Desactivado"
  : r.time + " · " + (r.mode === "daily" ? "todos los días" : r.mode === "training" ? "días de entreno" : r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(" "));

// Recordatorio diario: una notificación en el móvil a la hora elegida para entrenar,
// aunque la app esté cerrada. Se guarda en la cuenta; el aviso llega a este dispositivo.
export function ReminderRow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [saved, setSaved] = useState<ReminderSettings | null>(null);
  const [draft, setDraft] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getReminder()
      .then((res) => {
        const r = res.ok && res.data ? res.data : DEFAULT_REMINDER;
        setSaved(r);
        setDraft(r);
      })
      .catch(() => setSaved(DEFAULT_REMINDER));
  }, []);

  const set = (patch: Partial<ReminderSettings>) => { setDraft({ ...draft, ...patch }); setMessage(null); };
  const toggleDay = (d: number) => set({ weekdays: draft.weekdays.includes(d) ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d] });

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Al activarlo se piden los permisos y se registra este móvil para recibir el aviso.
      let device;
      if (draft.enabled) {
        const permission = await requestPermissions();
        if (permission !== "granted") {
          setMessage({ ok: false, text: permission === "unsupported"
            ? "Este navegador no permite notificaciones. En iPhone, añade antes la app a la pantalla de inicio (mira «Permisos»)."
            : "Necesitas permitir las notificaciones (mira «Permisos»)." });
          return;
        }
        device = await subscribeThisDevice();
        if (!device) { setMessage({ ok: false, text: "Este móvil no puede recibir avisos con la app cerrada." }); return; }
      }
      const res = await saveReminder(draft, Intl.DateTimeFormat().resolvedOptions().timeZone, device);
      if (!res.ok) { setMessage({ ok: false, text: res.error ?? "No se pudo guardar." }); return; }
      setSaved(draft);
      setMessage({ ok: true, text: draft.enabled ? "¡Listo! Te avisaremos a las " + draft.time + "." : "Recordatorio desactivado." });
    } catch {
      setMessage({ ok: false, text: "No se pudo guardar (¿sin conexión?)." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row icon={<AlarmIcon />} label="Recordatorio para entrenar" value={saved ? summary(saved) : "…"} open={open} onClick={onToggle}>
      <p className="set-hint">Te llega una notificación al móvil a la hora que elijas, aunque tengas la app cerrada.</p>
      <label className="switch-row">
        <span><b>Recordarme entrenar</b><small>{draft.enabled ? "Activado" : "Desactivado"}</small></span>
        <input type="checkbox" role="switch" className="switch" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
      </label>
      {draft.enabled && (
        <>
          <label className="switch-row">
            <span><b>Hora del aviso</b><small>Hora de este móvil</small></span>
            <input type="time" className="time-input" value={draft.time} required onChange={(e) => e.target.value && set({ time: e.target.value })} />
          </label>
          <div className="set-sub">¿Qué días?</div>
          <div className="choice-list" role="radiogroup" aria-label="Qué días">
            {MODES.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={draft.mode === m.value}
                className={"choice" + (draft.mode === m.value ? " active" : "")} onClick={() => set({ mode: m.value })}>
                <span>{m.label}<small>{m.hint}</small></span><span className="choice-check" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
          {draft.mode === "custom" && (
            <div className="day-toggles" role="group" aria-label="Días del aviso">
              {WEEKDAYS.map((d) => (
                <button key={d} type="button" aria-pressed={draft.weekdays.includes(d)} aria-label={WEEKDAY_NAMES[d]}
                  className={draft.weekdays.includes(d) ? "on" : ""} onClick={() => toggleDay(d)}>
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>
          )}
          <label className="switch-row">
            <span><b>No avisar si ya entrené</b><small>Si ese día ya anotaste alguna serie, no llega el aviso</small></span>
            <input type="checkbox" role="switch" className="switch" checked={draft.skipIfTrained} onChange={(e) => set({ skipIfTrained: e.target.checked })} />
          </label>
        </>
      )}
      <button type="button" className="set-done" disabled={busy || (draft.enabled && draft.mode === "custom" && draft.weekdays.length === 0)} onClick={save}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
      {message && <p className={message.ok ? "perm-ok" : "perm-warn"}>{message.text}</p>}
    </Row>
  );
}
