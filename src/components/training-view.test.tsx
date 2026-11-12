import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPermissions } from "@/lib/permissions";
import { useWorkout } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { DAY_NAMES, entryKey, exerciseKey } from "@/domain/snapshot";
import { freezeToday, historySnapshot, openNextExercise, PRESS, renderWithWorkout, TODAY } from "../../tests/workout-fixture";
import { QUOTES } from "@/domain/daily-quote";
import { TrainingView } from "./training-view";

// El navegador todavía no ha preguntado por los permisos.
vi.mock("@/lib/permissions", () => ({
  notifyState: () => "default",
  subscribePermission: () => () => {},
  requestPermissions: vi.fn(async () => "default"),
  needsHomeScreen: () => false,
  showNotification: vi.fn(),
}));

describe("Hoy · aviso para activar los permisos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("invita a activar los avisos", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.getByText("Activa los avisos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(requestPermissions).toHaveBeenCalled();
  });

  it("se puede cerrar con «Ahora no» y no vuelve a salir", () => {
    const { unmount } = renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.queryByText("Activa los avisos")).not.toBeInTheDocument();
    unmount();
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByText("Activa los avisos")).not.toBeInTheDocument();
  });

  it("el resto de la pantalla sigue igual al cerrarlo", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.getByRole("heading", { name: "Hoy" })).toBeInTheDocument();
    expect(screen.getByText("Lo que vas a hacer")).toBeInTheDocument();
  });
});

// En los datos de prueba solo se hizo Torso: en las dos últimas semanas quedan días sin hacer.
describe("Hoy · los días pendientes no ocupan la pantalla principal", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no se ven de entrada: «Esta semana» avisa con «N pendientes»", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^\d+ pendientes?$/ })).toBeInTheDocument();
  });

  it("al tocar «N pendientes» aparecen con «Hacer hoy»", () => {
    renderWithWorkout(<TrainingView />);
    const pending = screen.getByRole("button", { name: /^\d+ pendientes?$/ });
    const count = Number(/\d+/.exec(pending.textContent ?? "")?.[0]);
    fireEvent.click(pending);
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /^Hacer hoy / });
    expect(buttons).toHaveLength(count);
    const name = buttons[0].getAttribute("aria-label")!.replace("Hacer hoy ", "");
    fireEvent.click(buttons[0]);
    expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });
});

describe("Hoy · limpio, sin calculadora de discos (R28)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no tiene botón de la calculadora: está en Ajustes", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByRole("button", { name: /calculadora/i })).not.toBeInTheDocument();
  });
});

describe("Hoy · una sola forma de anotar (spec hoy R2)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("no hay lista aparte para «corregir series»", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByRole("button", { name: /Corregir series/ })).not.toBeInTheDocument();
  });
});

// Spec hoy R13: el aviso de permisos no se pone delante del ejercicio que toca.
describe("Hoy · el aviso de permisos va al final", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("la tarjeta sale después de la tarjeta de anotar", () => {
    renderWithWorkout(<TrainingView />);
    openNextExercise();
    const logButton = screen.getByRole("button", { name: /Serie hecha/ });
    const card = screen.getByText("Activa los avisos");
    expect(logButton.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("«Serie hecha» pide los permisos de los avisos", () => {
    vi.mocked(requestPermissions).mockClear();
    renderWithWorkout(<TrainingView />);
    openNextExercise();
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(requestPermissions).toHaveBeenCalled();
  });
});

// Spec hoy R14: en un día de descanso también se ve el último día que quedó sin hacer.
describe("Hoy · pendientes en un día de descanso", () => {
  beforeEach(() => {
    freezeToday();
    vi.setSystemTime(new Date("2026-10-31T10:00:00")); // sábado; el viernes (Día 5) no se hizo
  });
  afterEach(() => vi.useRealTimers());

  it("el viernes que no se hizo sale en los pendientes con «Hacer hoy»", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: /^\d+ pendientes?$/ }));
    // El de ayer, no solo el de la semana pasada.
    expect(screen.getByText("Era el viernes, 30 de octubre")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Hacer hoy " + DAY_NAMES[5] }).length).toBeGreaterThan(0);
  });
});

// Spec hoy R15–R19: repetir un día en la misma semana, apuntar otra fecha y ver las series
// de la última vez. Hoy (miércoles, semana 4) toca Empujes.
const MILITAR = BASE_ROUTINE.find((x) => x.day === 3)!;
const SENTADILLA = BASE_ROUTINE.find((x) => x.day === 2)!;

// Lo guardado en el modelo, para comprobar dónde y con qué fecha quedó cada serie.
function Entries() {
  const { model } = useWorkout();
  return <output data-testid="entries">{JSON.stringify(model.snapshot.entries)}</output>;
}
// Toca un día de «Esta semana» por su fecha («martes 27 oct») y abre su panel.
const stripDay = (date: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp("^" + date + ":") }));
const saved = () => JSON.parse(screen.getByTestId("entries").textContent ?? "{}") as Record<string, { weight?: string; reps?: string; date?: string }>;

