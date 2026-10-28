"use client";

import { useEffect } from "react";

// Mantiene la pantalla encendida (Screen Wake Lock) mientras `on` sea true. El
// navegador suelta el bloqueo al pasar a segundo plano, así que se pide de nuevo al volver.
export function useScreenAwake(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      navigator.wakeLock.request("screen")
        .then((l) => { if (stopped) void l.release(); else lock = l; })
        .catch(() => {}); // Sin permiso o sin batería: la pantalla se apaga como siempre.
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      if (lock) void lock.release().catch(() => {});
    };
  }, [on]);
}
