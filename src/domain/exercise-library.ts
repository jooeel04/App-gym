// Biblioteca de ejercicios: para buscarlos al añadirlos a la rutina y para saber
// qué músculos trabaja cada uno (se dibujan en el mapa del cuerpo).

export type Muscle =
  | "chest" | "frontDelts" | "sideDelts" | "rearDelts" | "biceps" | "triceps" | "forearms"
  | "abs" | "obliques" | "traps" | "lats" | "upperBack" | "lowerBack"
  | "glutes" | "quads" | "hamstrings" | "adductors" | "calves";

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: "Pecho", frontDelts: "Hombro frontal", sideDelts: "Hombro lateral", rearDelts: "Hombro posterior",
  biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazo", abs: "Abdomen", obliques: "Oblicuos",
  traps: "Trapecio", lats: "Dorsal", upperBack: "Espalda alta", lowerBack: "Lumbar",
  glutes: "Glúteo", quads: "Cuádriceps", hamstrings: "Isquiotibiales", adductors: "Aductores", calves: "Gemelos",
};

export interface LibraryExercise {
  name: string;
  days: number[]; // días de rutina en los que encaja (1 Torso … 5 Hombros y brazos)
  primary: Muscle[];
  secondary: Muscle[];
  sets: number;
  target: string;
  note: string;
}

