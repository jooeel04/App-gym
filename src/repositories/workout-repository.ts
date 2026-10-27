import type { WorkoutChange, WorkoutSnapshot } from "@/domain/types";

// Contrato de persistencia (inversión de dependencias): el modelo solo conoce
// esta interfaz y cada almacenamiento la implementa. Añadir otro backend no
// obliga a tocar el modelo (abierto/cerrado).
export interface WorkoutRepository {
  // Snapshot guardado o null si todavía no hay datos.
  load(): Promise<WorkoutSnapshot | null>;

  // Persiste un cambio. Recibe también el snapshot completo ya actualizado,
  // para los almacenamientos que guardan todo de una vez.
  apply(change: WorkoutChange, snapshot: WorkoutSnapshot): Promise<void>;

  // Envía lo que esté pendiente (por ejemplo, antes de cerrar la página).
  flush(): Promise<void>;
}
