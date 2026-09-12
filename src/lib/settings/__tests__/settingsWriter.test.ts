import {
  createSettingsWriter,
  type SaveStatus,
} from "src/lib/settings/settingsWriter";

/**
 * #185 — the writer's contract, exercised where `saveData` cannot reach.
 *
 * `saveData` is a method on the Obsidian `Plugin` living in `main.ts`, which has
 * no suite in this tree. The writer takes `save` by injection precisely so a
 * FAILING write is expressible: here it is a function that resolves, rejects or
 * hangs on command.
 */

type Value = { readonly n: number };

interface Save {
  fn: (value: Value) => Promise<unknown>;
  calls: Value[];
  /** Resolve every call immediately (default), reject, or hand back control. */
  mode: "ok" | "fail" | "manual";
  pending: Array<{ resolve: () => void; reject: (err: unknown) => void }>;
}

function makeSave(): Save {
  const save: Save = {
    calls: [],
    mode: "ok",
    pending: [],
    fn: (value: Value) => {
      save.calls.push(value);
      if (save.mode === "ok") return Promise.resolve();
      if (save.mode === "fail") return Promise.reject(new Error("EACCES"));
      return new Promise<void>((resolve, reject) => {
        save.pending.push({ resolve, reject });
      });
    },
  };
  return save;
}

describe("#185 — settings writer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("coalesces a burst into one write of the last value", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const a = { n: 1 };
    const b = { n: 2 };
    const c = { n: 3 };
    writer.push(a);
    await jest.advanceTimersByTimeAsync(100);
    writer.push(b);
    await jest.advanceTimersByTimeAsync(100);
    writer.push(c);
    await jest.advanceTimersByTimeAsync(399);
    expect(save.calls).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(save.calls).toEqual([c]);
  });

  it("writes at the ceiling even while the burst keeps resetting the debounce", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 1000,
    });

    const last = { n: 3 };
    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(350);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(350);
    writer.push(last);
    await jest.advanceTimersByTimeAsync(299);
    expect(save.calls).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(save.calls).toEqual([last]);
  });

  it("never runs two writes at once, and follows one in flight with exactly one more", async () => {
    const save = makeSave();
    save.mode = "manual";
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const first = { n: 1 };
    writer.push(first);
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toEqual([first]);

    const second = { n: 2 };
    const third = { n: 3 };
    writer.push(second);
    await jest.advanceTimersByTimeAsync(400);
    writer.push(third);
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toEqual([first]);

    save.pending[0]?.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(save.calls).toEqual([first, third]);

    save.pending[1]?.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toEqual([first, third]);
  });

  it("retries silently and reports failure only once the attempts run out", async () => {
    const save = makeSave();
    save.mode = "fail";
    const statuses: SaveStatus[] = [];
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      onStatus: (s) => statuses.push(s),
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500, 2000],
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);
    expect(writer.status()).toEqual({ kind: "saving" });

    await jest.advanceTimersByTimeAsync(500);
    expect(save.calls).toHaveLength(2);
    expect(writer.status()).toEqual({ kind: "saving" });

    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toHaveLength(3);
    expect(writer.status()).toEqual({
      kind: "failed",
      attempts: 3,
      message: "EACCES",
    });

    await jest.advanceTimersByTimeAsync(60_000);
    expect(save.calls).toHaveLength(3);
  });

  it("announces one failure per episode, not one per attempt", async () => {
    const save = makeSave();
    save.mode = "fail";
    const statuses: SaveStatus[] = [];
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      onStatus: (s) => statuses.push(s),
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500, 2000],
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400 + 500 + 2000);

    expect(save.calls).toHaveLength(3);
    expect(statuses.filter((s) => s.kind === "failed")).toHaveLength(1);
    expect(statuses.map((s) => s.kind)).toEqual(["saving", "failed"]);
  });

  it("retries with the LATEST value, never the one it stumbled on", async () => {
    const save = makeSave();
    save.mode = "fail";
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      // The debounce is longer than the retry delay on purpose: the second
      // write can then only have come from the retry path.
      debounceMs: 5000,
      maxWaitMs: 60_000,
      retryDelaysMs: [500],
    });

    const stale = { n: 1 };
    const fresh = { n: 2 };
    writer.push(stale);
    await jest.advanceTimersByTimeAsync(5000);
    expect(save.calls).toEqual([stale]);

    writer.push(fresh);
    await jest.advanceTimersByTimeAsync(500);
    expect(save.calls).toEqual([stale, fresh]);
  });

  it("recovers: a manual retry after failure writes the latest value and clears the status", async () => {
    const save = makeSave();
    save.mode = "fail";
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500],
    });

    const value = { n: 1 };
    writer.push(value);
    await jest.advanceTimersByTimeAsync(400 + 500);
    expect(writer.status().kind).toBe("failed");

    save.mode = "ok";
    writer.retry();
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toEqual([value, value, value]);
    expect(writer.status()).toEqual({ kind: "idle" });
  });

  it("does not write the echo of the value it was primed with", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const loaded = { n: 1 };
    writer.prime(loaded);
    // A Svelte store fires immediately on subscribe, with the value already
    // read from disk. That echo is what used to overwrite `__broken_backup`.
    writer.push(loaded);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(save.calls).toEqual([]);

    const changed = { n: 2 };
    writer.push(changed);
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toEqual([changed]);
  });

  it("pushImmediate writes a value the reference guard would have swallowed", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const migrated = { n: 4 };
    writer.prime(migrated);
    // The migration result IS the primed value; it still has to reach the disk,
    // which is why skipping the echo alone would stop persisting migrations.
    writer.pushImmediate(migrated);
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toEqual([migrated]);
  });

  it("flush writes what is pending without waiting for the debounce", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 5000,
      maxWaitMs: 60_000,
    });

    const value = { n: 1 };
    writer.push(value);
    await writer.flush();

    expect(save.calls).toEqual([value]);
    expect(writer.status()).toEqual({ kind: "idle" });

    await jest.advanceTimersByTimeAsync(60_000);
    expect(save.calls).toEqual([value]);
  });

  it("dispose leaves no timer behind and writes nothing", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.dispose();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(save.calls).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
