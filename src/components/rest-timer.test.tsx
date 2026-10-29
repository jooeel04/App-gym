import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkout } from "@/controllers/workout-controller";
import { renderWithWorkout } from "../../tests/workout-fixture";

const scheduleRestAlert = vi.fn(async (...args: unknown[]) => ({ ok: args.length > 0 }));
const cancelRestAlert = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/rest-alerts", () => ({
  scheduleRestAlert: (...a: unknown[]) => scheduleRestAlert(...a),
  cancelRestAlert: () => cancelRestAlert(),
}));
vi.mock("@/app/actions/profile", () => ({ getNickname: vi.fn(async () => ({ ok: true, data: "Joel" })), saveNickname: vi.fn(async () => ({ ok: true })) }));
const DEVICE = { endpoint: "https://push/este", p256dh: "k", auth: "a" };
vi.mock("@/lib/push", async (orig) => ({ ...(await orig<typeof import("@/lib/push")>()), subscribeThisDevice: async () => DEVICE }));
vi.mock("@/lib/permissions", async (orig) => ({ ...(await orig<typeof import("@/lib/permissions")>()), notifyState: () => "granted" }));

const { RestTimerBar } = await import("./rest-timer");

function StartRest({ seconds }: { seconds: number }) {
  const { actions } = useWorkout();
  useEffect(() => { actions.startRest(seconds); }, [actions, seconds]);
  return null;
}

describe("Descanso · aviso por notificación (suena y vibra con el móvil bloqueado)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al empezar el descanso apunta el aviso en el servidor para este móvil", async () => {
    renderWithWorkout(<><StartRest seconds={90} /><RestTimerBar /></>, undefined, "cloud");
    await waitFor(() => expect(scheduleRestAlert).toHaveBeenCalled());
    const [device, seconds, before] = scheduleRestAlert.mock.calls[0];
    expect(device).toEqual(DEVICE);
    expect(seconds).toBeGreaterThan(88);
    expect(seconds).toBeLessThanOrEqual(90);
    expect(before).toBe(0);
  });

  it("al saltar el descanso quita el aviso", async () => {
    renderWithWorkout(<><StartRest seconds={90} /><RestTimerBar /></>, undefined, "cloud");
    fireEvent.click(await screen.findByRole("button", { name: "Saltar" }));
    await waitFor(() => expect(cancelRestAlert).toHaveBeenCalled());
  });

  it("sin cuenta (modo local) no usa el servidor", async () => {
    renderWithWorkout(<><StartRest seconds={90} /><RestTimerBar /></>);
    await screen.findByRole("button", { name: "Saltar" });
    await new Promise((r) => setTimeout(r, 30));
    expect(scheduleRestAlert).not.toHaveBeenCalled();
  });
});
