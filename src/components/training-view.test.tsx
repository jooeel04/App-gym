import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPermissions } from "@/lib/permissions";
import { useWorkout } from "@/controllers/workout-controller";
import { BASE_ROUTINE } from "@/domain/base-routine";
import { DAY_NAMES, entryKey, exerciseKey } from "@/domain/snapshot";
import { freezeToday, historySnapshot, PRESS, renderWithWorkout, TODAY } from "../../tests/workout-fixture";
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

  it("no se ven de entrada: «Hacer otro día» avisa de cuántos hay", () => {
    renderWithWorkout(<TrainingView />);
    expect(screen.queryByText(/Te quedó pendiente/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hacer otro día/ })).toHaveTextContent(/\d+ pendientes/);
  });

  it("al abrir «Hacer otro día» aparecen los pendientes con «Hacer hoy»", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    const count = Number(/(\d+) pendientes/.exec(screen.getByRole("button", { name: /Hacer otro día/ }).textContent ?? "")?.[1]);
    const buttons = screen.getAllByRole("button", { name: /^Hacer hoy / });
    expect(buttons).toHaveLength(count);
    const name = buttons[0].getAttribute("aria-label")!.replace("Hacer hoy ", "");
    fireEvent.click(buttons[0]);
    expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });
});

describe("Hoy · calculadora de discos", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("tiene su propio botón «Calculadora de discos» (no arriba junto a la racha)", () => {
    renderWithWorkout(<TrainingView />);
    const button = screen.getByRole("button", { name: "Calculadora de discos" });
    expect(button.closest(".pagehead")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Calculadora de discos" })).toBeInTheDocument();
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
    const logButton = screen.getByRole("button", { name: /Serie hecha/ });
    const card = screen.getByText("Activa los avisos");
    expect(logButton.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("«Serie hecha» pide los permisos de los avisos", () => {
    vi.mocked(requestPermissions).mockClear();
    renderWithWorkout(<TrainingView />);
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

  it("el viernes que no se hizo sale en «Hacer otro día» con «Hacer hoy»", () => {
    renderWithWorkout(<TrainingView />);
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
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
const saved = () => JSON.parse(screen.getByTestId("entries").textContent ?? "{}") as Record<string, { weight?: string; reps?: string; date?: string }>;

// Empujes de esta semana ya hecho (marcado entero con el tick, más una serie del militar).
function doneToday() {
  const snap = historySnapshot();
  BASE_ROUTINE.filter((x) => x.day === 3).forEach((x) => { snap.checked = { ...snap.checked, [exerciseKey(4, 3, x.id)]: TODAY }; });
  snap.entries[entryKey(4, 3, MILITAR.id, 1)] = { weight: "30", reps: "8", date: TODAY };
  snap.completed["4|3"] = true;
  return snap;
}

describe("Hoy · repetir un día en la misma semana", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("con el día hecho, «Repetir este día» abre una tanda vacía y la primera sigue guardada (R15)", () => {
    renderWithWorkout(<><TrainingView /><Entries /></>, doneToday());
    fireEvent.click(screen.getByRole("button", { name: "Repetir este día" }));
    expect(screen.getByText(/2\.ª vez esta semana/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(MILITAR.name), expanded: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Serie 1/ })).toHaveTextContent("ahora");
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(saved()[entryKey(4, 3, MILITAR.id, 1)]).toMatchObject({ weight: "30", reps: "8" });
    expect(saved()[entryKey(4, 3, MILITAR.id, 1, 2)]).toMatchObject({ date: TODAY });
  });

  it("en «Hacer otro día», elegir un día ya hecho esta semana abre una tanda nueva (R16)", () => {
    renderWithWorkout(<TrainingView />, doneToday());
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
    fireEvent.click(screen.getByRole("button", { name: DAY_NAMES[3] }));
    expect(screen.getByText(/2\.ª vez esta semana/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Serie 1/ })).toHaveTextContent("ahora");
  });
});

describe("Hoy · apuntar otra fecha", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("lo anotado se guarda con la fecha elegida y en la semana de esa fecha (R18)", () => {
    renderWithWorkout(<><TrainingView /><Entries /></>);
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: DAY_NAMES[2] }));
    expect(screen.getByText(/Apuntando el martes 20 oct/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Serie hecha/ }));
    expect(saved()[entryKey(3, 2, SENTADILLA.id, 1)]).toMatchObject({ date: "2026-10-20" });
    fireEvent.click(screen.getByRole("button", { name: /Volver a hoy/ }));
    expect(screen.queryByText(/Apuntando/)).not.toBeInTheDocument();
  });
});

describe("Hoy · las series de la última vez en la lista", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("la lista no enseña series y al abrir solo sale la última vez de la tarjeta de anotar (R19)", () => {
    const snap = historySnapshot();
    snap.entries[entryKey(3, 1, PRESS.id, 3)] = { weight: "52.5", reps: "10", date: "2026-10-19" };
    renderWithWorkout(<TrainingView />, snap);
    fireEvent.click(screen.getByRole("button", { name: /Hacer otro día/ }));
    fireEvent.click(screen.getByRole("button", { name: DAY_NAMES[1] }));
    const row = screen.getByRole("button", { name: new RegExp(PRESS.name) });
    expect(row).not.toHaveTextContent("×8");
    expect(row).not.toHaveTextContent("última vez");
    // El press es el primero: ya está abierto.
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(/^Última vez:/)).not.toBeInTheDocument();
    expect(screen.getByText(/^La última vez:/)).toHaveTextContent("La última vez: 55 kg × 8");
  });
});