const ex = (name: string, days: number[], primary: Muscle[], secondary: Muscle[] = [], target = "8–12", sets = 3, note = ""): LibraryExercise =>
  ({ name, days, primary, secondary, sets, target, note });

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ---- Pecho ----
  ex("Press banca con barra", [1, 3], ["chest"], ["frontDelts", "triceps"], "6–10", 3, "Escápulas juntas y pies firmes; baja la barra al pecho medio."),
  ex("Press plano con mancuernas", [1, 3], ["chest"], ["frontDelts", "triceps"], "10–12"),
  ex("Press inclinado con barra", [1, 3], ["chest"], ["frontDelts", "triceps"], "6–10"),
  ex("Press inclinado con mancuernas", [1, 3], ["chest"], ["frontDelts", "triceps"], "8–12"),
  ex("Press inclinado en multipower", [1, 3], ["chest"], ["frontDelts", "triceps"], "8–10"),
  ex("Press inclinado en máquina", [1, 3], ["chest"], ["frontDelts", "triceps"], "8–10"),
  ex("Press de pecho en máquina", [1, 3], ["chest"], ["frontDelts", "triceps"], "8–12"),
  ex("Aperturas con mancuernas", [1, 3], ["chest"], ["frontDelts"], "10–15"),
  ex("Contractor de pecho (pec deck)", [1, 3], ["chest"], ["frontDelts"], "12–15"),
  ex("Cruce de poleas desde arriba", [1, 3], ["chest"], ["frontDelts"], "12–15"),
  ex("Cruce de poleas desde abajo", [1, 3], ["chest"], ["frontDelts"], "12–15"),
  ex("Flexiones", [1, 3], ["chest"], ["frontDelts", "triceps", "abs"], "Al fallo", 3),
  ex("Fondos en paralelas", [1, 3], ["chest", "triceps"], ["frontDelts"], "6–12"),
  ex("Fondos excéntricos", [3], ["chest", "triceps"], ["frontDelts"], "Sin rango", 3, "Baja en 3–5 segundos."),
  ex("Fondos con goma o contrapeso", [3], ["chest", "triceps"], ["frontDelts"], "Sin rango"),

  // ---- Espalda ----
  ex("Dominadas", [1, 4], ["lats"], ["biceps", "upperBack", "forearms"], "6–10"),
  ex("Dominadas excéntricas", [1, 4], ["lats"], ["biceps", "upperBack"], "Sin rango", 3, "Sube con ayuda y baja en 3–5 segundos."),
  ex("Dominadas con goma actual", [1, 4], ["lats"], ["biceps", "upperBack"], "6–8"),
  ex("Jalón prono al pecho", [1, 4], ["lats"], ["biceps", "upperBack"], "10–15"),
  ex("Jalón con agarre neutro", [1, 4], ["lats"], ["biceps", "upperBack"], "10–12"),
  ex("Jalón unilateral en polea", [1, 4], ["lats"], ["biceps"], "10–12"),
  ex("Pullover en polea alta", [1, 4], ["lats"], ["triceps"], "12–15"),
  ex("Remo con barra", [1, 4], ["upperBack", "lats"], ["biceps", "rearDelts", "lowerBack"], "8–10"),
  ex("Remo con mancuerna a una mano", [1, 4], ["lats", "upperBack"], ["biceps", "rearDelts"], "8–12"),
  ex("Remo en T con agarre neutro", [1, 4], ["upperBack", "lats"], ["biceps", "rearDelts"], "8–12"),
  ex("Remo en polea baja", [1, 4], ["upperBack", "lats"], ["biceps", "rearDelts"], "10–12"),
  ex("Remo en máquina", [1, 4], ["upperBack", "lats"], ["biceps", "rearDelts"], "10–12"),
  ex("Remo con pecho apoyado", [1, 4], ["upperBack"], ["lats", "rearDelts", "biceps"], "8–12"),
  ex("Peso muerto", [2, 4], ["lowerBack", "glutes", "hamstrings"], ["upperBack", "traps", "forearms", "quads"], "4–6", 3, "Espalda neutra; empuja el suelo con las piernas."),
  ex("Hiperextensiones", [2, 4], ["lowerBack", "glutes"], ["hamstrings"], "12–15"),
  ex("Encogimientos con mancuernas", [4, 5], ["traps"], ["forearms"], "10–15"),

  // ---- Hombros ----
  ex("Press militar con barra", [3, 5], ["frontDelts"], ["sideDelts", "triceps", "traps"], "6–8"),
  ex("Press militar con mancuernas", [3, 5], ["frontDelts"], ["sideDelts", "triceps"], "6–8"),
  ex("Press militar en máquina", [3, 5], ["frontDelts"], ["sideDelts", "triceps"], "10–12"),
  ex("Press Arnold", [3, 5], ["frontDelts", "sideDelts"], ["triceps"], "8–12"),
  ex("Elevaciones laterales con mancuernas", [3, 5], ["sideDelts"], ["traps"], "10–15"),
  ex("Elevaciones laterales en polea unilateral", [3, 5], ["sideDelts"], ["traps"], "10–15"),
  ex("Elevaciones laterales en máquina", [3, 5], ["sideDelts"], [], "12–15"),
  ex("Elevaciones frontales", [3, 5], ["frontDelts"], ["chest"], "10–15"),
  ex("Pájaros con mancuernas", [4, 5], ["rearDelts"], ["upperBack"], "12–15"),
  ex("Contractor invertido (rear delt)", [4, 5], ["rearDelts"], ["upperBack"], "12–15"),
  ex("Face pull en polea", [4, 5], ["rearDelts", "upperBack"], ["traps"], "12–15"),
  ex("Remo al mentón", [5], ["sideDelts", "traps"], ["biceps"], "10–12"),

  // ---- Bíceps ----
  ex("Curl de bíceps con barra", [4, 5], ["biceps"], ["forearms"], "8–12"),
  ex("Curl de bíceps con mancuernas", [4, 5], ["biceps"], ["forearms"], "8–12"),
  ex("Curl de bíceps bayasi unilateral", [4, 5], ["biceps"], ["forearms"], "10–12"),
  ex("Curl inclinado con mancuernas", [4, 5], ["biceps"], ["forearms"], "8–12"),
  ex("Curl Scott en máquina", [4, 5], ["biceps"], ["forearms"], "8–10"),
  ex("Curl martillo con mancuernas", [4, 5], ["biceps", "forearms"], [], "10–12"),
  ex("Curl en polea baja", [4, 5], ["biceps"], ["forearms"], "10–15"),
  ex("Dead curl", [4, 5], ["biceps"], ["forearms"], "6–8"),

  // ---- Tríceps ----
  ex("Press francés con barra Z", [3, 5], ["triceps"], [], "8–12"),
  ex("Press francés con mancuernas", [3, 5], ["triceps"], [], "8–12"),
  ex("Extensión de tríceps en polea alta", [3, 5], ["triceps"], [], "10–15"),
  ex("Extensión de tríceps en polea unilateral", [3, 5], ["triceps"], [], "12–15"),
  ex("Extensión de tríceps sobre la cabeza", [3, 5], ["triceps"], [], "10–12"),
  ex("Press cerrado", [3, 5], ["triceps", "chest"], ["frontDelts"], "6–10"),
  ex("Patada de tríceps", [3, 5], ["triceps"], [], "12–15"),

  // ---- Pierna ----
  ex("Sentadilla con barra", [2], ["quads", "glutes"], ["adductors", "lowerBack", "hamstrings"], "6–10", 3, "Rodillas en la línea de los pies; baja hasta romper el paralelo si puedes."),
  ex("Sentadilla en multipower", [2], ["quads", "glutes"], ["adductors"], "10–12"),
  ex("Sentadilla hack", [2], ["quads"], ["glutes", "adductors"], "8–12"),
  ex("Sentadilla goblet", [2], ["quads", "glutes"], ["adductors", "abs"], "10–12"),
  ex("Sentadilla búlgara contralateral", [2], ["quads", "glutes"], ["adductors", "hamstrings"], "10–12"),
  ex("Prensa de piernas", [2], ["quads", "glutes"], ["adductors"], "10–12"),
  ex("Zancadas", [2], ["quads", "glutes"], ["hamstrings", "adductors"], "10–12"),
  ex("Extensión de cuádriceps", [2], ["quads"], [], "10–15"),
  ex("Peso muerto rumano", [2], ["hamstrings", "glutes"], ["lowerBack", "forearms"], "8–10"),
  ex("Curl femoral tumbado", [2], ["hamstrings"], ["calves"], "10–15"),
  ex("Curl femoral sentado", [2], ["hamstrings"], ["calves"], "10–15"),
  ex("Hip thrust con barra", [2], ["glutes"], ["hamstrings", "quads"], "8–10"),
  ex("Hip thrust en máquina", [2], ["glutes"], ["hamstrings"], "8–10"),
  ex("Patada de glúteo en polea", [2], ["glutes"], ["hamstrings"], "12–15"),
  ex("Abducción de cadera en máquina", [2], ["glutes"], [], "12–20"),
  ex("Aductor en máquina", [2, 4], ["adductors"], [], "10–12"),
  ex("Gemelo en máquina", [2], ["calves"], [], "12–15"),
  ex("Gemelo de pie en multipower", [2], ["calves"], [], "10–15"),
  ex("Gemelo sentado", [2], ["calves"], [], "12–20"),

  // ---- Abdomen ----
  ex("Crunch abdominal en máquina", [1, 2, 3, 4, 5], ["abs"], ["obliques"], "10–15"),
  ex("Crunch en polea alta", [1, 2, 3, 4, 5], ["abs"], ["obliques"], "10–15"),
  ex("Elevación de piernas colgado", [1, 2, 3, 4, 5], ["abs"], ["obliques", "forearms"], "10–15"),
  ex("Plancha", [1, 2, 3, 4, 5], ["abs"], ["obliques", "lowerBack"], "30–60 s"),
  ex("Rueda abdominal", [1, 2, 3, 4, 5], ["abs"], ["obliques", "lats"], "8–12"),
  ex("Pallof press", [1, 2, 3, 4, 5], ["obliques"], ["abs"], "10–12"),
];

