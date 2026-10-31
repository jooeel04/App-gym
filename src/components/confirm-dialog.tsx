"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeOnBackdrop } from "./backdrop";

export interface ConfirmOptions {
  title: string;
  text?: string;
  // Nombre del botón: lo que pasa al pulsarlo ("Borrar", "Salir del grupo"…).
  action: string;
  // Acción que no se puede deshacer: el botón va en rojo.
  danger?: boolean;
}

type Request = ConfirmOptions & { answer: (ok: boolean) => void };

// Pregunta pendiente (una cada vez) y quién la está pintando.
let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Pregunta con la ventana de la app (en vez de la del navegador). Responde
// `true` si se pulsa la acción y `false` si se cancela o se toca fuera.
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  current?.answer(false);
  return new Promise((resolve) => {
    current = {
      ...options,
      answer: (ok) => {
        current = null;
        emit();
        resolve(ok);
      },
    };
    emit();
  });
}

// Ventana de la pregunta pendiente. Va una sola vez en la app (AppShell).
export function ConfirmDialog() {
  const req = useSyncExternalStore(subscribe, () => current, () => null);
  if (!req) return null;
  const cancel = () => req.answer(false);
  return createPortal(
    <div className="backdrop open" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby={req.text ? "confirmText" : undefined} {...closeOnBackdrop(cancel)}>
      <div className="modal confirm">
        <h2 id="confirmTitle">{req.title}</h2>
        {req.text && <p id="confirmText">{req.text}</p>}
        <div className="modal-actions">
          <button type="button" onClick={cancel}>Cancelar</button>
          <button type="button" className={req.danger ? "danger-btn" : "primary"} autoFocus onClick={() => req.answer(true)}>{req.action}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
