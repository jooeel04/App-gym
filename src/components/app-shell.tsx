"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { registerTabAnimator, switchTab, useWorkout } from "@/controllers/workout-controller";
import { useScreenAwake } from "@/lib/screen-awake";
import { syncThemeBar } from "@/lib/theme";
import { DaySummary } from "./day-summary";
import { LoadProblem } from "./load-problem";
import { BrandIcon, ClockIcon, ProgressIcon, RoutineIcon, SettingsIcon, StrongIcon, TrainingIcon, TrophyIcon } from "./icons";
import { ProgressView } from "./progress-view";
import { RestTimerBar } from "./rest-timer";
import { RoutineView } from "./routine-view";
import { SettingsView } from "./settings-view";
import { TrainingView } from "./training-view";
import { SetupWizard } from "./setup-wizard";
import { PEEK_GAP, useTabSwipe } from "./use-tab-swipe";

const NAV = [
  { href: "/entrenar", label: "Hoy", Icon: TrainingIcon, View: TrainingView },
  { href: "/rutina", label: "Rutina", Icon: RoutineIcon, View: RoutineView },
  { href: "/progreso", label: "Progreso", Icon: ProgressIcon, View: ProgressView },
  { href: "/ajustes", label: "Ajustes", Icon: SettingsIcon, View: SettingsView },
];

const tabIndex = (path: string) => Math.max(0, NAV.findIndex((n) => n.href === path));

// Clic normal en un enlace de pestaña (con Ctrl/Cmd o clic central se deja al navegador
// abrirlo en otra pestaña).
const isPlainClick = (e: MouseEvent<HTMLAnchorElement>) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
const SLIDE_MS = 420;
const EASE = "cubic-bezier(.32,.72,0,1)"; // curva tipo muelle de iOS

