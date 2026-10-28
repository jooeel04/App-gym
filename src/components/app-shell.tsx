"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { BrandIcon, ProgressIcon, RoutineIcon, TrainingIcon } from "./icons";

const NAV = [
  { href: "/entrenar", label: "Entrenar", Icon: TrainingIcon },
  { href: "/rutina", label: "Rutina", Icon: RoutineIcon },
  { href: "/progreso", label: "Progreso", Icon: ProgressIcon },
];

const tabIndex = (path: string) => Math.max(0, NAV.findIndex((n) => n.href === path));

// Estructura común: cabecera, contenido, navegación inferior y aviso flotante.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, toast } = useWorkout();
  // Dirección del cambio de pestaña: la nueva entra por la derecha si está a la derecha
  // en la barra inferior, y por la izquierda si está a la izquierda.
  const [slide, setSlide] = useState({ path: pathname, from: "" });
  if (slide.path !== pathname) {
    setSlide({ path: pathname, from: tabIndex(pathname) > tabIndex(slide.path) ? "right" : "left" });
  }

  return (
    <>
      <div className="app">
        <header className="topbar">
          <Link className="brand" href="/entrenar" aria-label="Inicio">
            <span className="brand-icon"><BrandIcon /></span>
            <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
          </Link>
        </header>
        <main>
          {ready
            ? <div key={pathname} className={"page" + (slide.from ? " from-" + slide.from : "")}>{children}</div>
            : <div className="empty">Cargando tus datos…</div>}
        </main>
      </div>
      <nav className="nav" aria-label="Navegación">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={"navbtn" + (pathname === href ? " active" : "")}>
            <Icon />{label}
          </Link>
        ))}
      </nav>
      <div className={"toast" + (toast.visible ? " show" : "")} role="status" aria-live="polite">{toast.text}</div>
    </>
  );
}
