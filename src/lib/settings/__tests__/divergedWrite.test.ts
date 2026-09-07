import {
  createSettingsWriter,
  type SaveStatus,
} from "src/lib/settings/settingsWriter";

/**
 * #200 step 1 — a write the plugin could not confirm stops being called a
 * success.
 *
 * Until now `verify` was a boolean and the one case that is neither success nor
 * failure — the file replaced by somebody else — was reported as `true`. Every
 * argument about who owns `data.json` rests on that status, so it has to stop
 * saying something untrue before reconciliation is built on top of it.
 *
 * `diverged` is deliberately NOT `failed`, and the difference is the whole
 * point: a failed write is retried, by the writer and by the user. A diverged
 * one must not be, because the retry IS the overwrite of somebody else's
 * change.
 */

type Value = { readonly n: number };

function makeSave(): {
  fn: (value: Value) => Promise<unknown>;
  calls: Value[];
} {
  const calls: Value[] = [];
  return {
    calls,
    fn: (value: Value) => {
      calls.push(value);
      return Promise.resolve();
    },
  };
}

describe("#200 — a diverged write", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is not reported as idle", async () => {
    const save = makeSave();
    const seen: SaveStatus[] = [];
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () => Promise.resolve("diverged" as const),
      onStatus: (status) => seen.push(status),
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    expect(writer.status().kind).toBe("diverged");
    expect(seen.map((s) => s.kind)).not.toContain("idle");
  });

  it("is not retried, because the retry is the overwrite", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () => Promise.resolve("diverged" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500, 2000],
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    await jest.advanceTimersByTimeAsync(5000);

    expect(save.calls).toHaveLength(1);
  });

  it("carries a code, like every other reportable state", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () => Promise.resolve("diverged" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    const status = writer.status();
    expect(status.kind === "diverged" && status.code).toMatch(/^PPP-\d{3}$/);
  });

  it("still fails a write that simply did not land", async () => {
    // The distinction has to cut both ways: an unconfirmed write with no other
    // explanation is still a failure, and is still retried.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () => Promise.resolve("not-written" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [500],
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    await jest.advanceTimersByTimeAsync(500);

    expect(save.calls.length).toBeGreaterThan(1);
    expect(writer.status().kind).toBe("failed");
  });
});

describe("#200 — what the writer holds that the disk does not", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is false after priming: that value came off the disk", () => {
    const writer = createSettingsWriter<Value>({ save: makeSave().fn });
    writer.prime({ n: 0 });

    expect(writer.hasPending()).toBe(false);
  });

  it("is true while a change is only debounced", () => {
    // The reason this exists at all. `push` leaves the status at `idle` until
    // the write STARTS, so reconciliation reading the status would take the
    // disk over a change the user made half a second ago.
    const writer = createSettingsWriter<Value>({
      save: makeSave().fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    writer.prime({ n: 0 });
    writer.push({ n: 1 });

    expect(writer.status().kind).toBe("idle");
    expect(writer.hasPending()).toBe(true);
  });

  it("is false again once the write is confirmed", async () => {
    const writer = createSettingsWriter<Value>({
      save: makeSave().fn,
      verify: () => Promise.resolve("confirmed" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    writer.prime({ n: 0 });
    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    expect(writer.hasPending()).toBe(false);
  });

  it("stays true after a diverged write", async () => {
    // The value was written and the file no longer reflects it, so memory
    // holds something the disk has not confirmed — which is exactly the state
    // in which adopting the disk would be a loss.
    const writer = createSettingsWriter<Value>({
      save: makeSave().fn,
      verify: () => Promise.resolve("diverged" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    writer.prime({ n: 0 });
    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    expect(writer.status().kind).toBe("diverged");
    expect(writer.hasPending()).toBe(true);
  });

  it("stays true after a failed write", async () => {
    const writer = createSettingsWriter<Value>({
      save: () => Promise.reject(new Error("nope")),
      debounceMs: 400,
      maxWaitMs: 2000,
      retryDelaysMs: [],
    });
    writer.prime({ n: 0 });
    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    expect(writer.status().kind).toBe("failed");
    expect(writer.hasPending()).toBe(true);
  });
});
