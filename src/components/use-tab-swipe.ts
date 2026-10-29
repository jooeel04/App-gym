"use client";

import { useEffect, type RefObject } from "react";

const MIN_DISTANCE = 0.22; // fracción del ancho para cambiar de pestaña
const MIN_VELOCITY = 0.45; // px/ms: un gesto rápido cambia aunque sea corto
const EDGE_RESISTANCE = 0.25; // sin pestaña hacia ese lado, el arrastre se frena
export const PEEK_GAP = 16; // separación entre la pestaña actual y la que asoma

// Llama a `done` cuando el deslizamiento de `el` termina de verdad (fin de su transición
// de transform). No basta con esperar `ms`: si el móvil va cargado la animación empieza
// tarde y, al darla por acabada antes, la pestaña saltaba los últimos píxeles. Por si el
// navegador no avisa (pestaña en segundo plano), hay un tope de seguridad.
export function afterSlide(el: HTMLElement, ms: number, done: () => void) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
    done();
  };
  const onEnd = (e: TransitionEvent) => { if (e.target === el && e.propertyName === "transform") finish(); };
  el.addEventListener("transitionend", onEnd);
  const timer = setTimeout(finish, ms + 400);
}

// No se interpreta como cambio de pestaña si el dedo empieza en un campo, una
// ventana emergente o una zona que ya se desplaza en horizontal (chips de días…).
function ignoreTarget(target: EventTarget | null, root: HTMLElement) {
  for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
    if (el.matches("input, textarea, select, [data-no-swipe], .backdrop, .spark, .bm-zoom")) return true;
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

interface SwipeHandlers {
  // Pestaña vecina que debe asomar por el lado (null: ninguna).
  onPeek: (index: number | null) => void;
  // El gesto termina en otra pestaña (la animación de salida ya ha acabado).
  onCommit: (index: number) => void;
  // Progreso del arrastre hacia la vecina (0 = en su sitio, ±1 = vecina), para que
  // el resaltado de la barra inferior siga al dedo; `ms` es la duración de la animación.
  onDrag?: (offset: number, ms: number) => void;
}

// Deslizar con el dedo sobre `rootRef` mueve `pagerRef` (la pestaña actual junto a
// la vecina que asoma). Al soltar, o termina de deslizar hasta la vecina desde
// donde estaba el dedo, o vuelve a su sitio; nunca salta.
export function useTabSwipe(rootRef: RefObject<HTMLElement | null>, pagerRef: RefObject<HTMLElement | null>,
  index: number, count: number, { onPeek, onCommit, onDrag }: SwipeHandlers) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let startX = 0, startY = 0, dx = 0, lastX = 0, lastT = 0, velocity = 0;
    let side = 0; // -1: asoma la siguiente (a la derecha); 1: la anterior
    let mode: "idle" | "pending" | "drag" | "scroll" | "settling" = "idle";

    const move = (x: number, ms = 0, done?: () => void) => {
      const pager = pagerRef.current;
      if (!pager) return;
      pager.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.25,1)` : "";
      pager.style.transform = x ? `translate3d(${x}px,0,0)` : "";
      if (done) afterSlide(pager, ms, done);
    };

    const onStart = (e: TouchEvent) => {
      if (mode === "settling" || e.touches.length !== 1 || ignoreTarget(e.target, root)) { if (mode !== "settling") mode = "idle"; return; }
      startX = lastX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastT = performance.now();
      dx = velocity = side = 0;
      mode = "pending";
    };

    const onMove = (e: TouchEvent) => {
      if (mode !== "pending" && mode !== "drag") return;
      const cx = e.touches[0].clientX, x = cx - startX, y = e.touches[0].clientY - startY;
      if (mode === "pending") {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        mode = Math.abs(x) > Math.abs(y) * 1.3 ? "drag" : "scroll";
        if (mode === "scroll") return;
      }
      const now = performance.now();
      velocity = (cx - lastX) / Math.max(1, now - lastT);
      lastX = cx;
      lastT = now;
      const dir = x < 0 ? -1 : 1, neighbor = index - dir;
      const exists = neighbor >= 0 && neighbor < count;
      if (dir !== side) {
        side = dir;
        onPeek(exists ? neighbor : null);
      }
      dx = exists ? x : x * EDGE_RESISTANCE;
      move(dx);
      onDrag?.(-dx / (root.clientWidth + PEEK_GAP), 0);
    };

    const onEnd = () => {
      if (mode !== "drag") { if (mode !== "settling") mode = "idle"; return; }
      const width = root.clientWidth + PEEK_GAP;
      const target = index - side;
      const fast = Math.abs(velocity) > MIN_VELOCITY && Math.sign(velocity) === side;
      const far = Math.abs(dx) > root.clientWidth * MIN_DISTANCE;
      mode = "settling";
      if ((far || fast) && target >= 0 && target < count) {
        // Termina el deslizamiento a la velocidad del dedo (entre 140 y 320 ms).
        const remaining = width - Math.abs(dx);
        const ms = Math.round(Math.min(320, Math.max(140, remaining / Math.max(Math.abs(velocity), 1.2))));
        onDrag?.(-side, ms);
        move(side * width, ms, () => { mode = "idle"; onCommit(target); });
      } else {
        onDrag?.(0, 220);
        move(0, 220, () => { mode = "idle"; onPeek(null); });
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
  }, [rootRef, pagerRef, index, count, onPeek, onCommit, onDrag]);
}
