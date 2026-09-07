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
