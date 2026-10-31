"use client";

import { useEffect, useRef, useState } from "react";
import { getReminder, getReminderStatus, requestTestReminder, saveReminder, type ReminderStatus } from "@/app/actions/reminders";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS } from "@/domain/calendar";
import { notifyState, requestPermissions } from "@/lib/permissions";
import { currentEndpoint, DEFAULT_REMINDER, subscribeThisDevice, type ReminderMode, type ReminderSettings } from "@/lib/push";
import { AlarmIcon, CheckIcon } from "./icons";
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
                <span>{m.label}<small>{m.hint}</small></span><span className="choice-check" aria-hidden="true"><CheckIcon /></span>
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
      {saved?.enabled && <ReminderCheck />}
    </Row>
  );
}

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "hace un momento" : min < 60 ? "hace " + min + " min" : min < 1440 ? "hace " + Math.round(min / 60) + " h" : "hace " + Math.round(min / 1440) + " días";
};

type Check = { ok: boolean; label: string; text: string };

// Cada paso del camino del aviso: el móvil da permiso → está apuntado en la cuenta →
// Supabase revisa cada 5 minutos → la app lo manda al servicio de notificaciones del móvil.
function checksFor(s: ReminderStatus): Check[] {
  const permission = notifyState();
  const cronAge = s.cron?.last_run ? (Date.now() - new Date(s.cron.last_run).getTime()) / 60000 : Infinity;
  const httpOk = s.http?.status === 200;
  return [
    {
      ok: permission === "granted", label: "Permiso en este móvil",
      text: permission === "granted" ? "Este móvil deja que FitGym te avise."
        : permission === "denied" ? "Bloqueado. Ajustes del móvil → Notificaciones → FitGym → Permitir."
          : "Sin permiso todavía: mira «Permisos» más abajo.",
    },
    {
      ok: s.this_device, label: "Este móvil está apuntado",
      text: s.this_device ? "Tu cuenta sabe que tiene que avisar a este móvil."
        : "Este móvil no está apuntado para recibir avisos. Pulsa «Guardar» arriba para apuntarlo.",
    },
    {
      ok: !!s.cron?.active && s.keys_ok && cronAge < 15, label: "Servidor de avisos",
      text: !s.cron ? "La tarea que revisa los avisos no existe en Supabase (falta la migración de recordatorios)."
        : !s.keys_ok ? "Faltan las claves de los avisos en Supabase."
          : !s.cron.active ? "La tarea de Supabase que revisa los avisos está desactivada."
            : cronAge >= 15 ? "Supabase no revisa los avisos desde " + (s.cron.last_run ? ago(s.cron.last_run) : "nunca") + "."
              : "Supabase revisa los avisos cada 5 minutos (última vez " + ago(s.cron.last_run!) + ").",
    },
    {
      ok: httpOk && !s.last_error, label: "Envío al móvil",
      text: s.last_error ? "El servicio de notificaciones del móvil rechazó el aviso: " + s.last_error + "."
        : !s.http ? "La app aún no ha recibido ninguna llamada de Supabase."
          : !httpOk ? "La app no respondió bien a Supabase (" + (s.http.timed_out ? "tardó demasiado" : s.http.status ?? s.http.error ?? "sin respuesta") + ")."
            : s.last_attempt ? "Último aviso enviado " + ago(s.last_attempt) + "." : "La app responde bien. Aún no se ha enviado ningún aviso.",
    },
  ];
}

// «¿No te llega?»: comprueba el camino del aviso y manda uno de prueba de verdad.
function ReminderCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState<"check" | "test" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const check = async () => {
    setBusy("check");
    try {
      const res = await getReminderStatus(await currentEndpoint());
      if (res.ok && res.data) setChecks(checksFor(res.data));
      else setNote({ ok: false, text: res.error ?? "No se pudo comprobar." });
    } catch {
      setNote({ ok: false, text: "No se pudo comprobar (¿sin conexión?)." });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setNote(null);
    try {
      const res = await requestTestReminder();
      setNote(res.ok ? { ok: true, text: "Te llegará en unos segundos. Puedes salir de la app para verlo." } : { ok: false, text: res.error ?? "No se pudo pedir la prueba." });
      // Al rato se comprueba solo cómo fue el envío.
      if (res.ok) timer.current = setTimeout(() => { void check(); }, 20000);
    } catch {
      setNote({ ok: false, text: "No se pudo pedir la prueba (¿sin conexión?)." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="reminder-check">
      <div className="set-sub">¿No te llega?</div>
      <div className="reminder-check-actions">
        <button type="button" className="settings-btn" disabled={!!busy} onClick={() => { void test(); }}>{busy === "test" ? "Enviando…" : "Enviarme una prueba"}</button>
        <button type="button" className="settings-btn" disabled={!!busy} onClick={() => { void check(); }}>{busy === "check" ? "Comprobando…" : "Comprobar"}</button>
      </div>
      {note && <p className={note.ok ? "perm-ok" : "perm-warn"} role="status">{note.text}</p>}
      {checks && (
        <ul className="check-list" aria-label="Estado del recordatorio">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "ok" : "bad"}>
              <span className="check-mark" aria-hidden="true">{c.ok ? <CheckIcon /> : "!"}</span>
              <span><b>{c.label}</b><small>{c.text}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
