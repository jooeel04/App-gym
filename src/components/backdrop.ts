import type { PointerEvent, MouseEvent } from "react";

// El toque empezó en el fondo oscuro de la ventana (no dentro de ella).
let pressedBackdrop = false;

// Cierra la ventana al tocar el fondo oscuro, solo si el toque empieza y termina en él.
// En el iPhone, al tocar un recuadro de texto la ventana sube para dejar sitio al
// teclado y el clic llega después, ya sobre el fondo: sin esto, la ventana se cerraba.
export function closeOnBackdrop(onClose: () => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => { pressedBackdrop = e.target === e.currentTarget; },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (pressedBackdrop && e.target === e.currentTarget) onClose();
      pressedBackdrop = false;
    },
  };
}
