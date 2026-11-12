// La frase de Hoy (spec hoy R35): propias, en segunda persona, sin culpa y de 38
// letras como mucho (caben en una línea del móvil).
// Para añadir una, una línea más.
export const QUOTES = [
  "Una serie más que ayer ya es progreso.",
  "Hecho es mejor que perfecto.",
  "Lo difícil era venir. Ya estás aquí.",
  "Hoy entrenas por tu yo del futuro.",
  "Constancia antes que intensidad.",
  "Cada repetición cuenta.",
  "Mejor un entreno corto que ninguno.",
  "Tu único rival es tu última vez.",
  "Respira, aprieta y una más.",
  "La fuerza se hace en días como hoy.",
  "No esperes ganas: empieza y llegarán.",
  "Pequeños kilos, grandes cambios.",
  "Hoy toca darlo todo.",
  "Haz la primera serie. El resto, solo.",
  "La técnica primero; el peso, después.",
  "Si cuesta, es que está funcionando.",
  "Hoy sumas un día más a tu racha.",
  "Tu cuerpo recuerda cada entreno.",
  "Paso a paso, kilo a kilo.",
  "Lo que hoy pesa, mañana calienta.",
  "Entrena con cabeza, vuelve con ganas.",
  "Disciplina es ir aunque no apetezca.",
  "Hoy solo compites contigo.",
  "Cada semana completa es una victoria.",
  "Lento también es progreso.",
  "Céntrate en esta serie. Solo en esta.",
  "Tu mejor versión se entrena.",
  "Menos excusas, más repeticiones.",
  "Hoy toca demostrarte que puedes.",
  "El último ejercicio también cuenta.",
  "Bebe agua, calienta bien y a por ello.",
];

// Una frase al azar (`random`: de 0 a 1, como Math.random) que no sea `previous`, la que salió
// la vez anterior: así no se repite al volver a abrir la app.
export function randomQuote(random: () => number, previous?: string | null): string {
  const options = previous && QUOTES.includes(previous) ? QUOTES.filter((q) => q !== previous) : QUOTES;
  return options[Math.min(Math.floor(random() * options.length), options.length - 1)];
}
