import { AppShell } from "@/components/app-shell";
import { WorkoutProvider } from "@/controllers/workout-controller";
import { loadInitialWorkout } from "@/lib/workout-data";

// Layout de la app: con Supabase exige sesión y carga en el servidor los datos de ese
// usuario; el WorkoutProvider los conserva al navegar entre Entrenar, Rutina y Progreso.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { mode, snapshot, email } = await loadInitialWorkout();
  return (
    <WorkoutProvider mode={mode} initialSnapshot={snapshot} email={email}>
      <AppShell>{children}</AppShell>
    </WorkoutProvider>
  );
}