export const normalizeName = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const BY_NAME = new Map(EXERCISE_LIBRARY.map((x) => [normalizeName(x.name), x]));

// Para ejercicios escritos a mano: músculos deducidos de palabras clave del nombre.
const KEYWORDS: [RegExp, Muscle[], Muscle[]][] = [
  [/gemelo|pantorrill|calf/, ["calves"], []],
  [/hip thrust|gluteo|puente/, ["glutes"], ["hamstrings"]],
  [/femoral|rumano|isquio/, ["hamstrings"], ["glutes"]],
  [/aductor/, ["adductors"], []],
  [/abduc/, ["glutes"], []],
  [/sentadilla|prensa|zancada|cuadriceps|squat|lunge/, ["quads", "glutes"], ["adductors"]],
  [/peso muerto|deadlift/, ["lowerBack", "glutes", "hamstrings"], ["upperBack", "forearms"]],
  [/lumbar|hiperext/, ["lowerBack"], ["glutes"]],
  [/martillo/, ["biceps", "forearms"], []],
  [/curl|biceps/, ["biceps"], ["forearms"]],
  [/frances|triceps|patada|fondos/, ["triceps"], ["chest"]],
  [/lateral/, ["sideDelts"], ["traps"]],
  [/pajaro|face pull|posterior|rear/, ["rearDelts"], ["upperBack"]],
  [/militar|arnold|hombro|frontal/, ["frontDelts"], ["sideDelts", "triceps"]],
  [/encogimiento|trapecio/, ["traps"], []],
  [/dominada|jalon|pullover|dorsal/, ["lats"], ["biceps", "upperBack"]],
  [/remo/, ["upperBack", "lats"], ["biceps", "rearDelts"]],
  [/press|pecho|apertura|cruce|contractor|flexion/, ["chest"], ["frontDelts", "triceps"]],
  [/crunch|abdom|plancha|rueda/, ["abs"], ["obliques"]],
  [/oblicuo|pallof|giro/, ["obliques"], ["abs"]],
  [/antebrazo|muñeca|muneca/, ["forearms"], []],
];

