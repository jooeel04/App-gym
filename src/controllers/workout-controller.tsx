"use client";

import { createContext, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { BackupService } from "@/domain/backup-service";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { formatShortDate, todayISO } from "@/domain/calendar";
import { DAY_NAMES } from "@/domain/snapshot";
import type { NewExerciseInput, SetField, WeekSchedule, WorkoutSnapshot } from "@/domain/types";
import { WorkoutCalendar, type PlannedSession } from "@/domain/workout-calendar";
import { WorkoutDiary } from "@/domain/workout-diary";
import { WorkoutModel } from "@/domain/workout-model";
import { WorkoutStats } from "@/domain/workout-stats";
import type { StorageMode } from "@/lib/workout-data";
import { LocalWorkoutRepository } from "@/repositories/local-workout-repository";
import { ServerActionWorkoutRepository } from "@/repositories/server-action-workout-repository";
import type { WorkoutRepository } from "@/repositories/workout-repository";

interface WorkoutContextValue {
  model: WorkoutModel;
  stats: WorkoutStats;
  calendar: WorkoutCalendar;
  diary: WorkoutDiary;
  mode: StorageMode;
  // Fecha de hoy (solo en el navegador; null durante el renderizado en el servidor).
  today: string | null;
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

// Raíz de composición: elige el repositorio según el modo y crea el modelo.
function createModel(mode: StorageMode, snapshot: WorkoutSnapshot | null) {
  const repository: WorkoutRepository = mode === "cloud" ? new ServerActionWorkoutRepository() : new LocalWorkoutRepository();
  return new WorkoutModel(repository, BASE_ROUTINE, snapshot);
}

interface ProviderProps {
  mode: StorageMode;
  initialSnapshot: WorkoutSnapshot | null;
  children: ReactNode;
}

// Controlador: guarda el estado de la interfaz (semana, día, avisos), traduce
// las acciones del usuario en cambios del modelo y expone el modelo a las vistas.
export function WorkoutProvider({ mode, initialSnapshot, children }: ProviderProps) {
  const [model] = useState(() => createModel(mode, initialSnapshot));
  const [ready, setReady] = useState(initialSnapshot !== null);
  // null = seguir el día de hoy; un número = elegido por el usuario.
  const [selectedWeek, setWeek] = useState<number | null>(null);
  const [selectedDay, setDay] = useState<number | null>(null);
  const [toast, setToast] = useState({ text: "", visible: false });
  const [showToast] = useState(() => createToaster(setToast));
  const version = useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion);
  const today = useSyncExternalStore(subscribeToDayChange, todayISO, () => null);
  const calendar = useMemo(() => new WorkoutCalendar(model), [model]);
  const diary = useMemo(() => new WorkoutDiary(model, calendar), [model, calendar]);

  // Sin fecha de inicio guardada, se fija una que respeta el progreso actual.
  useEffect(() => {
    if (ready && today && !model.startDate) model.setStartDate(calendar.suggestStartDate(today));
  }, [ready, today, model, calendar]);

  // Al empezar una semana nueva del calendario se añade al ciclo (semana 2, 3, 4…).
  useEffect(() => {
    const current = ready && today ? calendar.cycleWeekOf(today) : null;
    if (current) model.ensureWeeks(current);
  }, [ready, today, version, model, calendar]);

  // Primera carga en el navegador: modo local, o base de datos todavía vacía
  // (se crea a partir de los datos locales de este dispositivo, si los hay).
  useEffect(() => {
    if (ready) return;
    const seed = mode === "cloud" ? new LocalWorkoutRepository().load() : Promise.resolve(null);
    seed.then((s) => model.load(s))
      .then(() => setReady(true))
      .catch(() => showToast("No se pudieron cargar los datos"));
  }, [mode, model, ready, showToast]);

  useEffect(() => {
    model.setSaveErrorHandler(() => showToast(mode === "cloud" ? "No se pudo sincronizar con el servidor" : "No se pudo guardar en este navegador"));
    const flush = () => { model.flush().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, model, showToast]);

  const stats = useMemo(() => new WorkoutStats(model), [model]);
  const actions = useMemo(
    () => createActions({ model, showToast, setWeek, setDay, goTo: switchTab }),
    [model, showToast],
  );

  const focus = today ? calendar.focusFor(today) : null;
  const week = Math.min(selectedWeek ?? focus?.week ?? 1, model.weeksCount);
  const day = selectedDay ?? focus?.day ?? 1;
  const value: WorkoutContextValue = { model, stats, calendar, diary, mode, today, ready, version, week, day, toast, actions };
  return <WorkoutContext value={value}>{children}</WorkoutContext>;
}

interface ActionDeps {
  model: WorkoutModel;
  showToast: (text: string) => void;
  setWeek: (w: number | null) => void;
  setDay: (d: number | null) => void;
  goTo: (path: string) => void;
}

function createActions({ model, showToast, setWeek, setDay, goTo }: ActionDeps) {
  const backup = new BackupService(model);

  return {
    selectDay: setDay,

    startDay(d: number) {
      setDay(d);
      goTo("/entrenar");
    },

    setEntry(w: number, d: number, id: number, s: number, field: SetField, value: string) {
      model.setEntryField(w, d, id, s, field, value, todayISO());
      if (model.syncDayCompleted(w, d)) showToast("¡Día completado!");
    },

    // Tick manual: cuenta el ejercicio como hecho aunque no tenga series anotadas.
    toggleExerciseChecked(w: number, d: number, id: number) {
      model.toggleExerciseChecked(w, d, id, todayISO());
      if (model.syncDayCompleted(w, d)) showToast("¡Día completado!");
    },

    // Vuelve a seguir el día de hoy.
    goToToday() {
      setWeek(null);
      setDay(null);
    },

    // Abre un día planificado que no se hizo para registrarlo hoy.
    recoverSession(session: PlannedSession) {
      setWeek(session.week);
      setDay(session.day);
      goTo("/entrenar");
      showToast("Recuperando Día " + session.day + " · " + DAY_NAMES[session.day] + " (" + formatShortDate(session.date) + ")");
    },

    setWeekday(d: number, weekday: number) {
      model.setWeekday(d, weekday);
    },

    applySchedulePreset(schedule: WeekSchedule, label: string) {
      model.setSchedule(schedule);
      showToast("Calendario: " + label);
    },

    setStartDate(iso: string) {
      model.setStartDate(iso);
      setWeek(null);
      setDay(null);
      showToast("Fecha de inicio actualizada");
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

// Cambio de pestaña instantáneo: se actualiza la URL en el navegador (Next sincroniza
// usePathname con history.pushState) sin pedir la página al servidor.
export function switchTab(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.scrollTo(0, 0);
}

// Vuelve a leer la fecha cuando la app vuelve a primer plano (p. ej. al día siguiente).
function subscribeToDayChange(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  const timer = setInterval(onChange, 60_000);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    clearInterval(timer);
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
