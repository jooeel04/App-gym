"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSharedRoutine, shareRoutine } from "@/app/actions/social";
import { useWorkout } from "@/controllers/workout-controller";
import { DAY_NAMES, DAYS } from "@/domain/snapshot";
import type { NewExerciseInput } from "@/domain/types";
import { closeOnBackdrop } from "./backdrop";

type SharedExercise = NewExerciseInput & { day: number; prescription?: string };

// Compartir la rutina con un código y copiar la de un amigo.
export function ShareRoutineCard() {
  const { model, mode } = useWorkout();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  // Enlace compartido: /social?codigo=XXXXXX abre directamente la importación.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("codigo");
    if (!shared) return;
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setImporting(shared));
  }, []);

  if (mode !== "cloud") return null;
  const link = code ? window.location.origin + "/social?codigo=" + code : "";

  const share = async () => {
    setBusy(true);
    setError("");
    const res = await shareRoutine(model.routine).catch(() => ({ ok: false, error: "Sin conexión.", data: undefined }));
    setBusy(false);
    if (res.ok && res.data) setCode(res.data);
    else setError(res.error ?? "No se pudo compartir.");
  };

  const send = async () => {
    if (navigator.share) await navigator.share({ title: "Mi rutina de gym", text: "copia mi rutina en FitGym con el código " + code, url: link }).catch(() => {});
    else await navigator.clipboard.writeText(link).catch(() => {});
  };

  return (
    <section className="chart share-card">
      <div className="charttitle"><h2>Compartir con amigos</h2><span>Pasa tu rutina o copia la de otro</span></div>
      {code ? (
        <div className="share-code">
          <small>Tu código</small>
          <strong>{code}</strong>
          <span>Tu amigo lo escribe en «Importar rutina», o le pasas el enlace.</span>
          <div className="modal-actions">
            <button type="button" onClick={() => navigator.clipboard.writeText(code).catch(() => {})}>Copiar código</button>
            <button className="primary" type="button" onClick={send}>Enviar enlace</button>
          </div>
        </div>
      ) : (
        <div className="modal-actions">
          <button type="button" onClick={() => setImporting("")}>Importar rutina</button>
          <button className="primary" type="button" onClick={share} disabled={busy}>{busy ? "Creando código…" : "Compartir mi rutina"}</button>
        </div>
      )}
      {error && <p className="auth-msg error">{error}</p>}
      {importing !== null && <ImportModal initialCode={importing} onClose={() => setImporting(null)} />}
    </section>
  );
}

function ImportModal({ initialCode, onClose }: { initialCode: string; onClose: () => void }) {
  const { actions } = useWorkout();
  const [code, setCode] = useState(initialCode);
  const [routine, setRoutine] = useState<SharedExercise[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (value: string) => {
    setBusy(true);
    setError("");
    const res = await getSharedRoutine(value).catch(() => ({ ok: false, error: "Sin conexión.", data: undefined }));
    setBusy(false);
    if (res.ok && res.data) setRoutine(res.data as SharedExercise[]);
    else setError(res.error ?? "No se pudo leer la rutina.");
  };

  useEffect(() => {
    if (initialCode) queueMicrotask(() => { void load(initialCode); });
  }, [initialCode]);

  const apply = async (replace: boolean) => {
    if (routine && await actions.importRoutine(routine, replace)) onClose();
  };

  // Fuera de las pestañas (su contenedor se desplaza), si no la ventana no queda fija en pantalla.
  return createPortal(
    <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="importTitle" {...closeOnBackdrop(onClose)}>
      <div className="modal">
        <h2 id="importTitle">Importar rutina</h2>
        {!routine ? (
          <form onSubmit={(e) => { e.preventDefault(); void load(code); }}>
            <p>Escribe el código de 6 letras que te ha pasado tu amigo.</p>
            <input className="exsearch code-input" value={code} maxLength={6} autoFocus placeholder="ABC123" aria-label="Código de la rutina"
              onChange={(e) => setCode(e.target.value.toUpperCase())} />
            {error && <p className="auth-msg error">{error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancelar</button>
              <button className="primary" type="submit" disabled={busy || code.trim().length !== 6}>{busy ? "Buscando…" : "Ver rutina"}</button>
            </div>
          </form>
        ) : (
          <>
            <p>{routine.length} ejercicios. Puedes añadirlos a tu rutina o sustituir la tuya.</p>
            <div className="import-preview">
              {DAYS.filter((d) => routine.some((x) => x.day === d)).map((d) => (
                <div key={d}>
                  <b><i className="swatch" style={{ background: "var(--day" + d + ")" }} /> {DAY_NAMES[d]}</b>
                  {routine.filter((x) => x.day === d).map((x, i) => <span key={i}>{x.name} <em>{x.prescription}</em></span>)}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => apply(true)}>Sustituir la mía</button>
              <button className="primary" type="button" onClick={() => apply(false)}>Añadir a la mía</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
