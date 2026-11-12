"use client";

import { createContext, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import { BackupService } from "@/domain/backup-service";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { formatShortDate, isISODate, todayISO } from "@/domain/calendar";
import { MAX_DAYS } from "@/domain/snapshot";
import type { BodyMetrics, NewExerciseInput, SetField, WeekSchedule, WorkoutSnapshot } from "@/domain/types";
import { WorkoutCalendar, type PlannedSession } from "@/domain/workout-calendar";
import { WorkoutDiary } from "@/domain/workout-diary";
import { WorkoutModel } from "@/domain/workout-model";
import { WorkoutStats } from "@/domain/workout-stats";
import { getActiveWorkout, setActiveWorkout, subscribeActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";
import { unlockAudio } from "@/lib/alerts";
import { cleanNickname, nicknamePending, readNickname, setNicknamePending, storeNickname, subscribeNickname } from "@/lib/nickname";
import { getNickname, saveNickname } from "@/app/actions/profile";
import { getRestPrefs } from "@/lib/preferences";
import type { StorageMode } from "@/lib/workout-data";
import { askConfirm } from "@/components/confirm-dialog";
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
  round: number;
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
  // Vez del día en esa semana (1.ª, 2.ª…: un día se puede repetir en la misma semana).
  round: number;
  // Fecha pasada que se está apuntando (null = hoy).
  logDate: string | null;
  // El día lo ha elegido el usuario (no es el que toca hoy según el calendario).
  picked: boolean;
  toast: Toast;
  rest: RestTimer | null;
  records: RecordHit[];
  summary: DaySummaryInfo | null;
  // Entreno en curso en este dispositivo (null si no hay ninguno).
  active: ActiveWorkout | null;
  // Nombre o apodo con el que la app se dirige a la persona (null = aún no lo ha dicho).
  nickname: string | null;
  // Ya se sabe si tiene apodo (con cuenta, tras preguntarlo al servidor): si no, se pregunta.
  nicknameReady: boolean;
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
  const [selectedRound, setRound] = useState<number | null>(null);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>({ text: "", visible: false });
  const [showToast] = useState(() => createToaster(setToast));
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [records, setRecords] = useState<RecordHit[]>([]);
  const [summary, setSummary] = useState<DaySummaryInfo | null>(null);
  const version = useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion);
  const today = useSyncExternalStore(subscribeToDayChange, todayISO, () => null);
  const active = useSyncExternalStore(subscribeActiveWorkout, getActiveWorkout, () => null);
  const nickname = useSyncExternalStore(subscribeNickname, () => readNickname(email), () => null);
  const [nicknameSynced, setNicknameSynced] = useState(mode !== "cloud");
  // Con cuenta, el apodo vive también en ella: el de la cuenta manda (pudo cambiarse en
  // otro dispositivo), salvo que aquí haya un cambio sin subir o la cuenta no tenga.
  useEffect(() => {
    if (mode !== "cloud") return;
    let alive = true;
    getNickname()
      .then((res) => {
        if (!alive || !res.ok) return;
        const local = readNickname(email);
        if (local && (nicknamePending(email) || !res.data)) {
          saveNickname(local).then((saved) => { if (saved.ok) setNicknamePending(email, false); }).catch(() => {});
        } else if (res.data && res.data !== local) storeNickname(email, res.data);
      })
      .catch(() => {})
      .finally(() => { if (alive) setNicknameSynced(true); });
    return () => { alive = false; };
  }, [mode, email]);
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
      model, stats, calendar, sync, showToast, setWeek, setDay, setRound, setLogDate, goTo: navigateTab, setRest, setSummary,
      addRecord: (hit: RecordHit) => setRecords((list) => [...list, hit]),
      account: email, cloud: mode === "cloud",
    }),
    [model, stats, calendar, sync, showToast, email, mode],
  );

  const focus = today ? calendar.focusFor(today) : null;
  const week = Math.min(selectedWeek ?? focus?.week ?? 1, model.weeksCount);
  const day = selectedDay ?? focus?.day ?? 1;
  // Sin elegir otra, la última vez de ese día con algo anotado.
  // Sin elegir otra: la vez que toca hoy (un día puede ir en varios días de la semana) o,
  // si ya se repitió más veces, la última con algo anotado.
  const round = selectedRound ?? Math.max(selectedDay === null && selectedWeek === null ? focus?.round ?? 1 : 1, model.lastRound(week, day));
  const value: WorkoutContextValue = { model, stats, calendar, diary, mode, email, sync: syncStatus, today, ready, loadFailed, version, week, day, round, logDate, picked: selectedDay !== null || selectedWeek !== null, toast, rest, records, summary, active, nickname, nicknameReady: nicknameSynced || !!nickname, actions };
  return <WorkoutContext value={value}>{children}</WorkoutContext>;
}

