"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { addDays, formatLongDate, formatShortDate, WEEKDAY_NAMES, weekdayOf } from "@/domain/calendar";
import { MAX_ROUNDS } from "@/domain/snapshot";
import type { Exercise } from "@/domain/types";
import type { SetResult } from "@/domain/workout-stats";
import { notifyState, requestPermissions, subscribePermission, type NotifyState } from "@/lib/permissions";
import { ExerciseLogger } from "./exercise-logger";
import { PlateCalculator } from "./plate-calculator";
import { ArrowIcon, BellIcon, CheckIcon, ChevronIcon, DumbbellIcon, FlameIcon, RepeatIcon, SleepIcon, WarningIcon } from "./icons";

export const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Vista "Hoy": qué toca hoy en grande (con lo que llevas hecho) y la lista de ejercicios:
// al tocar uno se despliega para anotar sus series con botones + / −. Lo que quedó
// pendiente está dentro de "Hacer otro día" (que avisa de cuántos hay), para que la
// pantalla quede limpia. Es la única forma de anotar: para corregir se toca la serie.
export function TrainingView() {
  const { model, calendar, today, week, day, round, logDate, picked, active, nickname, actions } = useWorkout();
  const [otherDay, setOtherDay] = useState(false);
  const [plates, setPlates] = useState(false);
  // Fecha elegida en «Hacer otro día» ("" = hoy).
  const [when, setWhen] = useState("");
  const done = model.isDayCompleted(week, day, round);
  const planned = calendar.plannedDate(week, day, round);
  const list = model.exercisesOfDay(day);
  // Entreno en curso en este día (y en esta vez del día).
  const live = !!active && active.week === week && active.day === day && (active.round ?? 1) === round;
  if (!today) return null;

  const resting = !picked && calendar.sessionsOn(today).length === 0;
  // El día en pantalla no se ofrece como pendiente; en un día de descanso no hay día en
  // pantalla (week/day apuntan al último de la semana), así que sí sale.
  const missed = calendar.missedSessions(today).filter((s) => resting || !(s.week === week && s.day === day && s.round === round));
  const totalSets = list.reduce((n, x) => n + x.sets, 0);
  const exDone = list.filter((x) => model.isExerciseDone(week, day, x, round)).length;
  // Con apodo, la app se dirige a la persona: "Joel, hoy toca".
  const you = (text: string) => (nickname ? nickname + ", " + text.charAt(0).toLowerCase() + text.slice(1) : text);
  // Con una fecha pasada: «Editando» si ese entreno ya tenía algo, «Apuntando» si es nuevo.
  const label = (live ? you("Entreno en curso")
    : logDate ? you((done || exDone > 0 ? "Editando el " : "Apuntando el ") + formatShortDate(logDate))
    : done ? (nickname ? "¡Hecho, " + nickname + "!" : "¡Hecho!")
    : planned && planned < today ? you("Para hacer hoy · era el " + formatShortDate(planned))
    : picked && planned !== today ? you("Vas a hacer") : you("Hoy toca"))
    + (round > 1 ? " · " + round + ".ª vez esta semana" : "");
  const pickDay = (d: number) => {
    if (when && when < today) actions.logPastDay(when, d);
    else actions.selectDay(d);
    setOtherDay(false);
    setWhen("");
  };

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">{formatLongDate(today)}</div>
          <h1>Hoy</h1>
        </div>
        {model.startDate && <StreakPill today={today} />}
      </div>

      {resting ? <RestCard /> : (
        <section className="hero" style={{ "--hero": "var(--day" + day + ")", "--p": (list.length ? exDone / list.length : 0) * 100 + "%" } as React.CSSProperties}>
          <div className="hero-top">
            <div className="hero-ring" role="img" aria-label={exDone + " de " + list.length + " ejercicios hechos"}><span>{exDone}/{list.length}</span></div>
            <div className="hero-text">
              <small>{label}</small>
              <h2>{model.dayName(day)}</h2>
              <p>{list.length} {list.length === 1 ? "ejercicio" : "ejercicios"} · {totalSets} series</p>
            </div>
          </div>
          {list.length === 0 && <p className="hero-note">No tiene ejercicios: añádelos en Rutina.</p>}
          {live && !done && <button type="button" className="finish-workout" onClick={actions.finishWorkout}>Terminar entreno</button>}
        </section>
      )}
      {picked && <button type="button" className="other-day" onClick={actions.goToToday}><ArrowIcon dir="left" />Volver a hoy</button>}
      {!resting && done && list.length > 0 && round < MAX_ROUNDS && (
        <button type="button" className="other-day" onClick={() => actions.repeatDay(week, day)}><RepeatIcon />Repetir este día</button>
      )}

      {!resting && list.length > 0 && <TodayList key={week + "-" + day + "-" + round} done={done} />}

      <div className="hoy-links">
        <button type="button" className="other-day" aria-expanded={otherDay} onClick={() => setOtherDay(!otherDay)}>
          Hacer otro día{missed.length > 0 && <span className="pending-badge">{missed.length} {missed.length === 1 ? "pendiente" : "pendientes"}</span>} <ArrowIcon dir={otherDay ? "up" : "down"} />
        </button>
      </div>
      {otherDay && missed.length > 0 && (
        <div className="pending-list">
          <div className="pending-title">Pendientes</div>
          {missed.map((s) => (
            <div className="pending-card" key={s.week + "|" + s.day + "|" + s.round}>
              <div><b><WarningIcon /> {model.dayName(s.day)}</b><span>Era el {formatLongDate(s.date).toLowerCase()}</span></div>
              <button type="button" aria-label={"Hacer hoy " + model.dayName(s.day)} onClick={() => { actions.recoverSession(s); setOtherDay(false); }}>Hacer hoy</button>
            </div>
          ))}
        </div>
      )}
      {otherDay && (
        <>
          {/* Para apuntar un entreno de un día pasado: primero la fecha, luego el día. */}
          <label className="log-date">
            <span>Fecha</span>
            <input type="date" value={when || today} min={model.startDate ?? undefined} max={today}
              onChange={(ev) => setWhen(ev.target.value)} />
          </label>
          <div className="days">
            {model.days.map((d) => (
              <button key={d} className={"day" + (d === day && !resting ? " active" : "")} onClick={() => pickDay(d)}>
                <i className="swatch" style={{ background: "var(--day" + d + ")" }} /><b>{model.dayName(d)}</b>{model.hasLoggedSets(week, d) && <i className="dot" />}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="plates-open" aria-label="Calculadora de discos" onClick={() => setPlates(true)}>
        <span className="plates-ico"><DumbbellIcon /></span>
        <span className="plates-text"><b>Calculadora de discos</b><small>Qué discos poner a cada lado de la barra</small></span>
        <ChevronIcon />
      </button>
      {plates && <PlateCalculator onClose={() => setPlates(false)} />}
      <PermissionCard />
    </section>
  );
}

// Ejercicios del día en pantalla. Al entrar no hay ninguno abierto (spec hoy R8): se toca el
// que se va a hacer y se abre ese (uno cada vez); al terminar el abierto, se abre solo el
// siguiente que falte.
function TodayList({ done }: { done: boolean }) {
  const { model, week, day, round } = useWorkout();
  const list = model.exercisesOfDay(day);
  const isDone = (id: number | null) => list.some((x) => x.id === id && model.isExerciseDone(week, day, x, round));
  const [openId, setOpenId] = useState<number | null>(null);
  const [openWasDone, setOpenWasDone] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // El abierto acaba de quedar hecho: se pasa al siguiente que falte.
  if (openId !== null && isDone(openId) !== openWasDone) {
    if (!openWasDone) setOpenId(list.find((x) => !model.isExerciseDone(week, day, x, round))?.id ?? null);
    setOpenWasDone(false);
  }
  // Al abrir uno, su cabecera se coloca arriba para ver las series.
  useEffect(() => {
    if (openId === null) return;
    const item = ref.current?.querySelector(".peek-item.open");
    if (!item) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    item.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [openId]);

  const toggle = (id: number) => {
    // El primer toque sirve para pedir los permisos de los avisos y activar el sonido.
    void requestPermissions();
    setOpenId(openId === id ? null : id);
    setOpenWasDone(isDone(id));
  };

  return (
    <section className="chart peek" ref={ref} style={{ "--dc": "var(--day" + day + ")" } as React.CSSProperties}>
      <h3>{done ? "Lo que hiciste" : "Lo que vas a hacer"}</h3>
      <p className="peek-hint">Toca un ejercicio para anotar tus series.</p>
      {list.map((x, i) => {
        const hecho = model.isExerciseDone(week, day, x, round);
        const open = openId === x.id;
        return (
          <div className={"peek-item" + (open ? " open" : "")} key={x.id}>
            <button type="button" className={"peek-row" + (hecho ? " done" : "")} aria-expanded={open} onClick={() => toggle(x.id)}>
              <span className="n">{hecho ? <CheckIcon /> : i + 1}</span>
              <div><b>{x.name}</b><small>{x.prescription}</small></div>
              <ChevronIcon />
            </button>
            {open && <div className="peek-detail"><ExerciseLogger exercise={x} superset={supersetRole(list, i)} /></div>}
          </div>
        );
      })}
    </section>
  );
}

// "Ahora no" en la tarjeta de los avisos: no vuelve a salir en este dispositivo (se
// pueden activar después en Ajustes → Permisos).
const PERM_CARD_KEY = "rutina:perm-card-hidden";
const PERM_CARD_EVENT = "rutina-perm-card";
const permCardHidden = () => {
  try {
    return localStorage.getItem(PERM_CARD_KEY) === "1";
  } catch {
    return false;
  }
};
const subscribePermCard = (onChange: () => void) => {
  window.addEventListener(PERM_CARD_EVENT, onChange);
  return () => window.removeEventListener(PERM_CARD_EVENT, onChange);
};
function hidePermCard() {
  try {
    localStorage.setItem(PERM_CARD_KEY, "1");
  } catch {
    // Sin almacenamiento se oculta igual hasta recargar.
  }
  window.dispatchEvent(new Event(PERM_CARD_EVENT));
}

// Mientras no se hayan dado los permisos, invita a darlos (avisos del descanso).
function PermissionCard() {
  const permission = useSyncExternalStore(subscribePermission, notifyState, () => "granted" as NotifyState);
  const hidden = useSyncExternalStore(subscribePermCard, permCardHidden, () => true);
  if (permission !== "default" || hidden) return null;
  return (
    <div className="perm-card">
      <BellIcon />
      <div><b>Activa los avisos</b><span>Para que el móvil te avise al acabar el descanso, aunque estés en otra app.</span></div>
      <div className="perm-actions">
        <button type="button" className="perm-later" onClick={hidePermCard}>Ahora no</button>
        <button type="button" onClick={() => { void requestPermissions(); }}>Activar</button>
      </div>
    </div>
  );
}

// Racha de semanas completas, en pequeño junto al título.
function StreakPill({ today }: { today: string }) {
  const { calendar } = useWorkout();
  const { current, best } = calendar.streak(today);
  return (
    <span className="streak-pill" title={"Tu mejor racha: " + best + " semanas"}>
      <FlameIcon />{current} {current === 1 ? "semana" : "semanas"}
    </span>
  );
}

// Día de descanso: cuántos días llevas esta semana y qué toca la próxima vez.
function RestCard() {
  const { model, calendar, today, nickname } = useWorkout();
  if (!today) return null;
  const { weekDone, weekTotal } = calendar.streak(today);
  let nextUp: { date: string; day: number } | null = null;
  for (let i = 1; i <= 14 && !nextUp; i++) {
    const s = calendar.sessionsOn(addDays(today, i))[0];
    if (s) nextUp = { date: s.date, day: s.day };
  }
  const when = nextUp && (nextUp.date === addDays(today, 1) ? "Mañana" : "El " + WEEKDAY_NAMES[weekdayOf(nextUp.date)]);
  return (
    <section className="chart rest-card">
      <div className="rest-emoji" aria-hidden="true"><SleepIcon /></div>
      <h2>Hoy descansas{nickname ? ", " + nickname : ""}</h2>
      {weekTotal > 0 && <p>Llevas {weekDone} de {weekTotal} días esta semana{weekDone > 0 && <> <FlameIcon className="flame" /></>}</p>}
      {nextUp && (
        <div className="rest-next"><i style={{ background: "var(--day" + nextUp.day + ")" }} /><div><b>{when}: {model.dayName(nextUp.day)}</b><span>{formatShortDate(nextUp.date)}</span></div></div>
      )}
    </section>
  );
}

type SupersetRole = "first" | "second" | null;

// Papel del ejercicio `i` en una superserie: el primero va enlazado con el siguiente.
export const supersetRole = (list: Exercise[], i: number): SupersetRole =>
  list[i].superset && i < list.length - 1 ? "first" : list[i - 1]?.superset ? "second" : null;

// Peso que se propone para una serie de trabajo vacía: el de la serie anterior de hoy
// o, si no hay, el de esa serie la última vez.
export function suggestedWeight(prevWeights: (string | undefined)[], old?: SetResult) {
  const today = [...prevWeights].reverse().find((w) => !!w?.trim());
  if (today) return today;
  return old?.weight != null ? String(old.weight) : "";
}
