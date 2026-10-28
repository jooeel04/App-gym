"use client";

import { createContext, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import { BackupService } from "@/domain/backup-service";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { formatShortDate, todayISO } from "@/domain/calendar";
import { estimate1RM } from "@/domain/progression";
import { DAY_NAMES } from "@/domain/snapshot";
import type { BodyMetrics, NewExerciseInput, SetField, WeekSchedule, WorkoutSnapshot } from "@/domain/types";
import { WorkoutCalendar, type PlannedSession } from "@/domain/workout-calendar";
import { WorkoutDiary } from "@/domain/workout-diary";
import { WorkoutModel } from "@/domain/workout-model";
import { WorkoutStats } from "@/domain/workout-stats";
import { getActiveWorkout, setActiveWorkout, subscribeActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";
import { unlockAudio } from "@/lib/alerts";
import { getRestPrefs } from "@/lib/preferences";
import type { StorageMode } from "@/lib/workout-data";
import { LocalWorkoutRepository } from "@/repositories/local-workout-repository";
import { ServerActionWorkoutRepository, type SyncStatus } from "@/repositories/server-action-workout-repository";
import type { WorkoutRepository } from "@/repositories/workout-repository";

// Descanso en marcha entre series.
export interface RestTimer {
  endsAt: number;
  total: number;
}

// Récord batido durante esta sesión.
export interface RecordHit {
  exerciseId: number;
  day: number;
  weight: number;
  reps: number;
}

// Resumen que se muestra al completar un día.
export interface DaySummaryInfo {
  week: number;
  day: number;
  minutes: number | null;
}

interface WorkoutContextValue {
  model: WorkoutModel;
  stats: WorkoutStats;
  calendar: WorkoutCalendar;
  diary: WorkoutDiary;
  mode: StorageMode;
  // Correo de la cuenta con la sesión iniciada (null en modo local).
  email: string | null;
  // Sincronización con la cuenta: sin conexión y cambios pendientes de enviar.
  sync: SyncStatus;
  // Fecha de hoy (solo en el navegador; null durante el renderizado en el servidor).
  today: string | null;
  ready: boolean;
  // La primera carga falló o tarda demasiado: la interfaz ofrece reintentar.
  loadFailed: boolean;
  version: number;
  week: number;
  day: number;
  toast: { text: string; visible: boolean };
  rest: RestTimer | null;
  records: RecordHit[];
  summary: DaySummaryInfo | null;
  // Entreno en curso en este dispositivo (null si no hay ninguno).
  active: ActiveWorkout | null;
  // Pantalla completa del entreno en curso (modo foco) abierta.
  focusOpen: boolean;
  actions: ReturnType<typeof createActions>;
}

const MAX_WEIGHT = 9999.99;
const MAX_REPS = 999;

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function useWorkout() {
  const ctx = use(WorkoutContext);
  if (!ctx) throw new Error("useWorkout debe usarse dentro de WorkoutProvider");
  return ctx;
}

// Raíz de composición: elige el repositorio según el modo y crea el modelo.
function createModel(mode: StorageMode, snapshot: WorkoutSnapshot | null, email: string | null) {
  const sync = mode === "cloud" ? new ServerActionWorkoutRepository(email || "cuenta") : null;
  const repository: WorkoutRepository = sync ?? new LocalWorkoutRepository();
  return { model: new WorkoutModel(repository, BASE_ROUTINE, snapshot), sync };
}

const IDLE: SyncStatus = { offline: false, pending: 0 };
const noSubscribe = () => () => {};
const idle = () => IDLE;

interface ProviderProps {
  mode: StorageMode;
  initialSnapshot: WorkoutSnapshot | null;
  email: string | null;
  children: ReactNode;
}

// Controlador: guarda el estado de la interfaz (semana, día, avisos), traduce
// las acciones del usuario en cambios del modelo y expone el modelo a las vistas.
export function WorkoutProvider({ mode, initialSnapshot, email, children }: ProviderProps) {
  const [{ model, sync }] = useState(() => createModel(mode, initialSnapshot, email));
  const [ready, setReady] = useState(initialSnapshot !== null);
  const [loadFailed, setLoadFailed] = useState(false);
  // null = seguir el día de hoy; un número = elegido por el usuario.
  const [selectedWeek, setWeek] = useState<number | null>(null);
  const [selectedDay, setDay] = useState<number | null>(null);
  const [toast, setToast] = useState({ text: "", visible: false });
  const [showToast] = useState(() => createToaster(setToast));
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [records, setRecords] = useState<RecordHit[]>([]);
  const [summary, setSummary] = useState<DaySummaryInfo | null>(null);
  const [focusOpen, setFocus] = useState(false);
  const version = useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion);
  const today = useSyncExternalStore(subscribeToDayChange, todayISO, () => null);
  const active = useSyncExternalStore(subscribeActiveWorkout, getActiveWorkout, () => null);
  const syncStatus = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getStatus ?? idle, idle);
  const calendar = useMemo(() => new WorkoutCalendar(model), [model]);
  const diary = useMemo(() => new WorkoutDiary(model, calendar), [model, calendar]);

  // Sin internet: si este dispositivo tiene cambios sin enviar (o no hay conexión) se
  // usa su copia local, más reciente que la página; si no, se guarda la del servidor
  // para poder abrir la app sin conexión. Después se envía lo pendiente.
  useEffect(() => {
    if (!sync) return;
    const local = sync.localSnapshot();
    if (local && (sync.hasPending() || !navigator.onLine)) model.adopt(local);
    else if (initialSnapshot) sync.saveSnapshot(model.snapshot);
    sync.flush().catch(() => {});
  }, [model, sync, initialSnapshot]);

  // Sin fecha de inicio guardada, se fija una que respeta el progreso actual.
  useEffect(() => {
    if (ready && today && !model.startDate) model.setStartDate(calendar.suggestStartDate(today));
  }, [ready, today, model, calendar]);

  // Al empezar una semana nueva del calendario se añade al ciclo (semana 2, 3, 4…).
  useEffect(() => {
    const current = ready && today ? calendar.cycleWeekOf(today) : null;
    if (current) model.ensureWeeks(current);
  }, [ready, today, version, model, calendar]);

  // Primera carga en el navegador: modo local, o cuenta nueva todavía sin programa
  // (empieza con la rutina base; no se copian datos de este dispositivo, que pueden
  // ser de otra persona).
  useEffect(() => {
    if (ready) return;
    // Si no responde en 20 s se deja de esperar (nunca se queda en "Cargando…").
    const timeout = setTimeout(() => setLoadFailed(true), 20_000);
    model.load(null)
      .then(() => setReady(true))
      .catch(() => setLoadFailed(true))
      .finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, [model, ready]);

  useEffect(() => {
    model.setSaveErrorHandler(() => showToast(mode === "cloud" ? "No se pudo sincronizar con el servidor" : "No se pudo guardar en este navegador"));
    sync?.setErrorHandler(() => showToast("Un cambio no se pudo guardar en tu cuenta"));
    const flush = () => { model.flush().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, model, sync, showToast]);

  const stats = useMemo(() => new WorkoutStats(model), [model]);
  const actions = useMemo(
    () => createActions({
      model, stats, sync, showToast, setWeek, setDay, goTo: navigateTab, setRest, setSummary, setFocus,
      addRecord: (hit: RecordHit) => setRecords((list) => [...list, hit]),
    }),
    [model, stats, sync, showToast],
  );

  const focus = today ? calendar.focusFor(today) : null;
  const week = Math.min(selectedWeek ?? focus?.week ?? 1, model.weeksCount);
  const day = selectedDay ?? focus?.day ?? 1;
  const value: WorkoutContextValue = { model, stats, calendar, diary, mode, email, sync: syncStatus, today, ready, loadFailed, version, week, day, toast, rest, records, summary, active, focusOpen: focusOpen && !!active, actions };
  return <WorkoutContext value={value}>{children}</WorkoutContext>;
}

interface ActionDeps {
  model: WorkoutModel;
  stats: WorkoutStats;
  sync: ServerActionWorkoutRepository | null;
  showToast: (text: string, ms?: number) => void;
  setWeek: (w: number | null) => void;
  setDay: (d: number | null) => void;
  goTo: (path: string) => void;
  setRest: (rest: RestTimer | null | ((r: RestTimer | null) => RestTimer | null)) => void;
  setSummary: (summary: DaySummaryInfo | null) => void;
  setFocus: (open: boolean) => void;
  addRecord: (hit: RecordHit) => void;
}

function createActions({ model, stats, sync, showToast, setWeek, setDay, goTo, setRest, setSummary, setFocus, addRecord }: ActionDeps) {
  const backup = new BackupService(model);
  const recordTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const celebrated = new Set<string>();

  const startRest = (seconds: number) => {
    unlockAudio();
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  };

  const minutesSince = (started: number | null) => (started ? Math.max(1, Math.round((Date.now() - started) / 60000)) : null);
  const isActive = (w: number, d: number) => {
    const a = getActiveWorkout();
    return !!a && a.week === w && a.day === d;
  };

  // Al completar el día se muestra el resumen (con la duración si se conoce) y
  // termina el entreno en curso.
  const completeDay = (w: number, d: number) => {
    if (!model.syncDayCompleted(w, d)) return;
    const started = isActive(w, d) ? getActiveWorkout()!.startedAt : readSessionStart(w, d);
    clearSessionStart(w, d);
    if (isActive(w, d)) { setActiveWorkout(null); setFocus(false); }
    setSummary({ week: w, day: d, minutes: minutesSince(started) });
  };

  // Mientras se escribe en una serie el día no se da por completado (con el peso de la
  // última serie ya cuenta como anotada, pero faltan las repeticiones): se espera a
  // cerrar el teclado o tocar fuera.
  let waiting: [number, number] | null = null;
  const typing = () => document.activeElement instanceof HTMLInputElement && !!document.activeElement.closest(".exercise");
  const completeWhenDone = (w: number, d: number) => {
    if (typing()) waiting = [w, d];
    else completeDay(w, d);
  };
  // (Solo en el navegador: el controlador también se pinta en el servidor.)
  if (typeof document !== "undefined") document.addEventListener("focusout", () => setTimeout(() => {
    if (!waiting || typing()) return;
    const [w, d] = waiting;
    waiting = null;
    completeDay(w, d);
  }, 0));

  // Al anotar algo sin entreno en curso, empieza solo (desde la primera anotación).
  const autoStart = (w: number, d: number) => {
    if (getActiveWorkout() || model.isDayCompleted(w, d)) return;
    setActiveWorkout({ week: w, day: d, startedAt: readSessionStart(w, d) ?? Date.now() });
  };

  // Récord: se comprueba cuando se deja de escribir (1,5 s) para no avisar con
  // cada tecla; compara el 1RM estimado de la serie con el mejor anterior.
  const checkRecord = (w: number, d: number, id: number, s: number) => {
    const key = [w, d, id, s].join("|");
    clearTimeout(recordTimers.get(key));
    recordTimers.set(key, setTimeout(() => {
      const x = model.findExercise(id);
      if (!x || s > x.sets) return;
      const e = model.getEntry(w, d, id, s);
      const weight = Number(e.weight), reps = Number(e.reps);
      if (!(weight > 0 && reps > 0)) return;
      const previous = stats.record(x, w + "|" + s), value = estimate1RM(weight, reps);
      const tag = key + ":" + value;
      if (!previous || value <= previous.best1RM.value + 0.001 || celebrated.has(tag)) return;
      celebrated.add(tag);
      addRecord({ exerciseId: id, day: d, weight, reps });
      showToast("🏆 ¡Nuevo récord en " + x.name + "! " + weight.toLocaleString("es-ES") + " kg × " + reps, 3500);
    }, 1500));
  };

  return {
    selectDay: setDay,

    startDay(d: number) {
      setDay(d);
      goTo("/entrenar");
    },

    setEntry(w: number, d: number, id: number, s: number, field: SetField, value: string) {
      // Límites de la base de datos: carga hasta 9999,99 kg; repeticiones razonables.
      const max = field === "weight" ? MAX_WEIGHT : field === "reps" ? MAX_REPS : Infinity;
      if (Number(value) > max) { showToast(field === "weight" ? "La carga máxima es 9999 kg" : "Máximo 999 repeticiones"); return; }
      const before = model.getEntry(w, d, id, s);
      model.setEntryField(w, d, id, s, field, value, todayISO());
      if (value.trim()) { markSessionStart(w, d); autoStart(w, d); }
      // Al anotar las repeticiones de una serie empieza el descanso, salvo entre los
      // ejercicios de una superserie (se hacen seguidos).
      const x = model.findExercise(id);
      const list = model.exercisesOfDay(d);
      const linked = !!x?.superset && list.indexOf(x) < list.length - 1;
      const prefs = getRestPrefs();
      if (field === "reps" && !String(before.reps ?? "").trim() && value.trim() && prefs.enabled && !linked) startRest(prefs.seconds);
      if (field !== "note") checkRecord(w, d, id, s);
      completeWhenDone(w, d);
    },

    // Copia en las series vacías lo que se hizo la última vez (carga y repeticiones).
    repeatLast(w: number, d: number, id: number) {
      const x = model.findExercise(id);
      const last = x && stats.lastBefore(x, w);
      if (!x || !last) return;
      const date = todayISO();
      let copied = 0;
      last.sets.forEach((r) => {
        const e = model.getEntry(w, d, id, r.set);
        if (e.weight || e.reps || r.set > x.sets) return;
        if (r.weight !== null) model.setEntryField(w, d, id, r.set, "weight", String(r.weight), date);
        if (r.reps !== null) model.setEntryField(w, d, id, r.set, "reps", String(r.reps), date);
        copied++;
      });
      if (!copied) return;
      markSessionStart(w, d);
      autoStart(w, d);
      showToast("↺ Copiado de la semana " + last.week);
      completeWhenDone(w, d);
    },

    // Tick manual: cuenta el ejercicio como hecho aunque no tenga series anotadas.
    toggleExerciseChecked(w: number, d: number, id: number) {
      model.toggleExerciseChecked(w, d, id, todayISO());
      markSessionStart(w, d);
      autoStart(w, d);
      completeDay(w, d);
    },

    // ---- Entreno en curso ----
    startWorkout(w: number, d: number) {
      const current = getActiveWorkout();
      if (current && !(current.week === w && current.day === d)
        && !confirm("Ya tienes un entreno en curso (Día " + current.day + " · " + DAY_NAMES[current.day] + "). ¿Empezar este en su lugar?")) return;
      unlockAudio();
      markSessionStart(w, d);
      setActiveWorkout({ week: w, day: d, startedAt: readSessionStart(w, d) ?? Date.now() });
      setWeek(w);
      setDay(d);
      goTo("/entrenar");
      setFocus(true);
      showToast("💪 ¡Entreno en marcha! Día " + d + " · " + DAY_NAMES[d]);
    },

    // Vuelve a la pantalla completa del entreno en curso desde cualquier pestaña.
    openWorkout() {
      const a = getActiveWorkout();
      if (!a) return;
      setWeek(a.week);
      setDay(a.day);
      goTo("/entrenar");
      setFocus(true);
    },

    // Minimiza la pantalla completa: se vuelve a la lista con la barra del entreno.
    closeFocus() {
      setFocus(false);
    },

    // Termina el entreno: sin nada anotado se descarta; si quedan ejercicios se pide
    // confirmación. Después se muestra el resumen con la duración.
    finishWorkout() {
      const a = getActiveWorkout();
      if (!a) return;
      const { week: w, day: d } = a;
      const list = model.exercisesOfDay(d);
      const started = list.some((x) => model.isExerciseDone(w, d, x) || model.loggedSets(w, d, x) > 0);
      if (!started) {
        if (!confirm("No has anotado nada todavía. ¿Descartar el entreno?")) return;
        setActiveWorkout(null);
        clearSessionStart(w, d);
        setRest(null);
        setFocus(false);
        showToast("Entreno descartado");
        return;
      }
      const left = list.filter((x) => !model.isExerciseDone(w, d, x)).length;
      if (left > 0 && !confirm((left === 1 ? "Queda 1 ejercicio" : "Quedan " + left + " ejercicios") + " sin terminar. ¿Terminar el entreno igualmente?")) return;
      setActiveWorkout(null);
      clearSessionStart(w, d);
      setRest(null);
      setFocus(false);
      setSummary({ week: w, day: d, minutes: minutesSince(a.startedAt) });
    },

    // ---- Descanso entre series ----
    startRest,
    addRest(seconds: number) {
      setRest((r) => (r ? { endsAt: Math.max(Date.now(), r.endsAt) + seconds * 1000, total: r.total + seconds } : r));
    },
    stopRest() {
      setRest(null);
    },

    // Guarda las medidas de un día; sin ninguna (o null) las borra.
    setBodyMetrics(date: string, metrics: BodyMetrics | null) {
      model.setBodyMetrics(date, metrics);
      showToast(metrics && Object.keys(metrics).length ? "Medidas guardadas" : "Medidas borradas");
    },

    closeSummary() {
      setSummary(null);
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
      showToast("Semana del ciclo actualizada");
    },

    addExercise(d: number, data: NewExerciseInput) {
      if (!data.name.trim()) return false;
      model.addExercise(d, { ...data, name: data.name.trim(), target: data.target.trim(), note: data.note.trim() });
      showToast("Ejercicio añadido al Día " + d);
      return true;
    },

    updateExercise(id: number, data: NewExerciseInput) {
      if (!data.name.trim()) return false;
      model.updateExercise(id, { ...data, name: data.name.trim(), target: data.target.trim(), note: data.note.trim() });
      showToast("Ejercicio actualizado");
      return true;
    },

    moveExercise(id: number, direction: -1 | 1) {
      model.moveExercise(id, direction);
    },

    // Rutina de un amigo: se añade a la propia o la sustituye (borrando la actual).
    importRoutine(list: (NewExerciseInput & { day: number })[], replace: boolean) {
      if (replace) {
        const hasData = model.routine.some((x) => model.exerciseHasEntries(x.id));
        if (!confirm(hasData ? "Se borrarán tus ejercicios actuales y todos sus registros. ¿Continuar?" : "Se sustituirán tus ejercicios actuales. ¿Continuar?")) return false;
        model.routine.map((x) => x.id).forEach((id) => model.removeExercise(id));
      }
      const valid = list.filter((x) => x.day >= 1 && x.day <= 5 && x.name?.trim());
      valid.forEach((x) => model.addExercise(x.day, { name: x.name.trim(), sets: x.sets, target: x.target ?? "", note: x.note ?? "", superset: !!x.superset }));
      showToast(valid.length + " ejercicios importados");
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
      if (!confirm("¿Borrar todos los registros, marcas de días completados, peso y medidas? Esta acción no se puede deshacer.")) return;
      model.clearLogs();
      showToast("Registros borrados");
    },

    // Cierra la sesión tras guardar lo pendiente y borra la caché offline de este
    // dispositivo para que la siguiente persona no vea páginas de esta cuenta.
    async signOut() {
      await model.flush().catch(() => {});
      if (sync?.hasPending()) { showToast("Hay cambios sin enviar: conéctate a internet para cerrar sesión"); return; }
      if ("caches" in window) await caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      sync?.clearLocal();
      await signOutAction();
    },

    showToast,
  };
}

// Hora a la que se empezó a entrenar un día (para la duración del resumen). Se
// guarda en el dispositivo; si es de hace más de 6 h se considera otra sesión.
const sessionKey = (w: number, d: number) => "rutina:started:" + w + "|" + d;
const SESSION_MAX_MS = 6 * 3600_000;

function readSessionStart(w: number, d: number) {
  try {
    const t = Number(localStorage.getItem(sessionKey(w, d)));
    return t && Date.now() - t < SESSION_MAX_MS ? t : null;
  } catch {
    return null;
  }
}

function markSessionStart(w: number, d: number) {
  if (readSessionStart(w, d)) return;
  try {
    localStorage.setItem(sessionKey(w, d), String(Date.now()));
  } catch {
    // Sin almacenamiento el resumen no muestra la duración.
  }
}

function clearSessionStart(w: number, d: number) {
  try {
    localStorage.removeItem(sessionKey(w, d));
  } catch {
    // Nada que limpiar.
  }
}

// Aviso flotante: muestra un texto y lo oculta tras 1,8 s.
function createToaster(setToast: (update: (t: { text: string; visible: boolean }) => { text: string; visible: boolean }) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (text: string, ms = 1800) => {
    setToast(() => ({ text, visible: true }));
    clearTimeout(timer);
    timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), ms);
  };
}

// Cambio de pestaña instantáneo: se actualiza la URL en el navegador (Next sincroniza
// usePathname con history.pushState) sin pedir la página al servidor.
// Navegación entre pestañas desde dentro de la app (p. ej. "Entrenar →" en Rutina): si
// AppShell ha registrado su animación de carrusel se usa; si no, cambio directo.
let tabAnimator: ((path: string) => void) | null = null;
export function registerTabAnimator(fn: ((path: string) => void) | null) {
  tabAnimator = fn;
}
export function navigateTab(path: string) {
  if (tabAnimator) tabAnimator(path);
  else switchTab(path);
}

export function switchTab(path: string, resetScroll = true) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  if (resetScroll) window.scrollTo(0, 0);
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
