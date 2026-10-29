"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { demoFor } from "@/domain/exercise-demos";
import { closeOnBackdrop } from "./backdrop";
import { PlayIcon } from "./icons";

// Las dos fotos del movimiento (inicio y final) alternándose como un GIF.
function DemoFrames({ name, frames, big = false }: { name: string; frames: [string, string]; big?: boolean }) {
  return (
    <span className={"demo-frames" + (big ? " big" : "")} role="img" aria-label={"Cómo se hace: " + name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fotos fijas ya optimizadas (webp pequeños) */}
      <img src={frames[0]} alt="" loading="lazy" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element -- fotos fijas ya optimizadas (webp pequeños) */}
      <img src={frames[1]} alt="" loading="lazy" decoding="async" className="demo-end" />
    </span>
  );
}

// Miniatura animada de cómo se hace el ejercicio; al tocarla se ve en grande. Solo para
// los ejercicios de la biblioteca (los inventados no tienen fotos).
export function ExerciseDemo({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const frames = demoFor(name);
  if (!frames) return null;
  return (
    <>
      <button type="button" className="demo-thumb" aria-label={"Ver cómo se hace: " + name} onClick={() => setOpen(true)}>
        <DemoFrames name={name} frames={frames} />
        <span className="demo-play" aria-hidden="true"><PlayIcon /></span>
      </button>
      {open && createPortal(
        <div className="backdrop open" role="dialog" aria-modal="true" aria-labelledby="demoTitle" {...closeOnBackdrop(() => setOpen(false))}>
          <div className="modal demo-modal">
            <h2 id="demoTitle">Cómo se hace</h2>
            <p className="demo-name">{name}</p>
            <DemoFrames name={name} frames={frames} big />
            <p className="demo-hint">Fíjate en la postura del principio y del final del movimiento.</p>
            <div className="modal-actions"><button type="button" className="primary" onClick={() => setOpen(false)}>Cerrar</button></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