// Empujes de esta semana ya hecho (marcado entero con el tick, más una serie del militar).
function doneToday() {
  const snap = historySnapshot();
  BASE_ROUTINE.filter((x) => x.day === 3).forEach((x) => { snap.checked = { ...snap.checked, [exerciseKey(4, 3, x.id)]: TODAY }; });
  snap.entries[entryKey(4, 3, MILITAR.id, 1)] = { weight: "30", reps: "8", date: TODAY };
  snap.completed["4|3"] = true;
  return snap;
}

describe("Hoy · «Hoy» y «Repetir» en la misma fila, sin «Otro día» (R27)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  const row = () => document.querySelector(".today-actions") as HTMLElement;

  it("no hay botón «Otro día»", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByRole("button", { name: /otro día/i })).not.toBeInTheDocument();
  });

  it("con el día hecho, «Repetir» está en la fila, justo debajo de la lista", () => {
    renderWithWorkout(<TrainingView />, doneToday());
    expect(within(row()).getByRole("button", { name: "Repetir este día" })).toHaveTextContent(/^Repetir$/);
    const list = screen.getByRole("button", { name: new RegExp(MILITAR.name) }).closest("section")!;
    expect(row().previousElementSibling).toBe(list);
  });

  it("tras elegir otro día en la tira, «Hoy» está en la fila y vuelve a lo de hoy", () => {
    renderWithWorkout(<TrainingView />);
    stripDay("martes 27 oct");
    fireEvent.click(screen.getByRole("button", { name: "Hacer " + DAY_NAMES[2] + " hoy" }));
    const back = within(row()).getByRole("button", { name: "Volver a hoy" });
    expect(back).toHaveTextContent(/^Hoy$/);
    fireEvent.click(back);
    expect(screen.queryByRole("button", { name: "Volver a hoy" })).not.toBeInTheDocument();
  });
});

describe("Hoy · repetir un día en la misma semana", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("con el día hecho, «Repetir este día» abre una tanda vacía y la primera sigue guardada (R15)", () => {
    renderWithWorkout(<><TrainingView /><Entries /></>, doneToday());
    fireEvent.click(screen.getByRole("button", { name: "Repetir este día" }));
    expect(screen.getByText(/2\.ª vez esta semana/)).toBeInTheDocument();
    openNextExercise();
    expect(screen.getByRole("button", { name: new RegExp(MILITAR.name), expanded: true })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Serie 1:/)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(saved()[entryKey(4, 3, MILITAR.id, 1)]).toMatchObject({ weight: "30", reps: "8" });
    expect(saved()[entryKey(4, 3, MILITAR.id, 1, 2)]).toMatchObject({ date: TODAY });
  });

  it("en «Esta semana», elegir un día ya hecho esta semana abre una tanda nueva (R16)", () => {
    renderWithWorkout(<TrainingView />, doneToday());
    stripDay("miércoles 28 oct");
    fireEvent.click(within(screen.getByRole("group", { name: "Otra rutina" })).getByRole("button", { name: DAY_NAMES[3] }));
    expect(screen.getByText(/2\.ª vez esta semana/)).toBeInTheDocument();
    openNextExercise();
    expect(screen.getByLabelText(/^Serie 1:/)).toHaveAttribute("aria-label", expect.stringContaining("ahora"));
  });
});

describe("Hoy · apuntar otra fecha", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("lo anotado se guarda con la fecha elegida y en la semana de esa fecha (R18)", () => {
    renderWithWorkout(<><TrainingView /><Entries /></>);
    stripDay("miércoles 28 oct");
    fireEvent.click(screen.getByRole("button", { name: "Otra fecha…" }));
    fireEvent.change(screen.getByLabelText("Otra fecha"), { target: { value: "2026-10-20" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Otra rutina" })).getByRole("button", { name: DAY_NAMES[2] }));
    expect(screen.getByText(/Apuntando el martes 20 oct/)).toBeInTheDocument();
    openNextExercise();
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(saved()[entryKey(3, 2, SENTADILLA.id, 1)]).toMatchObject({ date: "2026-10-20" });
    fireEvent.click(screen.getByRole("button", { name: /Volver a hoy/ }));
    expect(screen.queryByText(/Apuntando/)).not.toBeInTheDocument();
  });
});

describe("Hoy · las series de la última vez en la lista", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("la lista no enseña series; al abrir, lo de la última vez está en la columna «Anterior» (R19)", () => {
    const snap = historySnapshot();
    snap.entries[entryKey(3, 1, PRESS.id, 3)] = { weight: "52.5", reps: "10", date: "2026-10-19" };
    renderWithWorkout(<TrainingView />, snap);
    stripDay("miércoles 28 oct");
    fireEvent.click(within(screen.getByRole("group", { name: "Otra rutina" })).getByRole("button", { name: DAY_NAMES[1] }));
    const row = screen.getByRole("button", { name: new RegExp(PRESS.name) });
    expect(row).not.toHaveTextContent("×8");
    expect(row).not.toHaveTextContent("última vez");
    // Al tocarlo se abre.
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(/^Última vez:/)).not.toBeInTheDocument();
    const table = screen.getByRole("group", { name: "Series de " + PRESS.name });
    expect(Array.from(table.querySelectorAll(".series-prev")).map((c) => c.textContent)).toEqual(["55×8", "55×8", "52,5×10"]);
  });
});

