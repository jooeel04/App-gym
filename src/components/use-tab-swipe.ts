"use client";

import { useEffect, type RefObject } from "react";

const MIN_DISTANCE = 0.22; // fracción del ancho para cambiar de pestaña
const MIN_VELOCITY = 0.45; // px/ms: un gesto rápido cambia aunque sea corto
const EDGE_RESISTANCE = 0.25; // sin pestaña hacia ese lado, el arrastre se frena

// No se interpreta como cambio de pestaña si el dedo empieza en un campo, una
// ventana emergente o una zona que ya se desplaza en horizontal (chips de días…).
function ignoreTarget(target: EventTarget | null, root: HTMLElement) {
  for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
    if (el.matches("input, textarea, select, [data-no-swipe], .backdrop, .spark, .bm-zoom")) return true;
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

// Deslizar con el dedo a izquierda o derecha sobre `rootRef` cambia de pestaña.
// La página sigue al dedo mientras se arrastra; al soltar, o cambia (y entra la
// nueva con su transición) o vuelve a su sitio.
export function useTabSwipe(rootRef: RefObject<HTMLElement | null>, index: number, count: number, go: (index: number) => void) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let startX = 0, startY = 0, startT = 0, dx = 0;
    let mode: "idle" | "pending" | "drag" | "scroll" = "idle";
    const page = () => root.querySelector<HTMLElement>(".page");

    const reset = (animate: boolean) => {
      const el = page();
      if (!el) return;
      el.style.transition = animate ? "transform .22s ease, opacity .22s ease" : "";
      el.style.transform = "";
      el.style.opacity = "";
      if (animate) setTimeout(() => { el.style.transition = ""; }, 240);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || ignoreTarget(e.target, root)) { mode = "idle"; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = performance.now();
      dx = 0;
      mode = "pending";
    };

    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "scroll") return;
      const x = e.touches[0].clientX - startX, y = e.touches[0].clientY - startY;
      if (mode === "pending") {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        mode = Math.abs(x) > Math.abs(y) * 1.3 ? "drag" : "scroll";
        if (mode === "scroll") return;
      }
      const blocked = (x < 0 && index >= count - 1) || (x > 0 && index <= 0);
      dx = blocked ? x * EDGE_RESISTANCE : x;
      const el = page();
      if (el) {
        el.style.transition = "";
        el.style.transform = `translateX(${dx}px)`;
        el.style.opacity = String(1 - Math.min(Math.abs(dx) / window.innerWidth, 1) * 0.5);
      }
    };

    const onEnd = () => {
      if (mode !== "drag") { mode = "idle"; return; }
      mode = "idle";
      const velocity = Math.abs(dx) / Math.max(1, performance.now() - startT);
      const target = dx < 0 ? index + 1 : index - 1;
      const far = Math.abs(dx) > window.innerWidth * MIN_DISTANCE || velocity > MIN_VELOCITY;
      if (far && target >= 0 && target < count) {
        reset(false);
        go(target);
      } else {
        reset(true);
      }
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: true });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [rootRef, index, count, go]);
}
