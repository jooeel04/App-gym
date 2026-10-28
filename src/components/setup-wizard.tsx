"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSharedRoutine } from "@/app/actions/social";
import { useWorkout } from "@/controllers/workout-controller";
import { WEEKDAY_NAMES, WEEKDAY_SHORT, WEEKDAYS } from "@/domain/calendar";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { NewExerciseInput, WeekSchedule } from "@/domain/types";
import { CheckIcon, ClipboardIcon, PartyIcon, PencilIcon, SleepIcon, UsersIcon } from "./icons";

type Shared = NewExerciseInput & { day: number };
type Choice = "base" | "friend" | "empty";

// El asistente ya se hizo (o se saltó) en este dispositivo con esta cuenta.
const EVENT = "rutina-setup";
const keyFor = (email: string | null) => "rutina:setup:" + (email ?? "local");
const readDone = (email: string | null) => {
  try {
    return localStorage.getItem(keyFor(email)) === "1";
  } catch {
    return true; // Sin almacenamiento no se insiste con el asistente.
  }
};
function markDone(email: string | null) {
  try {
    localStorage.setItem(keyFor(email), "1");
  } catch {
    // Sin almacenamiento el asistente se cierra igual hasta recargar.
  }
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Asistente para cuentas nuevas (sin ningún dato): qué días entrena, qué rutina quiere
// y cómo queda la semana. Se puede saltar.
export function SetupWizard() {
  const { model, mode, email, actions } = useWorkout();
  const done = useSyncExternalStore(subscribe, () => readDone(email), () => true);
  const snap = model.snapshot;
  const fresh = Object.keys(snap.entries).length === 0 && Object.keys(snap.checked ?? {}).length === 0
    && Object.keys(snap.completed).length === 0 && Object.keys(snap.body ?? {}).length === 0;
  const [step, setStep] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>(() => WEEKDAYS.filter((wd) => DAYS.some((d) => model.weekdayFor(d) === wd)));
  const [choice, setChoice] = useState<Choice>("base");
  const [code, setCode] = useState("");
  const [friend, setFriend] = useState<Shared[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Una cuenta con datos ya está configurada: no se le ofrece el asistente (tampoco si
  // más adelante borra sus registros).
  useEffect(() => { if (!done && !fresh) markDone(email); }, [done, fresh, email]);
  if (done || !fresh) return null;

  const cloud = mode === "cloud";
  const toggle = (wd: number) => {
    setError("");
    if (weekdays.includes(wd)) setWeekdays(weekdays.filter((x) => x !== wd));
    else if (weekdays.length >= DAYS.length) setError("Como mucho " + DAYS.length + " días: uno por cada rutina.");
    else setWeekdays([...weekdays, wd].sort((a, b) => a - b));
  };
  // Cada rutina (en orden) va al siguiente día elegido; las que sobran, sin día fijo.
  const schedule = Object.fromEntries(DAYS.map((d, i) => [d, weekdays[i] ?? 0])) as WeekSchedule;
  // Con la rutina de un amigo puede haber días sin ejercicios.
  const emptyDay = (d: number) => choice === "empty" || (choice === "friend" && !!friend && !friend.some((x) => x.day === d));
  const skip = () => markDone(email);

  const next = async () => {
    setError("");
    if (step === 1) {
      if (!weekdays.length) { setError("Elige al menos un día."); return; }
      setStep(2);
    } else if (step === 2) {
      if (choice === "friend") {
        setBusy(true);
        const res = await getSharedRoutine(code.trim().toUpperCase()).catch(() => ({ ok: false, error: "Sin conexión.", data: undefined }));
        setBusy(false);
        if (!res.ok || !res.data?.length) { setError(res.error ?? "No hay ninguna rutina con ese código."); return; }
        setFriend(res.data as Shared[]);
      }
      setStep(3);
    } else {
      actions.finishSetup(schedule, choice === "empty" ? "empty" : choice === "friend" ? friend : null);
      markDone(email);
    }
  };

  return (
    <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizardTitle">
      <div className="wizard-top">
        <div className="wizard-dots" aria-label={"Paso " + step + " de 3"}>{[1, 2, 3].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
        <button type="button" className="wizard-skip" onClick={skip}>Saltar</button>
      </div>

      {step === 1 && (
        <>
          <h1 id="wizardTitle">¿Qué días entrenas?</h1>
          <p className="wizard-sub">Toca los días que vas al gym.</p>
          <div className="wizard-days">
            {WEEKDAYS.map((wd) => (
              <button key={wd} type="button" aria-pressed={weekdays.includes(wd)} aria-label={capitalize(WEEKDAY_NAMES[wd])}
                className={weekdays.includes(wd) ? "on" : ""} onClick={() => toggle(wd)}>
                {WEEKDAY_SHORT[wd]}{weekdays.includes(wd) && <CheckIcon className="wizard-day-check" />}
              </button>
            ))}
          </div>
          {/* Cuántos días van, además del color y la marca de cada uno. */}
          <p className="wizard-count" aria-live="polite">
            {weekdays.length === 0 ? "Ningún día elegido" : weekdays.length + (weekdays.length === 1 ? " día" : " días") + " a la semana"}
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <h1 id="wizardTitle">¿Qué rutina quieres?</h1>
          <p className="wizard-sub">Puedes cambiarla cuando quieras en Rutina.</p>
          <button type="button" className={"wizard-opt" + (choice === "base" ? " on" : "")} onClick={() => setChoice("base")}>
            <span aria-hidden="true"><ClipboardIcon /></span><span><b>Rutina recomendada</b><small>{DAYS.length} días: {DAYS.map((d) => DAY_NAMES[d].toLowerCase()).join(", ")}</small></span>
          </button>
          {cloud && (
            <button type="button" className={"wizard-opt" + (choice === "friend" ? " on" : "")} onClick={() => setChoice("friend")}>
              <span aria-hidden="true"><UsersIcon /></span><span><b>La de un amigo</b><small>Escribe su código de 6 letras</small></span>
            </button>
          )}
          {choice === "friend" && (
            <input className="exsearch wizard-code" value={code} maxLength={6} placeholder="ABC123" aria-label="Código de la rutina"
              onChange={(e) => setCode(e.target.value.toUpperCase())} />
          )}
          <button type="button" className={"wizard-opt" + (choice === "empty" ? " on" : "")} onClick={() => setChoice("empty")}>
            <span aria-hidden="true"><PencilIcon /></span><span><b>Empezar vacía</b><small>Añades tú los ejercicios</small></span>
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 id="wizardTitle">¡Listo! <PartyIcon className="wizard-party" /></h1>
          <p className="wizard-sub">Así queda tu semana:</p>
          <div className="wizard-plan">
            {WEEKDAYS.map((wd) => {
              const d = DAYS.find((x) => schedule[x] === wd);
              return (
                <div key={wd}>
                  <span>{capitalize(WEEKDAY_NAMES[wd])}</span>
                  {d ? <b><i style={{ background: "var(--day" + d + ")" }} />{DAY_NAMES[d]}{emptyDay(d) && <small> (vacía)</small>}</b> : <b><SleepIcon /> Descanso</b>}
                </div>
              );
            })}
          </div>
          {DAYS.some((d) => !schedule[d]) && (
            <p className="wizard-sub">Sin día fijo: {DAYS.filter((d) => !schedule[d]).map((d) => DAY_NAMES[d]).join(", ")}. Puedes hacerlas cuando quieras.</p>
          )}
        </>
      )}

      {error && <p className="auth-msg error" role="alert">{error}</p>}
      <div className="wizard-actions">
        {step > 1 && <button type="button" onClick={() => { setError(""); setStep(step - 1); }}>Atrás</button>}
        <button type="button" className="primary" onClick={next} disabled={busy || (step === 2 && choice === "friend" && code.trim().length < 6)}>
          {busy ? "Buscando…" : step === 3 ? "Empezar a entrenar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
