"use client";

import { signOutAction } from "@/app/login/actions";
import { WarningIcon } from "./icons";

// Pantalla cuando no se pueden cargar los datos: reintentar o cerrar sesión.
export function LoadProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="auth-page">
      <div className="modal load-problem">
        <div className="load-problem-icon" aria-hidden="true"><WarningIcon /></div>
        <h2>No se pudieron cargar tus datos</h2>
        <p>Puede ser la conexión o un fallo momentáneo del servidor. Prueba otra vez; si sigue pasando, cierra sesión y vuelve a entrar.</p>
        <div className="modal-actions">
          <button type="button" onClick={() => signOutAction()}>Cerrar sesión</button>
          <button className="primary" type="button" onClick={onRetry}>Reintentar</button>
        </div>
      </div>
    </div>
  );
}
