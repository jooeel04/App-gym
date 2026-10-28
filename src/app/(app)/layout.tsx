import { AppShell } from "@/components/app-shell";
import { WorkoutProvider } from "@/controllers/workout-controller";
import { loadInitialWorkout } from "@/lib/workout-data";

// Layout de la app: carga los datos en el servidor una vez y el WorkoutProvider
// los conserva al navegar entre Entrenar, Rutina y Progreso.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { mode, snapshot } = await loadInitialWorkout();
  return (
    <WorkoutProvider mode={mode} initialSnapshot={snapshot}>
      <AppShell>{children}</AppShell>
    </WorkoutProvider>
  );
}
