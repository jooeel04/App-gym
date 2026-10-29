import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeToday, historySnapshot, renderWithWorkout } from "../../tests/workout-fixture";
import { ProgressView } from "./progress-view";

// Con cuenta: los grupos y la clasificación vienen del servidor (simulado).
vi.mock("@/app/actions/social", () => ({
  myGroups: vi.fn(async () => ({ ok: true, data: [{ code: "ABC123", name: "Los del gym", members: 2 }] })),
  groupLeaderboard: vi.fn(async () => ({ ok: true, data: [{ display_name: "Bea", days: 9, is_me: false }, { display_name: "Joel", days: 7, is_me: true }] })),
  groupExerciseRecords: vi.fn(async () => ({ ok: true, data: [
    { exercise: "Press banca", display_name: "Bea", weight: 90, reps: 6, is_me: false },
    { exercise: "Press banca", display_name: "Joel", weight: 85, reps: 5, is_me: true },
  ] })),
  createGroup: vi.fn(), joinGroup: vi.fn(), leaveGroup: vi.fn(),
}));
vi.mock("@/app/actions/profile", () => ({ getNickname: vi.fn(async () => ({ ok: true, data: "Joel" })), saveNickname: vi.fn(async () => ({ ok: true })) }));

describe("Progreso · la clasificación de amigos, a mano", () => {
  beforeEach(freezeToday);
  afterEach(() => vi.useRealTimers());

  it("sin cuenta no hay pestaña de amigos", () => {
    renderWithWorkout(<ProgressView />);
    expect(screen.queryByRole("tab", { name: "Amigos" })).not.toBeInTheDocument();
  });

  it("con cuenta, «Amigos» está arriba en Progreso y enseña días entrenados y quién levanta más", async () => {
    renderWithWorkout(<ProgressView />, historySnapshot(), "cloud");
    fireEvent.click(screen.getByRole("tab", { name: "Amigos" }));
    expect((await screen.findAllByText("Bea")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole("list", { name: /Quién levanta más en Press banca/ })).toHaveTextContent("90 kg × 6"));
    fireEvent.click(screen.getByRole("tab", { name: "Tú" }));
    expect(screen.getByRole("heading", { name: "Calendario" })).toBeInTheDocument();
  });
});
