"use client";

import { useEffect } from "react";
import { LoadProblem } from "@/components/load-problem";

// Si la carga de la app falla en el servidor (p. ej. la base de datos no responde),
// en vez de una pantalla en blanco se ofrece reintentar o cerrar sesión.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <LoadProblem onRetry={retry} />;
}
