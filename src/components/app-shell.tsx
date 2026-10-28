"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { BrandIcon, ProgressIcon, RoutineIcon, TrainingIcon } from "./icons";

const NAV = [
  { href: "/entrenar", label: "Entrenar", Icon: TrainingIcon },
  { href: "/rutina", label: "Rutina", Icon: RoutineIcon },
  { href: "/progreso", label: "Progreso", Icon: ProgressIcon },
];

// Estructura común: cabecera, contenido, navegación inferior y aviso flotante.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, toast } = useWorkout();

  return (
    <>
      <div className="app">
        <header className="topbar">
          <Link className="brand" href="/entrenar" aria-label="Inicio">
            <span className="brand-icon"><BrandIcon /></span>
            <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
          </Link>
        </header>
        <main>{ready ? children : <div className="empty">Cargando tus datos…</div>}</main>
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
