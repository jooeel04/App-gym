"use client";

import { createContext, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BackupService } from "@/domain/backup-service";
import { BASE_ROUTINE } from "@/domain/base-routine";
import type { NewExerciseInput, SetField, WorkoutSnapshot } from "@/domain/types";
import { WorkoutModel } from "@/domain/workout-model";
import { WorkoutStats } from "@/domain/workout-stats";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/workout-data";
import { signOutAction } from "@/app/login/actions";
import { LocalWorkoutRepository } from "@/repositories/local-workout-repository";
import { SupabaseWorkoutRepository } from "@/repositories/supabase-workout-repository";
import type { WorkoutRepository } from "@/repositories/workout-repository";

interface WorkoutContextValue {
  model: WorkoutModel;
  stats: WorkoutStats;
  account: Account;
  ready: boolean;
  version: number;
  week: number;
  day: number;
  toast: { text: string; visible: boolean };
  actions: ReturnType<typeof createActions>;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function useWorkout() {
  const ctx = use(WorkoutContext);
  if (!ctx) throw new Error("useWorkout debe usarse dentro de WorkoutProvider");
  return ctx;
}

// Raíz de composición: elige el repositorio según la cuenta y crea el modelo.
function createModel(account: Account, snapshot: WorkoutSnapshot | null, programId: string | null) {
  const repository: WorkoutRepository = account.mode === "cloud"
    ? new SupabaseWorkoutRepository(createSupabaseBrowserClient(), programId)
    : new LocalWorkoutRepository();
  return new WorkoutModel(repository, BASE_ROUTINE, snapshot);
}

interface ProviderProps {
  account: Account;
  initialSnapshot: WorkoutSnapshot | null;
  programId: string | null;
  children: ReactNode;
}

// Controlador: guarda el estado de la interfaz (semana, día, avisos), traduce
// las acciones del usuario en cambios del modelo y expone el modelo a las vistas.
export function WorkoutProvider({ account, initialSnapshot, programId, children }: ProviderProps) {
  const router = useRouter();
  const [model] = useState(() => createModel(account, initialSnapshot, programId));
  const [ready, setReady] = useState(initialSnapshot !== null);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [toast, setToast] = useState({ text: "", visible: false });
  const [showToast] = useState(() => createToaster(setToast));
  const version = useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion);

  // Primera carga en el navegador: modo local, o cuenta nueva sin programa
  // (se crea a partir de los datos locales de este dispositivo, si los hay).
  useEffect(() => {
    if (ready) return;
    const seed = account.mode === "cloud" ? new LocalWorkoutRepository().load() : Promise.resolve(null);
    seed.then((s) => model.load(s))
      .then(() => setReady(true))
      .catch(() => showToast("No se pudieron cargar los datos"));
  }, [account.mode, model, ready, showToast]);

  useEffect(() => {
    model.setSaveErrorHandler(() => showToast(account.mode === "cloud" ? "No se pudo sincronizar con el servidor" : "No se pudo guardar en este navegador"));
    const flush = () => { model.flush().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [account.mode, model, showToast]);

  const stats = useMemo(() => new WorkoutStats(model), [model]);
  const actions = useMemo(
    () => createActions({ model, showToast, setWeek, setDay, goTo: (path: string) => router.push(path) }),
    [model, showToast, router],
  );

  const safeWeek = Math.min(week, model.weeksCount);
  const value: WorkoutContextValue = { model, stats, account, ready, version, week: safeWeek, day, toast, actions };
  return <WorkoutContext value={value}>{children}</WorkoutContext>;
}

interface ActionDeps {
  model: WorkoutModel;
  showToast: (text: string) => void;
  setWeek: (w: number) => void;
  setDay: (d: number) => void;
  goTo: (path: string) => void;
}

function createActions({ model, showToast, setWeek, setDay, goTo }: ActionDeps) {
  const backup = new BackupService(model);

  return {
    selectWeek: setWeek,
    selectDay: setDay,

    startDay(d: number) {
      setDay(d);
      goTo("/entrenar");
    },

    setEntry(w: number, d: number, id: number, s: number, field: SetField, value: string) {
      model.setEntryField(w, d, id, s, field, value);
    },

    toggleDayCompleted(w: number, d: number) {
      const done = model.toggleDayCompleted(w, d);
      showToast(done ? "Día marcado como completado" : "Marca quitada");
    },

    addWeek() {
      const w = model.addWeek();
      setWeek(w);
      showToast("Semana " + w + " añadida");
    },

    removeWeek(w: number) {
      if (model.weeksCount <= 1) { showToast("Debe quedar al menos una semana"); return; }
      if (model.weekHasData(w) && !confirm("La semana " + w + " tiene registros. Al eliminarla se borrarán y las semanas posteriores se renumerarán. ¿Continuar?")) return;
      model.removeWeek(w);
      setWeek(Math.min(w, model.weeksCount));
      showToast("Semana eliminada");
    },

    addExercise(d: number, data: NewExerciseInput) {
      if (!data.name.trim()) return false;
      model.addExercise(d, { ...data, name: data.name.trim(), target: data.target.trim(), note: data.note.trim() });
      showToast("Ejercicio añadido al Día " + d);
      return true;
    },

    deleteExercise(id: number) {
      if (!model.findExercise(id)) return;
      if (model.exerciseHasEntries(id) && !confirm("Este ejercicio tiene registros guardados. Al eliminarlo también se borrarán. ¿Continuar?")) return;
      model.removeExercise(id);
      showToast("Ejercicio eliminado");
    },

    exportJson() {
      downloadFile("copia-rutina-seguimiento.json", backup.toJSON(), "application/json");
      showToast("Copia JSON descargada");
    },

    exportCsv() {
      downloadFile("rutina-seguimiento.csv", backup.toCsv(), "text/csv;charset=utf-8");
      showToast("CSV descargado");
    },

    async importFile(file: File) {
      const restored = backup.parse(await file.text());
      if (!restored) { showToast("No se pudo leer la copia JSON"); return; }
      if (!confirm("¿Restaurar esta copia? Los registros actuales se sustituirán.")) return;
      model.restore(restored);
      showToast("Copia restaurada");
    },

    clearData() {
      if (!confirm("¿Borrar todos los registros y marcas de días completados? Esta acción no se puede deshacer.")) return;
      model.clearLogs();
      showToast("Registros borrados");
    },

    async signOut() {
      await model.flush().catch(() => {});
      await signOutAction();
    },

    showToast,
  };
}

// Aviso flotante: muestra un texto y lo oculta tras 1,8 s.
function createToaster(setToast: (update: (t: { text: string; visible: boolean }) => { text: string; visible: boolean }) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (text: string) => {
    setToast(() => ({ text, visible: true }));
    clearTimeout(timer);
    timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  };
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
