"use client";

import { useEffect, useState } from "react";
import { googleStatus, linkGoogle } from "@/app/actions/account";
import { CheckIcon, GoogleIcon } from "./icons";

// Resultado al volver de Google (/auth/google?next=/ajustes → /ajustes?google=…).
const RESULT: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Google conectado: ya puedes entrar con él." },
  ocupado: { ok: false, text: "Ese Google ya tiene otra cuenta en RUTINA. Usa otro, o entra con él para seguir con aquella cuenta." },
  error: { ok: false, text: "No se pudo conectar Google. Inténtalo de nuevo." },
};

// Ajustes → Cuenta: conectar Google a la cuenta abierta (aunque sea de otro correo),
// para entrar con los dos y no perder los datos.
export function GoogleRow() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    googleStatus().then((s) => { if (alive) setLinked(s.linked); }).catch(() => {});
    // El aviso de la vuelta se muestra una vez: se quita de la dirección.
    const params = new URLSearchParams(window.location.search);
    const back = params.get("google");
    if (back) {
      queueMicrotask(() => setResult(RESULT[back] ?? RESULT.error));
      params.delete("google");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (query ? "?" + query : ""));
    }
    return () => { alive = false; };
  }, []);

  const connect = async () => {
    setBusy(true);
    setResult(null);
    const res = await linkGoogle();
    // Si va bien, el navegador ya se está yendo a Google.
    if (res?.error) {
      setResult({ ok: false, text: res.error });
      setBusy(false);
    }
  };

  return (
    <div className="google-row">
      {linked
        ? <p className="perm-ok"><CheckIcon />Google conectado</p>
        : linked === false && (
          <>
            <p className="set-hint">Conecta tu Google para entrar con él, aunque sea de otro correo. Tus datos siguen en esta cuenta.</p>
            <button type="button" className="google-btn" disabled={busy} onClick={connect}>
              <GoogleIcon />{busy ? "Abriendo Google…" : "Conectar con Google"}
            </button>
          </>
        )}
      {result && <p className={result.ok ? "perm-ok" : "perm-warn"} role={result.ok ? "status" : "alert"}>{result.text}</p>}
    </div>
  );
}
