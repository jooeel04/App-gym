import { describe, expect, it, vi } from "vitest";

// Contexto de audio falso: empieza suspendido, como en iPhone al volver de segundo plano.
const resume = vi.fn(async function (this: { state: string }) { this.state = "running"; });
const started: number[] = [];
const contexts: FakeAudio[] = [];
class FakeAudio {
  constructor() { contexts.push(this); }
  state = "suspended";
  currentTime = 0;
  destination = {};
  resume = resume;
  createOscillator() { return { frequency: { value: 0 }, connect: (g: unknown) => g, start: (t: number) => started.push(t), stop: () => {} }; }
  createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (d: unknown) => d }; }
}
vi.stubGlobal("AudioContext", FakeAudio);

const { restFinishedAlert, unlockAudio } = await import("./alerts");

describe("Aviso del descanso · sonido", () => {
  it("si el audio está parado (la app estuvo en segundo plano) lo reanuda y pita igual", async () => {
    unlockAudio();
    await vi.waitFor(() => expect(contexts[0].state).toBe("running"));
    contexts[0].state = "interrupted";
    resume.mockClear();
    restFinishedAlert("sound");
    await vi.waitFor(() => expect(started.length).toBe(3));
    expect(resume).toHaveBeenCalled();
  });
});
