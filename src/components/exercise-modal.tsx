"use client";

import { useWorkout } from "@/controllers/workout-controller";

// Formulario para añadir un ejercicio a un día de la rutina.
export function ExerciseModal({ day, onClose }: { day: number; onClose: () => void }) {
  const { actions } = useWorkout();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const added = actions.addExercise(day, {
      name: String(form.get("name") ?? ""),
      sets: Number(form.get("sets")),
      target: String(form.get("target") ?? ""),
      note: String(form.get("note") ?? ""),
    });
    if (added) onClose();
  };

  return (
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="exerciseModalTitle" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2 id="exerciseModalTitle">Añadir ejercicio · Día {day}</h2>
        <form onSubmit={onSubmit}>
          <label className="form-label">Nombre del ejercicio<input name="name" maxLength={80} required autoFocus /></label>
          <div className="form-cols">
            <label className="form-label">Series<input name="sets" type="number" min={1} max={10} defaultValue={3} required /></label>
            <label className="form-label">Repeticiones objetivo<input name="target" maxLength={30} placeholder="8–12" /></label>
          </div>
          <label className="form-label">Detalle técnico (opcional)<textarea name="note" maxLength={240} placeholder="Indicaciones para este ejercicio" /></label>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary" type="submit">Añadir ejercicio</button>
          </div>
        </form>
      </div>
    </div>
  );
}
