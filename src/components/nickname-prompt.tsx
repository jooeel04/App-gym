"use client";

import { useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { cleanNickname } from "@/lib/nickname";

// Primera vez (o cuenta sin apodo): pregunta cómo llamar a la persona para que la app se
// dirija a ella por su nombre. Se puede cambiar después en Ajustes → Tu nombre.
export function NicknamePrompt() {
  const { nickname, nicknameReady, actions } = useWorkout();
  const [value, setValue] = useState("");
  if (nickname || !nicknameReady) return null;
  const ok = cleanNickname(value).length > 0;

  return (
    <div className="backdrop open nickname-backdrop" role="dialog" aria-modal="true" aria-labelledby="nicknameTitle">
      <form className="modal nickname-modal" onSubmit={(e) => { e.preventDefault(); if (ok) actions.setNickname(value); }}>
        <div className="nickname-emoji" aria-hidden="true">👋</div>
        <h2 id="nicknameTitle">¿Cómo te llamamos?</h2>
        <p>Tu nombre o apodo. Lo usaremos para hablarte y es el que verán tus amigos en la clasificación.</p>
        <label className="form-label">Tu nombre o apodo
          <input name="nickname" maxLength={30} autoComplete="nickname" placeholder="Por ejemplo: Joel" value={value}
            onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="modal-actions"><button className="primary" type="submit" disabled={!ok}>Guardar</button></div>
      </form>
    </div>
  );
}
