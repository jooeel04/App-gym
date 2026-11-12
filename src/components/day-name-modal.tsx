"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MAX_DAY_NAME } from "@/domain/snapshot";
import { closeOnBackdrop } from "./backdrop";

// Ventana para poner nombre a un día de rutina nuevo o cambiar el de uno que ya existe.
// `onSave` devuelve si se pudo guardar (un nombre vacío no se guarda).
export function DayNameModal({ initial = "", isNew, onSave, onClose }: { initial?: string; isNew: boolean; onSave: (name: string) => boolean; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const action = isNew ? "Añadir día" : "Guardar nombre";
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSave(name)) onClose();
  };

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="dayNameTitle" {...closeOnBackdrop(onClose)}>
      <form className="modal day-name-modal" onSubmit={onSubmit}>
        <h2 id="dayNameTitle">{isNew ? "Nuevo día" : "Cambiar nombre"}</h2>
        <p>{isNew ? "Ponle un nombre que se entienda de un vistazo: «Pecho», «Full body», «Cardio»…" : "Así se llamará este día en toda la app."}</p>
        <label className="form-label">Nombre del día
          <input type="text" value={name} maxLength={MAX_DAY_NAME} autoFocus placeholder="Por ejemplo, Full body" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit" disabled={!name.trim()}>{action}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
