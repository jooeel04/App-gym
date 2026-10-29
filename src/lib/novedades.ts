// Versión de la app (la pone next.config al compilar) y lo nuevo de las últimas versiones.

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || "";

export const NOVEDADES: { date: string; items: string[] }[] = [
  {
    date: "Versión 1.3",
    items: [
      "Cada ejercicio enseña cómo se hace: toca la foto animada para verla en grande.",
      "El fin del descanso llega como notificación: suena y vibra aunque el móvil esté bloqueado.",
      "El pitido del descanso vuelve a sonar después de tener la app en segundo plano.",
    ],
  },
  {
    date: "Versión 1.2",
    items: [
      "Calculadora de discos nueva: peso grande con − y +, barra dibujada entera y discos agrupados.",
      "Recordatorio: botón para enviarte una prueba y comprobar por qué no llega.",
      "Si este móvil pierde el permiso de avisos, la app te lo dice y lo activas con un toque.",
      "Letra pequeña en «Tamaño de letra».",
    ],
  },
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
