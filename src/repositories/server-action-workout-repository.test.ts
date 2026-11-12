import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshSnapshot } from "../../tests/workout-fixture";
import type { WorkoutChange } from "@/domain/types";

const applyWorkoutChanges = vi.fn();
vi.mock("@/app/actions/workout", () => ({
  applyWorkoutChanges: (...a: unknown[]) => applyWorkoutChanges(...a),
  loadWorkout: vi.fn(async () => null),
}));

const { ServerActionWorkoutRepository } = await import("./server-action-workout-repository");

const REMOVE: WorkoutChange = { type: "sessionRemoved", week: 3, day: 1, round: 1 };
const outbox = () => JSON.parse(localStorage.getItem("rutina:yo@x.es:outbox") ?? "[]") as unknown[];
const serverError = () => Object.assign(new Error("Error del servidor"), { digest: "x" });

// Spec datos R8: un lote rechazado por el servidor no se pierde.
describe("Sincronización · no se pierde ningún cambio", () => {
  beforeEach(() => { localStorage.clear(); applyWorkoutChanges.mockReset(); });

  it("si el servidor rechaza un lote, manda el estado completo del dispositivo y vacía la cola", async () => {
    applyWorkoutChanges.mockImplementation(async (changes: WorkoutChange[]) => {
      if (changes[0].type !== "replaced") throw serverError();
    });
    const repo = new ServerActionWorkoutRepository("yo@x.es");
    const snap = freshSnapshot();
    await repo.apply(REMOVE, snap);
    await repo.flush();
    const last = applyWorkoutChanges.mock.calls.at(-1)!;
    expect(last[0]).toEqual([{ type: "replaced" }]);
    expect(last[1]).toEqual(snap);
    expect(repo.hasPending()).toBe(false);
    expect(outbox()).toEqual([]);
  });

  it("si tampoco se puede mandar el estado completo, los cambios siguen en la cola y se avisa", async () => {
    applyWorkoutChanges.mockRejectedValue(serverError());
    const repo = new ServerActionWorkoutRepository("yo@x.es");
    const onError = vi.fn();
    repo.setErrorHandler(onError);
    await repo.apply(REMOVE, freshSnapshot());
    await repo.flush();
    expect(onError).toHaveBeenCalled();
    expect(repo.hasPending()).toBe(true);
    expect(outbox()).toHaveLength(1);
  });

  it("sin red, espera con los cambios en la cola", async () => {
    applyWorkoutChanges.mockRejectedValue(new TypeError("Failed to fetch"));
    const repo = new ServerActionWorkoutRepository("yo@x.es");
    await repo.apply(REMOVE, freshSnapshot());
    await repo.flush();
    expect(repo.hasPending()).toBe(true);
  });
});

describe("Sincronización · avisa una sola vez", () => {
  beforeEach(() => { localStorage.clear(); applyWorkoutChanges.mockReset(); });

  it("si sigue fallando, no repite el aviso en cada reintento", async () => {
    applyWorkoutChanges.mockRejectedValue(Object.assign(new Error("Error del servidor"), { digest: "x" }));
    const repo = new ServerActionWorkoutRepository("yo@x.es");
    const onError = vi.fn();
    repo.setErrorHandler(onError);
    await repo.apply(REMOVE, freshSnapshot());
    await repo.flush();
    await repo.flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
