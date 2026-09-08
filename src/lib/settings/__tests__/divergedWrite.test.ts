import {
  createSettingsWriter,
  SETTINGS_RECONCILE_BACKSTOP_MS,
  type SaveStatus,
  type SettingsWriter,
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

describe("#200 — a write queued behind one that diverges", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("still runs, instead of waiting for an unrelated later change", async () => {
    // Found by the pre-merge review, and it is the promise of the whole
    // conflict branch: reconciliation calls `pushImmediate` to put memory back
    // on the file WHILE the write that diverged is still in flight, so
    // `startWrite` only marks the queue dirty. Returning on `diverged` without
    // draining that queue left the conflict copy on disk and the restore
    // unscheduled — until something unrelated happened to carry it.
    const save = makeSave();
    // Collected rather than held in a variable: TypeScript narrows a variable
    // assigned inside a promise executor to `never` at the call site.
    const settlers: Array<() => void> = [];
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () =>
        new Promise((resolve) => {
          settlers.push(() => resolve("diverged" as const));
        }),
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);

    // The reconciliation's write, arriving while the first is unresolved.
    writer.pushImmediate({ n: 2 });
    expect(save.calls).toHaveLength(1);

    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toHaveLength(2);
    expect(save.calls[1]).toEqual({ n: 2 });
  });
});

describe("#200 — an ordinary edit queued behind a diverged write", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * A writer whose verification is held open, so a value can be queued
   * mid-write.
   *
   * Everything it creates is registered for teardown. A test that ends with a
   * verification still unresolved leaves a promise chain and a live writer
   * behind, and the next test in the file inherits them: these cases passed
   * alone and hung together until the leak was closed rather than the symptom.
   */
  const open: Array<{
    writer: SettingsWriter<Value>;
    settlers: Array<() => void>;
  }> = [];

  afterEach(() => {
    for (const { writer, settlers } of open) {
      settlers.forEach((settle) => settle());
      writer.dispose();
    }
    open.length = 0;
  });

  function heldWriter(save: (v: Value) => Promise<unknown>) {
    const settlers: Array<() => void> = [];
    const writer = createSettingsWriter<Value>({
      save,
      verify: () =>
        new Promise((resolve) => {
          settlers.push(() => resolve("diverged" as const));
        }),
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    open.push({ writer, settlers });
    return { writer, settlers };
  }

  it("is not written the instant we learn the file was replaced", async () => {
    // The catch-up review's finding, and the overreach in the first version of
    // the drain: this value is the user's ordinary edit, not reconciliation's
    // restore. Writing it here races the hook that is about to copy the other
    // writer's version aside — and that copy is what makes the branch
    // non-destructive.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);

    // Queued while the first write is still unresolved, and its own debounce
    // is spent on a `startWrite` that finds the writer busy.
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);

    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toHaveLength(1);
    expect(writer.status().kind).toBe("diverged");
  });

  it("is held until reconciliation says it may go", async () => {
    // The catch-up review's second pass. Re-arming the 400ms debounce was still
    // a race: 400ms against a host callback that has to read the file and write
    // a copy. The value waits for `resume`, which every branch of the hook
    // calls when it is done deciding.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    // Long past its own debounce, and still not on disk.
    await jest.advanceTimersByTimeAsync(3000);
    expect(save.calls).toHaveLength(1);

    writer.resume();
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toHaveLength(2);
    expect(save.calls[1]).toEqual({ n: 2 });
  });

  it("goes to disk anyway if reconciliation never comes", async () => {
    // What makes deferring safe rather than a new way to strand a change: a
    // host that reports a divergence but never fires the external-change event
    // would otherwise hold the user's edit forever.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(SETTINGS_RECONCILE_BACKSTOP_MS + 400);

    expect(save.calls).toHaveLength(2);
    expect(save.calls[1]).toEqual({ n: 2 });
  });

  it("an ordinary edit does not inherit an immediate write's licence", async () => {
    // The marker belongs to the queued VALUE. Left on the writer, an ordinary
    // edit made while reconciliation's restore was still queued would bypass
    // the debounce on divergence — the race the split exists to prevent,
    // arriving from inside.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.pushImmediate({ n: 2 });
    writer.push({ n: 3 });
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(3000);
    expect(save.calls).toHaveLength(1);
  });

  it("a further change of the user's releases the hold by itself", async () => {
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    writer.push({ n: 3 });
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls[1]).toEqual({ n: 3 });
  });

  it("is not forced out by shutdown either", async () => {
    // The third review pass, and the one path that ignores every timer:
    // `flush` runs on quit and on unload with a forced write. Forcing it here
    // would put this session's edit over a file somebody else replaced, with no
    // copy of theirs anywhere. The edit is lost on reload instead — which is
    // what #185 already promises for a change that could not be written, and
    // the standing mark is what warns before it happens.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    await writer.flush();

    expect(save.calls).toHaveLength(1);
  });

  it("is flushed as usual once reconciliation has released it", async () => {
    // The refusal is scoped to the hold, not to shutdown: a value nobody is
    // waiting on still reaches the disk when the window closes.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    writer.resume();
    const flushed = writer.flush();
    // The flush starts the write; its verification is held open like the
    // first one's, so it has to be settled or the flush waits for a promise
    // nobody resolves.
    await jest.advanceTimersByTimeAsync(0);
    settlers[1]?.();
    await flushed;

    expect(save.calls).toHaveLength(2);
    expect(save.calls[1]).toEqual({ n: 2 });
  });

  it("settled() waits for a write in flight and starts nothing", async () => {
    // What reconciliation awaits before deciding: `flush` cannot serve, because
    // it WRITES what is pending, and the caller must decide what to do about
    // somebody else's file before this session adds to it.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });

    let done = false;
    const waiting = writer.settled().then(() => {
      done = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);

    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);
    await waiting;

    expect(done).toBe(true);
    // The queued value is still queued: awaiting must not write it.
    expect(save.calls).toHaveLength(1);
  });
});