interface ActionDeps {
  model: WorkoutModel;
  stats: WorkoutStats;
  calendar: WorkoutCalendar;
  sync: ServerActionWorkoutRepository | null;
  showToast: (text: string, ms?: number, icon?: ToastIcon) => void;
  setWeek: (w: number | null) => void;
  setDay: (d: number | null) => void;
  setRound: (r: number | null) => void;
  setLogDate: (date: string | null) => void;
  goTo: (path: string) => void;
  setRest: (rest: RestTimer | null | ((r: RestTimer | null) => RestTimer | null)) => void;
  setSummary: (summary: DaySummaryInfo | null) => void;
  addRecord: (hit: RecordHit) => void;
  account: string | null;
  cloud: boolean;
}

function createActions({ model, stats, calendar, sync, showToast, setWeek, setDay, setRound, setLogDate, goTo, setRest, setSummary, addRecord, account, cloud }: ActionDeps) {
  const backup = new BackupService(model);
  const recordTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const celebrated = new Set<string>();
  // Fecha pasada que se está apuntando («Apuntar otra fecha»); null = hoy.
  let pastDate: string | null = null;
  const logDateNow = () => pastDate ?? todayISO();
  const choosePastDate = (date: string | null) => {
    pastDate = date;
    setLogDate(date);
  };

  const startRest = (seconds: number) => {
    unlockAudio();
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  };

  const minutesSince = (started: number | null) => (started ? Math.max(1, Math.round((Date.now() - started) / 60000)) : null);
  const isActive = (w: number, d: number, r: number) => {
    const a = getActiveWorkout();
    return !!a && a.week === w && a.day === d && (a.round ?? 1) === r;
  };

  // Al completar el día se muestra el resumen (con la duración si se conoce) y
  // termina el entreno en curso.
  const completeDay = (w: number, d: number, r: number) => {
    if (!model.syncDayCompleted(w, d, r)) return;
    const started = isActive(w, d, r) ? getActiveWorkout()!.startedAt : readSessionStart(w, d, r);
    clearSessionStart(w, d, r);
    if (isActive(w, d, r)) setActiveWorkout(null);
    setSummary({ week: w, day: d, round: r, minutes: pastDate ? null : minutesSince(started) });
  };

  // Mientras se escribe en una serie el día no se da por completado (con el peso de la
  // última serie ya cuenta como anotada, pero faltan las repeticiones): se espera a
  // cerrar el teclado o tocar fuera.
  let waiting: [number, number, number] | null = null;
  const typing = () => document.activeElement instanceof HTMLInputElement && !!document.activeElement.closest(".exercise");
  const completeWhenDone = (w: number, d: number, r: number) => {
    if (typing()) waiting = [w, d, r];
    else completeDay(w, d, r);
  };
  // (Solo en el navegador: el controlador también se pinta en el servidor.)
  if (typeof document !== "undefined") document.addEventListener("focusout", () => setTimeout(() => {
    if (!waiting || typing()) return;
    const [w, d, r] = waiting;
    waiting = null;
    completeDay(w, d, r);
  }, 0));

  // Al anotar algo sin entreno en curso, empieza solo (desde la primera anotación).
  // Al apuntar un día pasado no hay entreno en curso.
  const autoStart = (w: number, d: number, r: number) => {
    if (pastDate) return;
    markSessionStart(w, d, r);
    if (getActiveWorkout() || model.isDayCompleted(w, d, r)) return;
    setActiveWorkout({ week: w, day: d, round: r, startedAt: readSessionStart(w, d, r) ?? Date.now() });
  };

  // Récord: se comprueba cuando se deja de escribir (1,5 s) para no avisar con cada
  // tecla; la serie tiene que ser más pesada que la más pesada de antes.
  const checkRecord = (w: number, d: number, id: number, s: number, r: number) => {
    const key = [w, d, id, s, r].join("|");
    clearTimeout(recordTimers.get(key));
    recordTimers.set(key, setTimeout(() => {
      const x = model.findExercise(id);
      if (!x || s > x.sets) return;
      const e = model.getEntry(w, d, id, s, r);
      const weight = Number(e.weight), reps = Number(e.reps);
      if (!(weight > 0 && reps > 0)) return;
      const previous = stats.record(x, [w, r, s].join("|"));
      const tag = key + ":" + weight;
      if (!previous || weight <= previous.heaviest.weight || celebrated.has(tag)) return;
      celebrated.add(tag);
      addRecord({ exerciseId: id, day: d, weight, reps });
      showToast("¡Nuevo récord en " + x.name + "! " + weight.toLocaleString("es-ES") + " kg × " + reps, 3500, "trophy");
    }, 1500));
  };

  // Vuelve a seguir el día de hoy (sin día, vez ni fecha elegidos).
  const followToday = () => {
    choosePastDate(null);
    setWeek(null);
    setDay(null);
    setRound(null);
  };

  // Semana del ciclo de hoy (la que se ve sin elegir nada).
  const currentWeek = () => Math.min(Math.max(calendar.cycleWeekOf(todayISO()) ?? 1, 1), model.weeksCount);

  // Abre un día de rutina para hoy: si ya se hizo esta semana, en una tanda nueva.
  const openDay = (d: number) => {
    choosePastDate(null);
    setWeek(null);
    setDay(d);
    setRound(model.openRound(currentWeek(), d));
  };

  return {
    selectDay: openDay,

    // Guarda el nombre o apodo (en el dispositivo y, con cuenta, en ella y en sus grupos).
    setNickname(name: string) {
      const nickname = cleanNickname(name);
      if (!nickname) return false;
      storeNickname(account, nickname);
      if (cloud) {
        setNicknamePending(account, true);
        saveNickname(nickname)
          .then((res) => {
            if (res.ok) setNicknamePending(account, false);
            else showToast("No se pudo guardar tu nombre en la cuenta");
          })
          .catch(() => showToast("Sin conexión: tu nombre se guardará en la cuenta más tarde"));
      }
      return true;
    },

    startDay(d: number) {
      openDay(d);
      goTo("/entrenar");
    },

    // Vuelve a hacer el día que se está viendo, en una tanda nueva de la misma semana.
    repeatDay(w: number, d: number) {
      const r = model.openRound(w, d);
      setRound(r);
      showToast(model.dayName(d) + ": " + r + ".ª vez esta semana");
    },

    // Apunta un día de rutina hecho en una fecha pasada: se guarda con esa fecha y en la
    // semana del ciclo de esa fecha.
    logPastDay(date: string, d: number) {
      const week = isISODate(date) && date < todayISO() ? calendar.cycleWeekOf(date) : null;
      if (week === null || week < 1) { openDay(d); return; }
      model.ensureWeeks(week);
      choosePastDate(date);
      setWeek(week);
      setDay(d);
      setRound(model.openRound(week, d));
      showToast("Apuntando " + model.dayName(d) + " del " + formatShortDate(date));
    },

    setEntry(w: number, d: number, id: number, s: number, field: SetField, value: string, r = 1) {
      // Límites de la base de datos: carga hasta 9999,99 kg; repeticiones razonables.
      const max = field === "weight" ? MAX_WEIGHT : field === "reps" ? MAX_REPS : Infinity;
      if (Number(value) > max) { showToast(field === "weight" ? "La carga máxima es 9999 kg" : "Máximo 999 repeticiones"); return; }
      const before = model.getEntry(w, d, id, s, r);
      model.setEntryField(w, d, id, s, field, value, logDateNow(), r);
      if (value.trim()) autoStart(w, d, r);
      // Al anotar las repeticiones de una serie empieza el descanso, salvo entre los
      // ejercicios de una superserie (se hacen seguidos).
      const x = model.findExercise(id);
      const list = model.exercisesOfDay(d);
      const linked = !!x?.superset && list.indexOf(x) < list.length - 1;
      const prefs = getRestPrefs();
      if (field === "reps" && !String(before.reps ?? "").trim() && value.trim() && prefs.enabled && !linked) startRest(prefs.seconds);
      if (field !== "note") checkRecord(w, d, id, s, r);
      completeWhenDone(w, d, r);
    },

    // Copia en las series vacías lo que se hizo la última vez (carga y repeticiones).
    repeatLast(w: number, d: number, id: number, r = 1) {
      const x = model.findExercise(id);
      const last = x && stats.lastBefore(x, w, r);
      if (!x || !last) return;
      const date = logDateNow();
      let copied = 0;
      last.sets.forEach((v) => {
        const e = model.getEntry(w, d, id, v.set, r);
        if (e.weight || e.reps || v.set > x.sets) return;
        if (v.weight !== null) model.setEntryField(w, d, id, v.set, "weight", String(v.weight), date, r);
        if (v.reps !== null) model.setEntryField(w, d, id, v.set, "reps", String(v.reps), date, r);
        copied++;
      });
      if (!copied) return;
      autoStart(w, d, r);
      showToast("Copiado de la última vez (" + (last.date ? formatShortDate(last.date) : "semana " + last.week) + ")");
      completeWhenDone(w, d, r);
    },

    // Tick manual: cuenta el ejercicio como hecho aunque no tenga series anotadas.
    toggleExerciseChecked(w: number, d: number, id: number, r = 1) {
      model.toggleExerciseChecked(w, d, id, logDateNow(), r);
      autoStart(w, d, r);
      completeDay(w, d, r);
    },

    // ---- Entreno en curso (empieza solo al anotar la primera serie) ----
    // Termina el entreno: sin nada anotado se descarta; si quedan ejercicios se pide
    // confirmación. Después se muestra el resumen con la duración.
    async finishWorkout() {
      const a = getActiveWorkout();
      if (!a) return;
      const { week: w, day: d } = a, r = a.round ?? 1;
      const list = model.exercisesOfDay(d);
      const started = list.some((x) => model.isExerciseDone(w, d, x, r) || model.loggedSets(w, d, x, r) > 0);
      if (!started) {
        if (!await askConfirm({ title: "¿Descartar el entreno?", text: "No has anotado nada todavía.", action: "Descartar" })) return;
        setActiveWorkout(null);
        clearSessionStart(w, d, r);
        setRest(null);
        showToast("Entreno descartado");
        return;
      }
      const left = list.filter((x) => !model.isExerciseDone(w, d, x, r)).length;
      if (left > 0 && !await askConfirm({ title: "¿Terminar el entreno?", text: (left === 1 ? "Queda 1 ejercicio" : "Quedan " + left + " ejercicios") + " sin terminar.", action: "Terminar" })) return;
      setActiveWorkout(null);
      clearSessionStart(w, d, r);
      setRest(null);
      setSummary({ week: w, day: d, round: r, minutes: minutesSince(a.startedAt) });
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
    goToToday: followToday,

    // Abre un día planificado que no se hizo para registrarlo hoy.
    recoverSession(session: PlannedSession) {
      choosePastDate(null);
      setRound(session.round);
      setWeek(session.week);
      setDay(session.day);
      goTo("/entrenar");
      showToast("Hoy haces " + model.dayName(session.day) + " (era el " + formatShortDate(session.date) + ")");
    },

    setWeekdays(d: number, weekdays: number[]) {
      model.setWeekdays(d, weekdays);
    },

    // ---- Historial: editar y borrar un entreno ----
    // Abre en Hoy un entreno pasado (su semana, día y vez) para cambiar series; lo que se
    // anote se guarda con su fecha.
    editSession({ week, day, round, date }: { week: number; day: number; round: number; date: string }) {
      choosePastDate(date < todayISO() ? date : null);
      model.ensureWeeks(week);
      setWeek(week);
      setDay(day);
      setRound(round);
      goTo("/entrenar");
      showToast("Editando " + model.dayName(day) + " del " + formatShortDate(date));
    },

    // Borra un entreno entero (p. ej. marcado sin querer): deja de contar como hecho.
    async deleteSession({ week, day, round, date }: { week: number; day: number; round: number; date: string }) {
      if (!await askConfirm({ title: "¿Borrar el entreno?", text: "Se borrarán todas las series de " + model.dayName(day) + " del " + formatShortDate(date) + ". No se puede deshacer.", action: "Borrar entreno", danger: true })) return false;
      model.removeSession(week, day, round);
      if (isActive(week, day, round)) setActiveWorkout(null);
      clearSessionStart(week, day, round);
      showToast("Entreno borrado");
      return true;
    },

    // Cambia la fecha de un entreno (hasta hoy). Devuelve si se pudo.
    moveSession({ week, day, round }: { week: number; day: number; round: number }, date: string) {
      if (!isISODate(date) || date > todayISO() || (model.startDate && date < model.startDate)) return false;
      model.moveSession(week, day, round, date);
      showToast(model.dayName(day) + " pasado al " + formatShortDate(date));
      return true;
    },

    // ---- Días de rutina ----
    addDay(name: string) {
      const d = model.addDay(name);
      if (d !== null) showToast("Día «" + model.dayName(d) + "» añadido");
      return d;
    },

    renameDay(d: number, name: string) {
      if (!name.trim()) return false;
      model.renameDay(d, name);
      showToast("Nombre cambiado");
      return true;
    },

    // Color del día (spec rutina R7): cambia al momento en toda la app.
    setDayColor(d: number, color: string) {
      model.setDayColor(d, color);
    },

    // Pregunta antes: se borran sus ejercicios y todos sus registros.
    async deleteDay(d: number) {
      const name = model.dayName(d), count = model.exercisesOfDay(d).length;
      const text = count ? "Se borrarán sus " + count + " ejercicios y todos sus registros. No se puede deshacer." : "No tiene ejercicios.";
      if (!await askConfirm({ title: "¿Eliminar «" + name + "»?", text, action: "Eliminar día", danger: count > 0 })) return false;
      model.removeDay(d);
      followToday();
      showToast("Día «" + name + "» eliminado");
      return true;
    },

    applySchedulePreset(schedule: WeekSchedule, label: string) {
      // Los planes son para los días 1–5: los demás días conservan los suyos.
      model.setSchedule({ ...model.schedule, ...schedule });
      showToast("Calendario: " + label);
    },

    setStartDate(iso: string) {
      model.setStartDate(iso);
      followToday();
      showToast("Semana actualizada");
    },

    addExercise(d: number, data: NewExerciseInput) {
      if (!data.name.trim()) return false;
      model.addExercise(d, { ...data, name: data.name.trim(), target: data.target.trim(), note: data.note.trim() });
      showToast("Ejercicio añadido a " + model.dayName(d));
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

    // Fin del asistente de cuentas nuevas: rutina elegida (null = la recomendada que ya
    // tiene, "empty" = vacía, o la lista de un amigo) y días de la semana de cada rutina.
    finishSetup(schedule: WeekSchedule, routine: (NewExerciseInput & { day: number })[] | "empty" | null) {
      if (routine) {
        model.routine.map((x) => x.id).forEach((id) => model.removeExercise(id));
        if (routine !== "empty") {
          routine.filter((x) => model.days.includes(x.day) && x.name?.trim())
            .forEach((x) => model.addExercise(x.day, { name: x.name.trim(), sets: x.sets, target: x.target ?? "", note: x.note ?? "", superset: !!x.superset }));
        }
      }
      model.setSchedule(schedule);
      followToday();
      goTo(routine === "empty" ? "/rutina" : "/entrenar");
      showToast(routine === "empty" ? "¡Listo! Añade tus ejercicios a cada día" : "¡Todo listo!", undefined, "strong");
    },

    // Rutina de un amigo: se añade a la propia o la sustituye (borrando la actual).
    async importRoutine(list: (NewExerciseInput & { day: number })[], replace: boolean) {
      if (replace) {
        const hasData = model.routine.some((x) => model.exerciseHasEntries(x.id));
        if (!await askConfirm({ title: "¿Sustituir tu rutina?", text: hasData ? "Se borrarán tus ejercicios actuales y todos sus registros." : "Se sustituirán tus ejercicios actuales.", action: "Sustituir", danger: hasData })) return false;
        model.routine.map((x) => x.id).forEach((id) => model.removeExercise(id));
      }
      // Los días del amigo que no existen aquí se crean (con nombre «Día N», se puede cambiar).
      list.filter((x) => Number.isInteger(x.day) && x.day >= 1 && x.day <= MAX_DAYS && !model.days.includes(x.day)).forEach((x) => model.addDay("Día " + x.day, x.day));
      const valid = list.filter((x) => model.days.includes(x.day) && x.name?.trim());
      valid.forEach((x) => model.addExercise(x.day, { name: x.name.trim(), sets: x.sets, target: x.target ?? "", note: x.note ?? "", superset: !!x.superset }));
      showToast(valid.length + " ejercicios importados");
      return true;
    },

    async deleteExercise(id: number) {
      const x = model.findExercise(id);
      if (!x) return;
      if (model.exerciseHasEntries(id) && !await askConfirm({ title: "¿Eliminar «" + x.name + "»?", text: "Tiene registros guardados: también se borrarán.", action: "Eliminar", danger: true })) return;
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
      if (!await askConfirm({ title: "¿Restaurar esta copia?", text: "Los registros actuales se sustituirán por los de la copia.", action: "Restaurar", danger: true })) return;
      model.restore(restored);
      showToast("Copia restaurada");
    },

    async clearData() {
      if (!await askConfirm({ title: "¿Borrar todos los registros?", text: "Se borrarán las series, los días completados, el peso y las medidas. No se puede deshacer.", action: "Borrar todo", danger: true })) return;
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

    // La cuenta ya se ha borrado (y la sesión cerrado): limpia este dispositivo y vuelve al inicio.
    accountDeleted() {
      if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      sync?.clearLocal();
      window.location.replace("/login");
    },

    showToast,
  };
}

// Hora a la que se empezó a entrenar un día (para la duración del resumen). Se
// guarda en el dispositivo; si es de hace más de 6 h se considera otra sesión.
const sessionKey = (w: number, d: number, r: number) => "rutina:started:" + w + "|" + d + (r > 1 ? "|" + r : "");
const SESSION_MAX_MS = 6 * 3600_000;

function readSessionStart(w: number, d: number, r: number) {
  try {
    const t = Number(localStorage.getItem(sessionKey(w, d, r)));
    return t && Date.now() - t < SESSION_MAX_MS ? t : null;
  } catch {
    return null;
  }
}

function markSessionStart(w: number, d: number, r: number) {
  if (readSessionStart(w, d, r)) return;
  try {
    localStorage.setItem(sessionKey(w, d, r), String(Date.now()));
  } catch {
    // Sin almacenamiento el resumen no muestra la duración.
  }
}

function clearSessionStart(w: number, d: number, r: number) {
  try {
    localStorage.removeItem(sessionKey(w, d, r));
  } catch {
    // Nada que limpiar.
  }
}

// Aviso flotante: muestra un texto y lo oculta tras 1,8 s.
// Icono opcional que se pinta delante del texto del aviso.
export type ToastIcon = "trophy" | "clock" | "strong";
type Toast = { text: string; visible: boolean; icon?: ToastIcon };

function createToaster(setToast: (update: (t: Toast) => Toast) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (text: string, ms = 1800, icon?: ToastIcon) => {
    setToast(() => ({ text, visible: true, icon }));
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

// La posición del scroll de cada pestaña la guarda y recupera AppShell.
export function switchTab(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
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
