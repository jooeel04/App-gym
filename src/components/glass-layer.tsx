"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { currentTheme, subscribeTheme } from "@/lib/theme";

type LiquidGlass = (typeof import("liquid-glass-react"))["default"];

// Si el sistema pide menos transparencia o más contraste, las barras se quedan sólidas.
const PLAIN = ["(prefers-reduced-transparency: reduce)", "(prefers-contrast: more)"];

// Fondo de cristal líquido (liquid-glass-react) para las barras flotantes: refracta lo
// que pasa por detrás, con brillo en los bordes. Va como capa detrás del contenido,
// así los botones de la barra siguen siendo los de siempre (toques, foco, lector de
// pantalla). La librería lee `navigator` al pintarse: se carga solo en el navegador,
// y mientras tanto (o en Safari/Firefox, que no hacen la refracción) queda el cristal
// esmerilado del CSS.
export function GlassLayer({ radius }: { radius: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [Glass, setGlass] = useState<LiquidGlass | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const light = useSyncExternalStore(subscribeTheme, () => currentTheme() === "light", () => false);

  useEffect(() => {
    if (PLAIN.some((q) => window.matchMedia(q).matches)) return;
    let alive = true;
    import("liquid-glass-react").then((m) => { if (alive) setGlass(() => m.default); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Mide la barra (cambia al girar el móvil): el cristal ocupa exactamente lo mismo.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const on = !!Glass && !!size && size.w > 0 && size.h > 0;
  return (
    <span ref={ref} className={"glass-layer" + (on ? " on" : "")} aria-hidden="true">
      {on && (
        // La librería centra el cristal en su contenedor (top/left 50 %) y no se recoloca
        // si cambia el tamaño: con otro tamaño o tema se vuelve a montar.
        <Glass key={size.w + "x" + size.h + (light ? "-claro" : "")} mode="standard" padding="0" cornerRadius={radius}
          displacementScale={56} blurAmount={0.45} saturation={150} aberrationIntensity={1.5} elasticity={0} overLight={light}
          style={{ position: "absolute", top: "50%", left: "50%" }}>
          <span className="glass-tint" style={{ width: size.w, height: size.h }} />
        </Glass>
      )}
    </span>
  );
}