describe("#200 — holding the writer when the other version could not be copied", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("stops the pending write, so the file the user was told to copy survives", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-106");
    await jest.advanceTimersByTimeAsync(5000);

    expect(save.calls).toHaveLength(0);
    expect(writer.status().kind).toBe("diverged");
  });

  it("stops a write that is only debounced, not merely one in flight", async () => {
    // The sixth review pass. Reconciliation suspends BEFORE it awaits, because
    // deciding takes several awaits — reading the file, writing the copy — and
    // a debounce that fires in the middle of them overwrites the version being
    // preserved. `settled()` alone returns at once when nothing is in flight
    // and leaves that timer standing.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-105");
    await writer.settled();
    await jest.advanceTimersByTimeAsync(2000);

    expect(save.calls).toHaveLength(0);
    expect(writer.hasPending()).toBe(true);
  });

  it("is written after reconciliation lifts the hold, not left dirty forever", async () => {
    // The seventh review pass. `hold` and the divergence deferral used to be
    // two mechanisms with two flags, and `resume` read only one of them: a hold
    // followed by a resume cleared the suspension and re-armed nothing, leaving
    // the value dirty with no timer until an unrelated edit or shutdown carried
    // it — which in an interrupted session means losing it.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-105");
    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toHaveLength(0);

    writer.resume();
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 1 }]);
  });

  it("is not written by a shutdown flush while the hold stands", async () => {
    // The same unification closes this: `hold` used to clear the flag `flush`
    // consulted, so quitting wrote the value over the file the hold existed to
    // protect.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-106");
    await writer.flush();

    expect(save.calls).toHaveLength(0);
  });

  it("does not block reconciliation's own restore", async () => {
    // The ninth review pass. Suspension stops ORDINARY writes from overtaking
    // reconciliation; `pushImmediate` is reconciliation's own write, so being
    // blocked by it meant one branch held, preserved, and then restored
    // nothing at all — the settings left dirty until an unrelated edit.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-105");
    writer.pushImmediate({ n: 2 });
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toEqual([{ n: 2 }]);
  });

  it("republishes the mark when the second hold carries a different code", async () => {
    // The tenth review pass. The conflict branch holds twice — once to stop
    // writing while it decides, once more with the code the notice ended up
    // using — and `sameStatus` treated any two `diverged` states as equal, so
    // the mark went on claiming the other version had been preserved while the
    // notice said nothing could be written.
    const seen: SaveStatus[] = [];
    const writer = createSettingsWriter<Value>({
      save: makeSave().fn,
      onStatus: (status) => seen.push(status),
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-105");
    writer.hold("PPP-106");

    expect(
      seen.filter((s) => s.kind === "diverged").map((s) => s.code)
    ).toEqual(["PPP-105", "PPP-106"]);
    expect(writer.status()).toEqual({ kind: "diverged", code: "PPP-106" });
  });

  it("keeps the value, so the user's next change still reaches the disk", async () => {
    // A hold that dropped the pending change would trade one loss for another.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    writer.hold("PPP-106");
    await jest.advanceTimersByTimeAsync(5000);

    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 2 }]);
    expect(writer.hasPending()).toBe(false);
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
