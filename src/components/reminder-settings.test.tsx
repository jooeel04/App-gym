import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.fn();
const requestTestReminder = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/reminders", () => ({
  getReminder: vi.fn(async () => ({ ok: true, data: { enabled: true, time: "18:00", mode: "daily", weekdays: [1], skipIfTrained: true } })),
  saveReminder: vi.fn(),
  getReminderStatus: (endpoint: unknown) => status(endpoint),
  requestTestReminder: () => requestTestReminder(),
}));
vi.mock("@/lib/push", async (orig) => ({ ...(await orig<typeof import("@/lib/push")>()), currentEndpoint: async () => "https://push/este" }));
vi.mock("@/lib/permissions", () => ({ notifyState: () => "granted", requestPermissions: async () => "granted" }));

const { ReminderRow } = await import("./reminder-settings");

const OK = {
  enabled: true, time: "18:00", devices: 1, this_device: true, keys_ok: true, last_error: null, last_attempt: "2026-10-28T17:00:05Z",
  cron: { active: true, last_run: new Date().toISOString(), last_status: "succeeded" },
  http: { status: 200, body: '{"sent":0}', error: null, timed_out: false },
};

describe("Recordatorio · ¿no te llega?", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("comprueba todo el camino del aviso y dice qué está bien", async () => {
    status.mockResolvedValue({ ok: true, data: OK });
    render(<ReminderRow open onToggle={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprobar" }));
    const list = await screen.findByRole("list", { name: "Estado del recordatorio" });
    await waitFor(() => expect(list.querySelectorAll("li.ok")).toHaveLength(4));
    expect(status).toHaveBeenCalledWith("https://push/este");
  });

  it("si el servicio del móvil rechazó el aviso, lo explica", async () => {
    status.mockResolvedValue({ ok: true, data: { ...OK, last_error: "403 BadJwtToken" } });
    render(<ReminderRow open onToggle={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText(/403 BadJwtToken/)).toBeInTheDocument();
  });

  it("si este móvil no está apuntado, lo dice", async () => {
    status.mockResolvedValue({ ok: true, data: { ...OK, this_device: false } });
    render(<ReminderRow open onToggle={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText(/Este móvil no está apuntado/)).toBeInTheDocument();
  });

  it("«Enviarme una prueba» manda un aviso de verdad", async () => {
    status.mockResolvedValue({ ok: true, data: OK });
    render(<ReminderRow open onToggle={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Enviarme una prueba" }));
    await waitFor(() => expect(requestTestReminder).toHaveBeenCalled());
    expect(await screen.findByText(/Te llegará en unos segundos/)).toBeInTheDocument();
  });
});
