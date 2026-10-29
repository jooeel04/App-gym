import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getReminder = vi.fn();
const registerDevice = vi.fn(async (device: unknown) => ({ ok: !!device }));
vi.mock("@/app/actions/reminders", () => ({ getReminder: () => getReminder(), registerDevice: (s: unknown) => registerDevice(s) }));
const subscribeThisDevice = vi.fn(async () => ({ endpoint: "https://push/nuevo", p256dh: "k", auth: "a" }));
vi.mock("@/lib/push", () => ({ subscribeThisDevice: () => subscribeThisDevice() }));
let permission = "granted";
const requestPermissions = vi.fn(async () => { permission = "granted"; return "granted"; });
vi.mock("@/lib/permissions", () => ({ notifyState: () => permission, needsHomeScreen: () => false, requestPermissions: () => requestPermissions() }));

const { ReminderDeviceSync } = await import("./reminder-device-sync");

describe("Recordatorio · el móvil se vuelve a registrar al abrir la app", () => {
  afterEach(() => { vi.clearAllMocks(); permission = "granted"; localStorage.clear(); });

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

  it("sin recordatorio activado no muestra nada aunque falte el permiso", async () => {
    permission = "default";
    getReminder.mockResolvedValue({ ok: true, data: { enabled: false } });
    render(<ReminderDeviceSync delayMs={0} />);
    await waitFor(() => expect(getReminder).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Activar avisos" })).not.toBeInTheDocument();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it("con el recordatorio activado pero sin permiso en este móvil (p. ej. tras volver a añadir la app), lo pide con un botón", async () => {
    permission = "default";
    getReminder.mockResolvedValue({ ok: true, data: { enabled: true } });
    render(<ReminderDeviceSync delayMs={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Activar avisos" }));
    await waitFor(() => expect(registerDevice).toHaveBeenCalledWith({ endpoint: "https://push/nuevo", p256dh: "k", auth: "a" }));
    expect(requestPermissions).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Activar avisos" })).not.toBeInTheDocument());
  });

  it("«Ahora no» lo esconde unos días", async () => {
    permission = "default";
    getReminder.mockResolvedValue({ ok: true, data: { enabled: true } });
    const { unmount } = render(<ReminderDeviceSync delayMs={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
    expect(screen.queryByRole("button", { name: "Activar avisos" })).not.toBeInTheDocument();
    unmount();
    render(<ReminderDeviceSync delayMs={0} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Activar avisos" })).not.toBeInTheDocument();
  });
});