// Músculos de un ejercicio por su nombre (de la biblioteca o por palabras clave).
export function musclesFor(name: string): { primary: Muscle[]; secondary: Muscle[] } | null {
  const key = normalizeName(name);
  const hit = BY_NAME.get(key);
  if (hit) return { primary: hit.primary, secondary: hit.secondary };
  const rule = KEYWORDS.find(([re]) => re.test(key));
  return rule ? { primary: rule[1], secondary: rule[2] } : null;
}

// Búsqueda en la biblioteca: por nombre o músculo, opcionalmente solo de un día de rutina.
export function searchLibrary(query: string, day: number | null): LibraryExercise[] {
  const q = normalizeName(query);
  return EXERCISE_LIBRARY.filter((x) => {
    if (day !== null && !x.days.includes(day)) return false;
    if (!q) return true;
    const text = normalizeName(x.name + " " + [...x.primary, ...x.secondary].map((m) => MUSCLE_NAMES[m]).join(" "));
    return q.split(" ").every((word) => text.includes(word));
  });
}

// Grupos para dividir listas de ejercicios (p. ej. el ranking de quién levanta más),
// según el músculo principal del ejercicio.
export const EXERCISE_GROUPS = ["Pecho", "Espalda", "Pierna", "Hombro", "Brazos", "Abdomen", "Otros"] as const;
export type ExerciseGroup = (typeof EXERCISE_GROUPS)[number];

const GROUP_OF: Record<Muscle, ExerciseGroup> = {
  chest: "Pecho",
  lats: "Espalda", upperBack: "Espalda", lowerBack: "Espalda", traps: "Espalda",
  quads: "Pierna", hamstrings: "Pierna", glutes: "Pierna", adductors: "Pierna", calves: "Pierna",
  frontDelts: "Hombro", sideDelts: "Hombro", rearDelts: "Hombro",
  biceps: "Brazos", triceps: "Brazos", forearms: "Brazos",
  abs: "Abdomen", obliques: "Abdomen",
};

export function exerciseGroup(name: string): ExerciseGroup {
  const main = musclesFor(name)?.primary[0];
  return main ? GROUP_OF[main] : "Otros";
}
