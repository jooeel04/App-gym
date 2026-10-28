"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { currentTheme, subscribeTheme } from "@/lib/theme";

type LiquidGlass = (typeof import("liquid-glass-react"))["default"];

// Si el sistema pide menos transparencia o más contraste, no hay cristal.
const PLAIN = ["(prefers-reduced-transparency: reduce)", "(prefers-contrast: more)"];
export const glassAllowed = () => !PLAIN.some((q) => window.matchMedia(q).matches);

// Elemento que lleva el cristal: el padre, o el de su hueco si lo puso GlassSurfaces.
const hostOf = (el: HTMLElement) => {
  const parent = el.parentElement;
  return parent?.classList.contains("glass-slot") ? parent.parentElement : parent;
};

// Radio de las esquinas del elemento, en px (los porcentajes, sobre el lado menor).
function radiusOf(host: Element | null, w: number, h: number) {
  if (!host) return 0;
  const cs = getComputedStyle(host);
  // El atajo (su primer valor es la esquina superior izquierda) vale en todos los navegadores.
  const raw = cs.borderRadius || cs.borderTopLeftRadius || "0";
  const n = parseFloat(raw) || 0;
  return Math.min(raw.trim().endsWith("%") ? (Math.min(w, h) * n) / 100 : n, Math.min(w, h) / 2);
}

// Fondo de cristal líquido (liquid-glass-react): refracta y desenfoca lo que pasa por
// detrás, con brillo en los bordes. Va como capa detrás del contenido del elemento
// (los botones siguen siendo los de siempre: toques, foco, lector de pantalla) y marca
// el elemento con data-glass="on" para que su CSS deje ver el cristal.
// La librería lee `navigator` al pintarse: se carga solo en el navegador, y solo
// mientras el elemento está cerca de la pantalla (cada cristal cuesta batería).
export function GlassLayer({ radius }: { radius?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [Glass, setGlass] = useState<LiquidGlass | null>(null);
  const [size, setSize] = useState<{ w: number; h: number; r: number } | null>(null);
  // Sin IntersectionObserver (navegadores antiguos), siempre se considera en pantalla.
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const light = useSyncExternalStore(subscribeTheme, () => currentTheme() === "light", () => false);

  useEffect(() => {
    if (!glassAllowed()) return;
    let alive = true;
    import("liquid-glass-react").then((m) => { if (alive) setGlass(() => m.default); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Mide el elemento (cambia al girar el móvil o al desplegarse): el cristal ocupa lo mismo.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      const rad = Math.round(radius ?? radiusOf(hostOf(el), w, h));
      setSize((s) => (s && s.w === w && s.h === h && s.r === rad ? s : { w, h, r: rad }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [radius]);

  // Solo cerca de la pantalla.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const on = !!Glass && near && !!size && size.w > 0 && size.h > 0;

  useEffect(() => {
    const host = ref.current && hostOf(ref.current);
    if (!host) return;
    if (on) host.setAttribute("data-glass", "on");
    else host.removeAttribute("data-glass");
    return () => host.removeAttribute("data-glass");
  }, [on]);

  return (
    // --glass-r: radio de las esquinas, para recortar la refracción (ver globals.css).
    <span ref={ref} className={"glass-layer" + (on ? " on" : "")} aria-hidden="true"
      style={size ? ({ "--glass-r": size.r + "px" } as React.CSSProperties) : undefined}>
      {on && (
        // La librería centra el cristal en su contenedor (top/left 50 %) y no se recoloca
        // si cambia el tamaño: con otro tamaño o tema se vuelve a montar.
        <Glass key={size.w + "x" + size.h + "r" + size.r + (light ? "-claro" : "")} mode="standard" padding="0" cornerRadius={size.r}
          displacementScale={56} blurAmount={0.45} saturation={150} aberrationIntensity={1.5} elasticity={0} overLight={light}
          style={{ position: "absolute", top: "50%", left: "50%" }}>
          <span className="glass-tint" style={{ width: size.w, height: size.h }} />
        </Glass>
      )}
    </span>
  );
}
