"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { switchTab, useWorkout } from "@/controllers/workout-controller";
import { BrandIcon, ProgressIcon, RoutineIcon, TrainingIcon } from "./icons";
import { ProgressView } from "./progress-view";
import { RoutineView } from "./routine-view";
import { TrainingView } from "./training-view";

const NAV = [
  { href: "/entrenar", label: "Entrenar", Icon: TrainingIcon, View: TrainingView },
  { href: "/rutina", label: "Rutina", Icon: RoutineIcon, View: RoutineView },
  { href: "/progreso", label: "Progreso", Icon: ProgressIcon, View: ProgressView },
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
  const { ready, toast } = useWorkout();
  const current = NAV[tabIndex(pathname)];
  // Dirección del cambio de pestaña: la nueva entra por la derecha si está a la derecha
  // en la barra inferior, y por la izquierda si está a la izquierda.
  const [slide, setSlide] = useState({ path: pathname, from: "" });
  if (slide.path !== pathname) {
    setSlide({ path: pathname, from: tabIndex(pathname) > tabIndex(slide.path) ? "right" : "left" });
  }

  useEffect(() => { document.title = current.label + " · RUTINA"; }, [current]);

  return (
    <>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="/entrenar" aria-label="Inicio" onClick={onTabClick("/entrenar")}>
            <span className="brand-icon"><BrandIcon /></span>
            <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
          </a>
        </header>
        <main>
          {ready
            ? <div key={pathname} className={"page" + (slide.from ? " from-" + slide.from : "")}><current.View /></div>
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
      <div className={"toast" + (toast.visible ? " show" : "")} role="status" aria-live="polite">{toast.text}</div>
    </>
  );
}