// Spec hoy R33–R35: la frase, la semana y «Hoy puedes subir».
describe("Hoy · frase, tu semana y «Hoy puedes subir»", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("enseña una de las frases y no cambia al volver a pintar Hoy (R35)", () => {
    const { unmount } = renderWithWorkout(<TrainingView />);
    const quote = document.querySelector(".daily-quote")!.textContent!;
    expect(QUOTES).toContain(quote);
    unmount();
    renderWithWorkout(<TrainingView />);
    expect(document.querySelector(".daily-quote")).toHaveTextContent(quote);
  });

  it("«Esta semana» va encima de la tarjeta del día y enseña los 7 días, hoy marcado, y cuántos entrenos llevas (R33)", () => {
    renderWithWorkout(<TrainingView />);
    const week = screen.getByRole("list", { name: "Esta semana" });
    expect(week.closest("section")!.nextElementSibling).toHaveClass("hero");
    const days = within(week).getAllByRole("listitem");
    expect(days).toHaveLength(7);
    expect(days[2]).toHaveAttribute("aria-current", "date");
    expect(within(days[2]).getByRole("button")).toHaveAccessibleName(/miércoles.*toca/i);
    expect(screen.getByText(/^\d+ de \d+$/)).toBeInTheDocument();
  });

  it("«Hoy puedes subir peso» lista los de consejo de subir y al tocar uno se abre (R34)", () => {
    const snap = historySnapshot();
    // La semana pasada el press militar llegó al máximo (8) en sus 3 series con 20 kg.
    [1, 2, 3].forEach((s) => { snap.entries[entryKey(3, 3, MILITAR.id, s)] = { weight: "20", reps: "8", date: "2026-10-21" }; });
    renderWithWorkout(<TrainingView />, snap);
    const card = screen.getByRole("region", { name: "Hoy puedes subir peso" });
    const row = within(card).getByRole("button", { name: new RegExp(MILITAR.name) });
    expect(row).toHaveTextContent("20 → 22 kg");
    fireEvent.click(row);
    expect(screen.getByRole("button", { name: new RegExp(MILITAR.name), expanded: true })).toBeInTheDocument();
  });

  it("sin nada que subir, «Hoy puedes subir peso» no sale (R34)", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByRole("region", { name: "Hoy puedes subir peso" })).not.toBeInTheDocument();
  });
});

// Spec interfaz «Títulos y etiquetas»: en Hoy el título no se ve, pero el lector de pantalla
// lo sigue leyendo.
describe("Hoy · título solo para el lector de pantalla", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("el título «Hoy» existe pero va oculto a la vista", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.getByRole("heading", { level: 1, name: "Hoy" })).toHaveClass("sr-only");
  });
});

// Spec hoy R37: cada día de «Esta semana» abre su panel (lo que antes era «Otro día»). Hoy es
// miércoles 28 oct (Empujes); el lunes 26 tocaba Torso y el martes 27 Pierna, sin hacer.
describe("Hoy · el panel de cada día de «Esta semana» (R37)", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("un día pasado que falta ofrece recuperarlo hoy", () => {
    renderWithWorkout(<TrainingView />);
    stripDay("lunes 26 oct");
    fireEvent.click(screen.getByRole("button", { name: "Hacer " + DAY_NAMES[1] + " hoy" }));
    expect(screen.getByRole("heading", { level: 2, name: DAY_NAMES[1] })).toBeInTheDocument();
  });

  it("un día que viene ofrece adelantarlo hoy", () => {
    renderWithWorkout(<TrainingView />);
    stripDay("jueves 29 oct");
    fireEvent.click(screen.getByRole("button", { name: "Hacer " + DAY_NAMES[4] + " hoy" }));
    expect(screen.getByRole("heading", { level: 2, name: DAY_NAMES[4] })).toBeInTheDocument();
  });

  it("un día entrenado ofrece editarlo", () => {
    renderWithWorkout(<TrainingView />, doneToday());
    stripDay("miércoles 28 oct");
    expect(screen.getByRole("button", { name: "Editar " + DAY_NAMES[3] })).toBeInTheDocument();
  });

  it("en un día pasado, «Otra rutina» la apunta con esa fecha", () => {
    renderWithWorkout(<TrainingView />);
    stripDay("martes 27 oct");
    fireEvent.click(within(screen.getByRole("group", { name: "Otra rutina" })).getByRole("button", { name: DAY_NAMES[5] }));
    expect(screen.getByText(/Apuntando el martes 27 oct/)).toBeInTheDocument();
  });

  it("al tocar el mismo día otra vez, el panel se cierra", () => {
    renderWithWorkout(<TrainingView />);
    stripDay("martes 27 oct");
    expect(screen.getByRole("group", { name: "Otra rutina" })).toBeInTheDocument();
    stripDay("martes 27 oct");
    expect(screen.queryByRole("group", { name: "Otra rutina" })).not.toBeInTheDocument();
  });
});
