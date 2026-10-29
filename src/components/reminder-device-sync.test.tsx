import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getReminder = vi.fn();
const registerDevice = vi.fn(async (device: unknown) => ({ ok: !!device }));
vi.mock("@/app/actions/reminders", () => ({ getReminder: () => getReminder(), registerDevice: (s: unknown) => registerDevice(s) }));
const subscribeThisDevice = vi.fn(async () => ({ endpoint: "https://push/nuevo", p256dh: "k", auth: "a" }));
vi.mock("@/lib/push", () => ({ subscribeThisDevice: () => subscribeThisDevice() }));
let permission = "granted";
vi.mock("@/lib/permissions", () => ({ notifyState: () => permission }));

const { ReminderDeviceSync } = await import("./reminder-device-sync");

describe("Recordatorio · el móvil se vuelve a registrar al abrir la app", () => {
  afterEach(() => { vi.clearAllMocks(); permission = "granted"; });

  it("con el recordatorio activado y permiso, registra este móvil (por si su suscripción caducó)", async () => {
    getReminder.mockResolvedValue({ ok: true, data: { enabled: true } });
    render(<ReminderDeviceSync delayMs={0} />);
    await waitFor(() => expect(registerDevice).toHaveBeenCalledWith({ endpoint: "https://push/nuevo", p256dh: "k", auth: "a" }));
  });

  it("con el recordatorio desactivado no registra nada", async () => {
    getReminder.mockResolvedValue({ ok: true, data: { enabled: false } });
    render(<ReminderDeviceSync delayMs={0} />);
    await waitFor(() => expect(getReminder).toHaveBeenCalled());
    expect(subscribeThisDevice).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it("sin permiso de notificaciones no pregunta nada ni registra", async () => {
    permission = "default";
    render(<ReminderDeviceSync delayMs={0} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(getReminder).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });
});
