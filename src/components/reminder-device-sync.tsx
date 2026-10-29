"use client";

import { useEffect } from "react";
import { getReminder, registerDevice } from "@/app/actions/reminders";
import { notifyState } from "@/lib/permissions";
import { subscribeThisDevice } from "@/lib/push";

// Al abrir la app, si el recordatorio está activado y hay permiso de notificaciones, se
// vuelve a registrar este móvil. El navegador cambia de vez en cuando su suscripción
// (sobre todo en iPhone) y la antigua deja de servir: el servidor la borra al fallar y,
// sin esto, los avisos no volvían a llegar hasta guardar otra vez en Ajustes.
// Se hace un rato después de abrir para no frenar la carga.
export function ReminderDeviceSync({ delayMs = 4000 }: { delayMs?: number }) {
  useEffect(() => {
    if (notifyState() !== "granted") return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await getReminder();
        if (!alive || !res.ok || !res.data?.enabled) return;
        const device = await subscribeThisDevice();
        if (alive && device) await registerDevice(device);
      } catch {
        // Sin conexión o sin sesión: se intentará la próxima vez que se abra.
      }
    }, delayMs);
    return () => { alive = false; clearTimeout(timer); };
  }, [delayMs]);
  return null;
}
