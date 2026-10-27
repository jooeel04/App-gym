"use client";

import { useEffect, useState } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { DownloadIcon } from "./icons";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

// Botón "Añadir al móvil": usa el aviso nativo si existe o muestra instrucciones.
export function InstallButton() {
  const { actions } = useWorkout();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [help, setHelp] = useState<"apple" | "other" | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => actions.showToast("App añadida a la pantalla de inicio");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [actions]);

  const onClick = () => {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(() => setDeferred(null));
      return;
    }
    setHelp(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "apple" : "other");
  };

  return (
    <>
      <button className="install" type="button" aria-label="Añadir al móvil" onClick={onClick}>
        <DownloadIcon /><span className="install-label">Añadir al móvil</span>
      </button>
      <div className={"backdrop" + (help ? " open" : "")} role="dialog" aria-modal="true" aria-labelledby="installTitle" onClick={(e) => { if (e.target === e.currentTarget) setHelp(null); }}>
        <div className="modal">
          <h2 id="installTitle">Añadir al móvil</h2>
          {help === "apple"
            ? <p>En Safari, toca <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>.</p>
            : <p>En Chrome, abre el menú <strong>⋮</strong> y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>}
          <p>Necesita una dirección HTTPS para instalarse y funcionar sin conexión.</p>
          <button className="close" type="button" onClick={() => setHelp(null)}>Entendido</button>
        </div>
      </div>
    </>
  );
}
