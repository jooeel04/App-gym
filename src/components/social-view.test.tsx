import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, historySnapshot, renderWithWorkout } from "../../tests/workout-fixture";
import { ProgressView } from "./progress-view";
import { RoutineView } from "./routine-view";
import { SocialView } from "./social-view";

// Con cuenta: los grupos y la clasificación vienen del servidor (simulado).
vi.mock("@/app/actions/social", () => ({
  myGroups: vi.fn(async () => ({ ok: true, data: [{ code: "ABC123", name: "Los del gym", members: 2 }] })),
  groupLeaderboard: vi.fn(async () => ({ ok: true, data: [{ display_name: "Bea", days: 9, is_me: false }, { display_name: "Joel", days: 7, is_me: true }] })),
  groupExerciseRecords: vi.fn(async () => ({ ok: true, data: [
    { exercise: "Press banca", display_name: "Bea", weight: 90, reps: 6, is_me: false },
    { exercise: "Press banca", display_name: "Joel", weight: 85, reps: 5, is_me: true },
  ] })),
  createGroup: vi.fn(), joinGroup: vi.fn(), leaveGroup: vi.fn(), shareRoutine: vi.fn(), getSharedRoutine: vi.fn(),
}));
vi.mock("@/app/actions/profile", () => ({ getNickname: vi.fn(async () => ({ ok: true, data: "Joel" })), saveNickname: vi.fn(async () => ({ ok: true })) }));

describe("Social · todo lo de amigos en un sitio", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("reúne la clasificación del mes, quién levanta más y compartir la rutina", async () => {
    renderWithWorkout(<SocialView />, historySnapshot(), "cloud");
    expect(screen.getByRole("heading", { level: 1, name: "Social" })).toBeInTheDocument();
    expect((await screen.findAllByText("Bea")).length).toBeGreaterThan(0);
    const lifts = await screen.findByRole("list", { name: "Quién levanta más" });
    expect(within(lifts).getByRole("listitem")).toHaveTextContent("90 kg × 6");
    expect(screen.getByRole("button", { name: "Compartir mi rutina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar rutina" })).toBeInTheDocument();
  });

  it("sin cuenta explica que hace falta iniciar sesión", () => {
    renderWithWorkout(<SocialView />);
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
  });

  it("Progreso y Rutina ya no tienen nada social", async () => {
    const { unmount } = renderWithWorkout(<ProgressView />, historySnapshot(), "cloud");
    expect(screen.queryByRole("tab", { name: "Amigos" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Bea")).not.toBeInTheDocument());
    unmount();
    renderWithWorkout(<RoutineView />, historySnapshot(), "cloud");
    expect(screen.queryByRole("button", { name: "Compartir mi rutina" })).not.toBeInTheDocument();
  });

  it("al tocar un ejercicio en quién levanta más se ve el ranking completo", async () => {
    renderWithWorkout(<SocialView />, historySnapshot(), "cloud");
    const lifts = await screen.findByRole("list", { name: "Quién levanta más" });
    fireEvent.click(within(lifts).getByRole("button"));
    expect(screen.getByRole("list", { name: "Ranking de Press banca" })).toBeInTheDocument();
  });
});
