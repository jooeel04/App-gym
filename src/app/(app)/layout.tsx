import { AppShell } from "@/components/app-shell";
import { WorkoutProvider } from "@/controllers/workout-controller";
import { loadInitialWorkout } from "@/lib/workout-data";

// Layout de las pantallas autenticadas: carga los datos en el servidor una vez y
// el WorkoutProvider los conserva al navegar entre Entrenar, Rutina y Progreso.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { account, snapshot, programId } = await loadInitialWorkout();
  return (
    <WorkoutProvider account={account} initialSnapshot={snapshot} programId={programId}>
      <AppShell>{children}</AppShell>
    </WorkoutProvider>
  );
}