// Estructura común: cabecera, contenido, navegación inferior y aviso flotante.
// Las vistas se pintan aquí según la URL, así cambiar de pestaña no espera al servidor;
// las páginas de cada ruta solo aportan el título y permiten abrir la URL directamente.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, loadFailed, toast, sync, active } = useWorkout();
  const index = tabIndex(pathname);
  const current = NAV[index];
  // Al deslizar con el dedo asoma la pestaña vecina (`peek`); si se suelta en ella,
  // pasa a ser la actual sin animación de entrada (ya llegó deslizándose).
  const [peek, setPeek] = useState<{ index: number; top: number } | null>(null);
  const [swipedTo, setSwipedTo] = useState<string | null>(null);
  // Dirección del cambio de pestaña con los botones: la nueva entra por la derecha si
  // está a la derecha en la barra inferior, y por la izquierda si está a la izquierda.
  const [slide, setSlide] = useState({ path: pathname, from: "" });
  if (slide.path !== pathname) {
    const swiped = swipedTo === pathname;
    setSlide({ path: pathname, from: swiped ? "" : index > tabIndex(slide.path) ? "right" : "left" });
    if (swipedTo) setSwipedTo(null);
    if (peek) setPeek(null);
  }

  useEffect(() => { document.title = current.label + " · RUTINA"; }, [current]);
  useEffect(syncThemeBar, []);
  // Mientras hay un entreno a medias la pantalla no se apaga.
  useScreenAwake(!!active);

  // Parte visible de la pantalla (sin el teclado del móvil), para colocar las ventanas.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const update = () => {
      root.setProperty("--vv-top", vv.offsetTop + "px");
      root.setProperty("--vv-h", vv.height + "px");
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Cada pestaña recuerda hasta dónde se bajó: al volver a ella se queda en ese punto.
  const scrolls = useRef<Record<string, number>>({});
  const shownPath = useRef(pathname);
  useEffect(() => {
    const save = () => { scrolls.current[shownPath.current] = window.scrollY; };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);
  // La pestaña vecina asoma ya colocada en su posición guardada, así al soltarla no salta.
  const peekAt = useCallback((i: number) => ({ index: i, top: window.scrollY - (scrolls.current[NAV[i].href] ?? 0) }), []);

  // En el móvil se cambia de pestaña deslizando el dedo a izquierda o derecha.
  const mainRef = useRef<HTMLElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const onPeek = useCallback((i: number | null) => setPeek(i === null ? null : peekAt(i)), [peekAt]);
  const onCommit = useCallback((i: number) => {
    setSwipedTo(NAV[i].href);
    switchTab(NAV[i].href);
  }, []);
  // Resaltado de la barra inferior (lente): viaja entre botones y sigue al dedo.
  const lensRef = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(index);
  const setLens = useCallback((offset: number, ms: number) => {
    const lens = lensRef.current;
    if (!lens) return;
    lens.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
    lens.style.transform = `translateX(calc(${indexRef.current + offset} * (100% + var(--nav-gap))))`;
  }, []);
  useTabSwipe(mainRef, pagerRef, index, NAV.length, { onPeek, onCommit, onDrag: setLens });
  useLayoutEffect(() => {
    const first = indexRef.current === index && !lensRef.current?.style.transform;
    indexRef.current = index;
    setLens(0, first ? 0 : 450);
  }, [index, setLens]);

  // Botones de la barra: el mismo movimiento que al deslizar (la pestaña de destino
  // entra pegada a la actual), para que todo se sienta como una sola superficie.
  const animating = useRef(false);
  const goToTab = useCallback((i: number) => {
    if (i === indexRef.current || animating.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !pagerRef.current || !mainRef.current) { switchTab(NAV[i].href); return; }
    animating.current = true;
    const dir = i > indexRef.current ? -1 : 1, width = mainRef.current.clientWidth + PEEK_GAP;
    setPeek(peekAt(i));
    setLens(i - indexRef.current, SLIDE_MS);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const pager = pagerRef.current;
      if (pager) {
        pager.style.transition = `transform ${SLIDE_MS}ms ${EASE}`;
        pager.style.transform = `translate3d(${dir * width}px,0,0)`;
      }
      setTimeout(() => { animating.current = false; onCommit(i); }, SLIDE_MS);
    }));
  }, [onCommit, setLens, peekAt]);
  useEffect(() => {
    registerTabAnimator((path) => goToTab(tabIndex(path)));
    return () => registerTabAnimator(null);
  }, [goToTab]);
  const onNavClick = (i: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    // Tocar la pestaña en la que ya estás sube al principio (como en iOS).
    if (i === index) window.scrollTo({ top: 0, behavior: "smooth" });
    else goToTab(i);
  };

  // Tras cambiar de pestaña, antes de pintar: la pista vuelve a su sitio (la pestaña
  // nueva ya ocupa el lugar de la actual) y se recupera su posición guardada de golpe,
  // sin animación, para que el cambio se vea como un único movimiento.
  useLayoutEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    const pager = pagerRef.current;
    if (pager) {
      pager.style.transition = "";
      pager.style.transform = "";
    }
    window.scrollTo({ top: scrolls.current[pathname] ?? 0, behavior: "instant" });
  }, [pathname]);

  const pages = peek ? [index, peek.index] : [index];

  return (
    <>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="/entrenar" aria-label="Inicio" onClick={onNavClick(0)}>
            <span className="brand-icon"><BrandIcon /></span>
            <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
          </a>
          {(sync.offline || sync.pending > 0) && (
            <span className={"syncpill" + (sync.offline ? " offline" : "")} role="status">
              {sync.offline ? "Sin conexión" : "Guardando…"}
              {sync.offline && sync.pending > 0 && " · " + sync.pending + (sync.pending === 1 ? " cambio por enviar" : " cambios por enviar")}
            </span>
          )}
        </header>
        <main ref={mainRef}>
          {ready
            ? (
              <div className="pager" ref={pagerRef}>
                {pages.map((i) => {
                  const { href, View } = NAV[i];
                  const isPeek = i !== index;
                  return (
                    <div key={href} aria-hidden={isPeek || undefined} inert={isPeek || undefined}
                      className={"page" + (isPeek ? " peek" : slide.from ? " from-" + slide.from : "")}
                      style={isPeek && peek ? { top: peek.top, clipPath: peek.top < 0 ? `inset(${-peek.top}px 0 0 0)` : undefined, left: i > index ? `calc(100% + ${PEEK_GAP}px)` : `calc(-100% - ${PEEK_GAP}px)` } : undefined}>
                      <View />
                    </div>
                  );
                })}
              </div>
            )
            : loadFailed
              ? <LoadProblem onRetry={() => window.location.reload()} />
              : <div className="empty">Cargando tus datos…</div>}
          {children}
        </main>
      </div>
      <nav className="nav" aria-label="Navegación">
        <span className="nav-lens" ref={lensRef} aria-hidden="true" />
        {NAV.map(({ href, label, Icon }, i) => (
          <a key={href} href={href} className={"navbtn" + (href === current.href ? " active" : "")} aria-current={href === current.href ? "page" : undefined} onClick={onNavClick(i)}>
            <Icon />{label}
          </a>
        ))}
      </nav>
      {ready && <RestTimerBar />}
      {ready && <DaySummary />}
      {ready && <SetupWizard />}
      <div className={"toast" + (toast.visible ? " show" : "")} role="status" aria-live="polite">
        {toast.icon === "trophy" && <TrophyIcon />}
        {toast.icon === "clock" && <ClockIcon />}
        {toast.icon === "strong" && <StrongIcon />}
        {toast.text}
      </div>
    </>
  );
}
