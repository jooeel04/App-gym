"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { switchTab, useWorkout } from "@/controllers/workout-controller";
import { syncThemeBar } from "@/lib/theme";
import { DaySummary } from "./day-summary";
import { LoadProblem } from "./load-problem";
import { BrandIcon, ProgressIcon, RoutineIcon, SettingsIcon, TrainingIcon } from "./icons";
import { ProgressView } from "./progress-view";
import { RestTimerBar } from "./rest-timer";
import { RoutineView } from "./routine-view";
import { SettingsView } from "./settings-view";
import { TrainingView } from "./training-view";
import { PEEK_GAP, useTabSwipe } from "./use-tab-swipe";

const NAV = [
  { href: "/entrenar", label: "Entrenar", Icon: TrainingIcon, View: TrainingView },
  { href: "/rutina", label: "Rutina", Icon: RoutineIcon, View: RoutineView },
  { href: "/progreso", label: "Progreso", Icon: ProgressIcon, View: ProgressView },
  { href: "/ajustes", label: "Ajustes", Icon: SettingsIcon, View: SettingsView },
];

const tabIndex = (path: string) => Math.max(0, NAV.findIndex((n) => n.href === path));

// Enlace de pestaña: cambia de vista al instante en el navegador. Con Ctrl/Cmd o
// clic central se deja al navegador abrirlo en otra pestaña.
function onTabClick(href: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    switchTab(href);
  };
}

// Estructura común: cabecera, contenido, navegación inferior y aviso flotante.
// Las vistas se pintan aquí según la URL, así cambiar de pestaña no espera al servidor;
// las páginas de cada ruta solo aportan el título y permiten abrir la URL directamente.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, loadFailed, toast, sync } = useWorkout();
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

  // En el móvil se cambia de pestaña deslizando el dedo a izquierda o derecha.
  const mainRef = useRef<HTMLElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const swipeCommitted = useRef(false);
  const onPeek = useCallback((i: number | null) => setPeek(i === null ? null : { index: i, top: window.scrollY }), []);
  const onCommit = useCallback((i: number) => {
    swipeCommitted.current = true;
    setSwipedTo(NAV[i].href);
    switchTab(NAV[i].href, false);
  }, []);
  useTabSwipe(mainRef, pagerRef, index, NAV.length, { onPeek, onCommit });

  // Tras un cambio por deslizamiento, antes de pintar: la pista vuelve a su sitio
  // (la pestaña nueva ya ocupa el lugar de la actual) y se sube al principio.
  useLayoutEffect(() => {
    if (!swipeCommitted.current) return;
    swipeCommitted.current = false;
    const pager = pagerRef.current;
    if (pager) {
      pager.style.transition = "";
      pager.style.transform = "";
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  const pages = peek ? [index, peek.index] : [index];

  return (
    <>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="/entrenar" aria-label="Inicio" onClick={onTabClick("/entrenar")}>
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
                      style={isPeek && peek ? { top: peek.top, left: i > index ? `calc(100% + ${PEEK_GAP}px)` : `calc(-100% - ${PEEK_GAP}px)` } : undefined}>
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
        {NAV.map(({ href, label, Icon }) => (
          <a key={href} href={href} className={"navbtn" + (href === current.href ? " active" : "")} aria-current={href === current.href ? "page" : undefined} onClick={onTabClick(href)}>
            <Icon />{label}
          </a>
        ))}
      </nav>
      {ready && <RestTimerBar />}
      {ready && <DaySummary />}
      <div className={"toast" + (toast.visible ? " show" : "")} role="status" aria-live="polite">{toast.text}</div>
    </>
  );
}
