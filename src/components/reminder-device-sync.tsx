"use client";

import { useEffect, useState } from "react";
import { getReminder, registerDevice } from "@/app/actions/reminders";
import { needsHomeScreen, notifyState, requestPermissions } from "@/lib/permissions";
import { subscribeThisDevice } from "@/lib/push";
import { BellIcon } from "./icons";

const SNOOZE_KEY = "rutina:avisos-ahora-no";
const SNOOZE_MS = 3 * 24 * 3600_000;

function snoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

async function registerThisDevice() {
  const device = await subscribeThisDevice();
  if (device) await registerDevice(device);
  return !!device;
}

type Problem = "permission" | "blocked" | "home-screen";

// Al abrir la app, si el recordatorio está activado:
// - Con permiso: se vuelve a registrar este móvil. El navegador cambia de vez en cuando su
//   suscripción (sobre todo en iPhone) y la antigua deja de servir.
// - Sin permiso (p. ej. al borrar la app de la pantalla de inicio y volver a añadirla, el
//   iPhone olvida el permiso): una tarjeta lo pide con un botón, porque el navegador solo
//   deja pedirlo al tocar algo. Sin ella los avisos dejaban de llegar sin decir nada.
// Se hace un rato después de abrir para no frenar la carga.
export function ReminderDeviceSync({ delayMs = 4000 }: { delayMs?: number }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const state = notifyState();
        if (state !== "granted" && snoozed()) return;
        if (state === "unsupported" && !needsHomeScreen()) return;
        const res = await getReminder();
        if (!alive || !res.ok || !res.data?.enabled) return;
        if (state === "granted") await registerThisDevice();
        else setProblem(state === "denied" ? "blocked" : state === "unsupported" ? "home-screen" : "permission");
      } catch {
        // Sin conexión o sin sesión: se intentará la próxima vez que se abra.
      }
    }, delayMs);
    return () => { alive = false; clearTimeout(timer); };
  }, [delayMs]);

  if (!problem) return null;

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* Solo se esconde ahora. */ }
    setProblem(null);
  };
  const activate = async () => {
    setBusy(true);
    try {
      const state = await requestPermissions();
      if (state === "granted" && (await registerThisDevice())) setProblem(null);
      else if (state === "denied") setProblem("blocked");
    } catch {
      // Se puede volver a intentar.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="device-card" role="region" aria-label="Avisos en este móvil">
      <span className="device-card-ico" aria-hidden="true"><BellIcon /></span>
      <div className="device-card-text">
        <b>Tu recordatorio no puede llegar a este móvil</b>
        <small>
          {problem === "permission" && "Falta dar permiso para las notificaciones."}
          {problem === "blocked" && "Las notificaciones están bloqueadas. Ve a Ajustes del móvil → Notificaciones → FitGym → Permitir."}
          {problem === "home-screen" && "En iPhone solo llegan si abres FitGym desde su icono en la pantalla de inicio."}
        </small>
        <div className="device-card-actions">
          <button type="button" onClick={later}>Ahora no</button>
          {problem === "permission" && (
            <button type="button" className="primary" disabled={busy} onClick={() => { void activate(); }}>{busy ? "Activando…" : "Activar avisos"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
