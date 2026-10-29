// Versión de la app (la pone next.config al compilar) y lo nuevo de las últimas versiones.

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || "";

export const NOVEDADES: { date: string; items: string[] }[] = [
  {
    date: "Versión 1.1 (finales de octubre de 2026)",
    items: [
      "La app se llama FitGym y estrena logo.",
      "Tema automático: claro u oscuro según tu móvil.",
      "Ajustes nuevos: tamaño de letra, barra y discos de tu gym, privacidad en Social, cambiar contraseña o correo y borrar la cuenta.",
      "«Quién levanta más» dividido por grupo muscular.",
      "Arreglado: a veces el inicio de sesión decía que la cuenta ya existía.",
    ],
  },
  {
    date: "Versión 1.0 (octubre de 2026)",
    items: [
      "Pestaña Social con la clasificación del mes y quién levanta más.",
      "La app te llama por tu nombre o apodo.",
      "Calculadora de discos más a mano y recordatorios más fiables.",
    ],
  },
];
