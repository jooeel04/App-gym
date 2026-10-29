"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GlassLayer, glassAllowed } from "./glass-layer";

// Tarjetas y botones que llevan cristal líquido. No van las filas de las listas, los
// días del calendario ni otros elementos pequeños y numerosos (cada cristal cuesta).
export const GLASS_SURFACES = [
  // Tarjetas
  ".chart", ".hero", ".stat-tile", ".perm-card", ".pending-card", ".routine-day", ".exprog",
  ".set-account", ".set-box", ".modal", ".streak-pill",
  // Botones
  "button.primary", ".set-done", ".finish-workout", ".focus-check", ".tool-btn", ".settings-btn",
  ".quiet", ".daychip", ".set-chip", ".stepper-ctl button", ".modal-actions button", ".wizard-opt",
].join(",");

// Pone el cristal en todas las tarjetas y botones de la pantalla sin tocar cada
// componente: a cada uno le añade al final un hueco (`.glass-slot`, fuera del flujo y
// detrás del contenido) donde pinta GlassLayer. Si React vacía el elemento al cambiar
// su texto, el hueco se vuelve a poner; si el elemento desaparece, se quita.
// La pestaña que asoma al cambiar de pestaña (`.page.peek`) no lleva cristal mientras se
// desliza (montar muchos cristales a la vez atasca el movimiento): se le pone cuando se
// queda quieta (evento TAB_SETTLED, que lanza AppShell).
export const TAB_SETTLED = "rutina-tab-settled";
export function GlassSurfaces() {
  const [slots, setSlots] = useState<[Element, HTMLElement][]>([]);

  useEffect(() => {
    if (!glassAllowed()) return;
    const map = new Map<Element, HTMLElement>();
    let pending = 0, next = 0;
    const scan = () => {
      pending = 0;
      let changed = false;
      for (const host of document.querySelectorAll(GLASS_SURFACES)) {
        if (host.closest(".glass-layer, .page.peek")) continue;
        let slot = map.get(host);
        if (!slot) {
          slot = document.createElement("span");
          slot.className = "glass-slot";
          slot.setAttribute("aria-hidden", "true");
          slot.dataset.slot = String(next++);
          map.set(host, slot);
          changed = true;
        }
        if (slot.parentElement !== host) host.appendChild(slot);
      }
      for (const [host, slot] of map) {
        if (host.isConnected) continue;
        map.delete(host);
        slot.remove();
        changed = true;
      }
      if (changed) setSlots([...map]);
    };
    scan();
    const mo = new MutationObserver(() => { if (!pending) pending = window.setTimeout(scan, 16); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener(TAB_SETTLED, scan);
    return () => {
      mo.disconnect();
      window.removeEventListener(TAB_SETTLED, scan);
      clearTimeout(pending);
      for (const slot of map.values()) slot.remove();
    };
  }, []);

  return <>{slots.map(([, slot]) => createPortal(<GlassLayer />, slot, slot.dataset.slot))}</>;
}
