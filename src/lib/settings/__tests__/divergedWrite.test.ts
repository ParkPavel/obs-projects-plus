import {
  createSettingsWriter,
  SETTINGS_RECONCILE_BACKSTOP_MS,
  type SaveStatus,
  type SettingsWriter,
  type WriteOutcome,
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

/**
 * #212 — end an episode with `outcome`, immediately.
 *
 * `hold`, `resume` and `settled` are gone: an episode is a lease now, and this
 * is what "hold" or "release" looks like from a caller. Written as a helper so
 * the cases below read as what they assert rather than as ceremony.
 */
async function lease(
  writer: SettingsWriter<Value>,
  outcome: WriteOutcome<Value>,
  code = "PPP-105"
): Promise<void> {
  await writer.withExclusive(code, async () => outcome);
}

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

    await lease(writer, { kind: "release" });
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
    writer.pushNow({ n: 2 });
    writer.push({ n: 3 });
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(3000);
    expect(save.calls).toHaveLength(1);
  });

  it("a further change of the user's does NOT release a fence", async () => {
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(400);
    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);

    // #212 step B — the behaviour this step deliberately changes. A fence is
    // reconciliation mid-decision, possibly mid-copy; an edit arriving there
    // must wait, not overtake it. (A HOLD is the opposite case and is still
    // released by the next change — the test above.)
    writer.push({ n: 3 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);

    // …and it is not lost: the fence's own deadline carries it.
    await jest.advanceTimersByTimeAsync(SETTINGS_RECONCILE_BACKSTOP_MS + 400);
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

    await lease(writer, { kind: "release" });
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

  it("fences on every divergence, even with nothing queued", async () => {
    // `PLAN_212` T8 said unconditional and I implemented it conditionally; the
    // review found the gap. With nothing queued the permit stayed open, so an
    // edit made before the host dispatched its change event armed a debounce
    // and overwrote the other version before anything preserved it. The fence
    // is about the FILE having been replaced, not about what we hold.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      verify: () => Promise.resolve("diverged" as const),
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);
    expect(writer.status().kind).toBe("diverged");

    // The user edits before the hook arrives.
    writer.push({ n: 2 });
    await jest.advanceTimersByTimeAsync(2000);

    expect(save.calls).toHaveLength(1);
  });

  it("decides overlapping episodes one at a time", async () => {
    // Two external notifications can arrive while a read or a copy is being
    // awaited. Fencing is shared state, not a queue: without serialising, the
    // second episode saw the first one's fence, called it "pending", and the
    // two bodies interleaved over one adoption.
    const writer = createSettingsWriter<Value>({ save: makeSave().fn });
    const order: string[] = [];

    const first = writer.withExclusive("PPP-102", async () => {
      order.push("first in");
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push("first out");
      return { kind: "release" as const };
    });
    const second = writer.withExclusive("PPP-102", async () => {
      order.push("second in");
      return { kind: "release" as const };
    });

    await jest.advanceTimersByTimeAsync(100);
    await Promise.all([first, second]);

    expect(order).toEqual(["first in", "first out", "second in"]);
  });

  it("tells the body what was pending BEFORE the fence went up", async () => {
    // The review of step F found this as a P1, and no unit test could have:
    // it is a composition between the writer and the hook, and the file that
    // composes them has no coverage. The fence publishes `diverged`, and
    // `hasPending` counts that status as unsaved work — so a body asking the
    // writer mid-episode always heard "pending", every external change was read
    // as a conflict, and adoption (the entire point of #200) would never have
    // happened again.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    writer.prime({ n: 0 });

    let seen: boolean | null = null;
    await writer.withExclusive("PPP-102", async (entry) => {
      seen = entry.pending;
      return { kind: "release" as const };
    });

    expect(seen).toBe(false);
    // …and the writer's own answer is unchanged for everyone else.
    expect(writer.hasPending()).toBe(false);
  });

  it("tells the body that a queued edit IS pending", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });
    writer.prime({ n: 0 });
    writer.push({ n: 1 });

    let seen: boolean | null = null;
    await writer.withExclusive("PPP-102", async (entry) => {
      seen = entry.pending;
      return { kind: "release" as const };
    });

    expect(seen).toBe(true);
  });

  it("the lease waits for a write in flight before its body runs", async () => {
    // What absorbed `settled`. Reconciliation must not decide what to do about
    // somebody else's file while a write of ours is still landing on it — and
    // it must not WRITE anything to find that out, which is why `flush` could
    // never have served here.
    const save = makeSave();
    const { writer, settlers } = heldWriter(save.fn);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);
    expect(save.calls).toHaveLength(1);
    writer.push({ n: 2 });

    let bodyRan = false;
    const running = writer.withExclusive("PPP-102", async () => {
      bodyRan = true;
      return { kind: "release" as const };
    });
    await jest.advanceTimersByTimeAsync(0);
    // The first write has not settled, so the decision has not begun…
    expect(bodyRan).toBe(false);

    settlers[0]?.();
    await jest.advanceTimersByTimeAsync(0);
    await running;

    expect(bodyRan).toBe(true);
    // …and the queued value is still queued: waiting must not write it.
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
    await lease(writer, { kind: "hold", code: "PPP-106" });
    await jest.advanceTimersByTimeAsync(5000);

    expect(save.calls).toHaveLength(0);
    expect(writer.status().kind).toBe("diverged");
  });

  it("a fence is not released by the user's next change", async () => {
    // #212 — the defect PLAN_212 found open at HEAD, from the other end: `push`
    // used to clear the one suspension flag, so an edit arriving while
    // reconciliation was mid-copy went to disk 400ms later. The lease holds the
    // fence for exactly as long as the decision runs.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    let end: ((outcome: WriteOutcome<Value>) => void) | undefined;
    const lease = writer.withExclusive(
      "PPP-105",
      () =>
        new Promise<WriteOutcome<Value>>((resolve) => {
          end = resolve;
        })
    );
    await jest.advanceTimersByTimeAsync(0);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toHaveLength(0);

    end?.({ kind: "release" });
    await lease;
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 1 }]);
  });

  it("a hold IS released by the user's next change", async () => {
    // The other half of the same distinction, and why one boolean could not
    // carry both: after a hold the user has been shown a notice, and holding
    // their work hostage past that helps nobody.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    await writer.withExclusive("PPP-105", async () => ({
      kind: "hold" as const,
      code: "PPP-106",
    }));
    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 1 }]);
  });

  it("the restore writes: it is the write that ends the episode", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    await writer.withExclusive("PPP-105", async () => ({
      kind: "restore" as const,
      settings: { n: 9 },
    }));
    await jest.advanceTimersByTimeAsync(0);

    expect(save.calls).toEqual([{ n: 9 }]);
  });

  it("an edit made during the episode is not clobbered by the restore", async () => {
    // Both values come from the same store, so the later one contains the
    // earlier; taking the newer is not a preference but the only reading that
    // cannot lose the edit.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    await writer.withExclusive("PPP-105", async () => {
      writer.push({ n: 2 });
      return { kind: "restore" as const, settings: { n: 1 } };
    });
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 2 }]);
  });

  it("an adoption is refused when the user edited during the episode", async () => {
    // I5. Today this is safe only because no `await` separates the check from
    // the adoption in `main.ts`; the epoch makes it safe by construction.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const ended = await writer.withExclusive("PPP-102", async () => {
      writer.push({ n: 5 });
      return { kind: "adopted" as const, settings: { n: 7 } };
    });

    expect(ended.kind).toBe("release");
    await jest.advanceTimersByTimeAsync(400);
    // The user's value goes to disk; the disk's is not taken behind it.
    expect(save.calls).toEqual([{ n: 5 }]);
  });

  it("a body that throws writes nothing and leaves the fence standing", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const ended = await writer.withExclusive("PPP-102", async () => {
      writer.push({ n: 1 });
      throw new Error("the decision failed");
    });

    expect(ended.kind).toBe("hold");
    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toHaveLength(0);
    // …and the deadline still ends it, so the edit is not stranded.
    await jest.advanceTimersByTimeAsync(SETTINGS_RECONCILE_BACKSTOP_MS + 400);
    expect(save.calls).toEqual([{ n: 1 }]);
  });

  it("an extended episode keeps the fence across the wait", async () => {
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    const lease = writer.withExclusive("PPP-102", async () => ({
      kind: "extend" as const,
      after: 2000,
      next: async () => ({ kind: "release" as const }),
    }));
    await jest.advanceTimersByTimeAsync(0);

    writer.push({ n: 1 });
    await jest.advanceTimersByTimeAsync(1500);
    expect(save.calls).toHaveLength(0);

    await jest.advanceTimersByTimeAsync(600);
    await lease;
    await jest.advanceTimersByTimeAsync(400);

    expect(save.calls).toEqual([{ n: 1 }]);
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
    // The lease waits for anything in flight itself, which is what `settled`
    // used to be asked for by hand — and in the wrong order, until the sixth
    // review pass.
    await lease(writer, { kind: "hold", code: "PPP-105" });
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
    await lease(writer, { kind: "hold", code: "PPP-105" });
    await jest.advanceTimersByTimeAsync(2000);
    expect(save.calls).toHaveLength(0);

    await lease(writer, { kind: "release" });
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
    await lease(writer, { kind: "hold", code: "PPP-106" });
    await writer.flush();

    expect(save.calls).toHaveLength(0);
  });

  it("does not let an immediate session write past a hold", async () => {
    // #212 replaced the ninth pass's fix rather than keeping it: the restore is
    // no longer a `pushImmediate` that had to lift the suspension itself, it is
    // an outcome of the lease. What is left of that method — `pushNow` — is an
    // ordinary session write, and a hold exists precisely because the file is
    // the only copy of somebody else's version.
    const save = makeSave();
    const writer = createSettingsWriter<Value>({
      save: save.fn,
      debounceMs: 400,
      maxWaitMs: 2000,
    });

    await writer.withExclusive("PPP-105", async () => ({
      kind: "hold" as const,
      code: "PPP-106",
    }));
    writer.pushNow({ n: 2 });
    await jest.advanceTimersByTimeAsync(2000);

    expect(save.calls).toHaveLength(0);
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
    await lease(writer, { kind: "hold", code: "PPP-106" });
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
