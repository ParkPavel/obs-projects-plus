/**
 * #185 — the single writer of `data.json`.
 *
 * Before this module every settings mutation fired its own
 * `void saveData(value)`: writes could overlap, a failure reached the developer
 * console and nobody else, and the store's first (echo) firing rewrote the file
 * with the value that had just been read from it.
 *
 * The writer owns three things the call sites must not know about:
 *
 *   - **Coalescing.** A burst of changes becomes one write of the last value.
 *   - **One write at a time.** While a write is in flight, further values only
 *     replace the pending one; exactly one follow-up write runs when it settles.
 *   - **Status out of band.** `save` is injected, never imported, and the result
 *     is published through `onStatus` instead of being returned. Under
 *     coalescing a per-call promise would correspond to no single write, which
 *     is the same class of claim as a "Saved" notice the code cannot support.
 *
 * State is never rolled back on a failure: the change stays in memory and the
 * user is told it is not on disk. A retry always writes whatever the store holds
 * NOW — `startWrite` reads the queue at call time — so a retry can never
 * resurrect the value it stumbled on.
 */

import { logError } from "src/lib/errors/errorLog";

/**
 * #202 — the one event this module can report to a user. The literal lives here
 * rather than behind a constant so it is greppable from the console line the
 * user quotes; R0.21 checks that every `PPP-nnn` in `src/` is in the registry,
 * so a typo is caught rather than shown.
 *
 * `errorLog` is imported and `errorText` is not, deliberately: this module has
 * no i18n dependency and is unit-tested in isolation, and R0.21 keeps it that
 * way.
 */
const SETTINGS_WRITE_FAILED = "PPP-101";
/** #200 — the file was replaced by another writer. Never retried. */
const SETTINGS_DIVERGED = "PPP-102";

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "failed"; attempts: number; message: string; code: string }
  /**
   * #200 — the file on disk is neither what we wrote nor what was there
   * before: something else replaced it. Distinct from `failed` because the
   * answer is different. A failed write is retried, by the writer and by the
   * user; a diverged one must NOT be, because retrying is precisely the act of
   * overwriting somebody else's change.
   */
  | { kind: "diverged"; code: string };

/** Tail debounce: how long a burst of changes is allowed to keep growing. */
export const SETTINGS_WRITE_DEBOUNCE_MS = 400;

/** Ceiling on that debounce, so a continuous stream still reaches the disk. */
export const SETTINGS_WRITE_MAX_WAIT_MS = 2000;

/**
 * Silent retries (level 0). Most write failures are transient — a synchroniser,
 * an antivirus scan, a cloud drive holding the file — and a dialog for those
 * teaches the user to dismiss dialogs unread. Finite by construction: when this
 * list runs out the status goes to `failed` and no timer remains.
 */
export const SETTINGS_WRITE_RETRY_DELAYS_MS: readonly number[] = [500, 2000];

/**
 * #211 — the backstop on a write deferred until reconciliation has had its turn.
 *
 * Deferring is what stops an ordinary edit from overwriting somebody else's
 * file before the hook has copied it aside. `resume()` is the normal release,
 * and this is what guarantees the value is never stranded if the hook does not
 * come at all — a host that reports a divergence but never fires the external
 * change event, say. Long enough that reconciliation always wins the race,
 * short enough that a change the user made is not sitting unwritten for a time
 * they would notice.
 */
export const SETTINGS_RECONCILE_BACKSTOP_MS = 10000;

/**
 * #200 — what the file said after a write claimed to succeed.
 *
 * `confirmed` — the file holds what was written.
 * `not-written` — it does not, and nothing else explains that: retry.
 * `diverged` — it holds something neither we nor the previous state produced,
 *   so another writer got there. Not ours to retry.
 */
export type WriteVerdict = "confirmed" | "not-written" | "diverged";

/**
 * #212 step A — whose value is queued.
 *
 * `session` is the user's own edit, arriving through the settings store.
 * `reconciler` is the restore that ends an external-change episode. The two
 * have different rights, and keeping the distinction ON THE VALUE is what stops
 * an edit from inheriting a licence granted to the value it replaced.
 */
export type Origin = "session" | "reconciler";

/**
 * #212 step B — who may write, as one value.
 *
 * `open` — the ordinary state: session edits, retries and `flush` all write.
 * `fenced` — reconciliation is deciding what to do about a file somebody else
 *   changed. ONLY its own restore may write; a session edit waits, and is not
 *   dropped. Bounded by `SETTINGS_RECONCILE_BACKSTOP_MS`, so a decision that
 *   never finishes cannot strand the queue.
 * `held` — the other version could not be preserved anywhere, so the file on
 *   disk is the only copy of it. NOBODY writes. Released by the user's next
 *   change, which is their answer to a notice they have already been shown.
 * `closed` — disposed; only the follow-up write of a flush already in progress
 *   completes.
 *
 * The distinction between `fenced` and `held` is the one a single boolean could
 * not carry, and it is the whole fix: **a session `push` releases `held` and
 * does not release `fenced`.** With one flag, `push` had to either release both
 * (letting an edit overtake a decision in progress — the defect found at HEAD
 * in `PLAN_212` section 0) or release neither (stranding the user's change
 * behind a hold that waits for them).
 */
type Permit =
  | { kind: "open" }
  | { kind: "fenced"; code: string; until: ReturnType<typeof setTimeout> }
  | { kind: "held"; code: string }
  | { kind: "closed" };

export interface SettingsWriterOptions<T> {
  save: (value: T) => Promise<unknown>;
  /**
   * #199 — confirm that `value` is what the file now holds. Resolving `false`
   * is a failed write and takes the same path as a thrown one.
   *
   * Optional because a caller that cannot read the file back is better off
   * with the old, weaker guarantee than with a permanent false alarm.
   */
  verify?: (value: T) => Promise<WriteVerdict>;
  onStatus?: (status: SaveStatus) => void;
  debounceMs?: number;
  maxWaitMs?: number;
  retryDelaysMs?: readonly number[];
}

export interface SettingsWriter<T> {
  /**
   * Record `value` as already being on disk without writing it.
   *
   * This is what removes the echo write. Callers pass the very object they read
   * from disk, so the guard is reference equality against that object rather
   * than an assumption about what happened between load and subscribe.
   */
  prime(value: T): void;
  /** Queue `value`. A value identical by reference to the last one is ignored. */
  push(value: T): void;
  /** Write `value` now, bypassing both the debounce and the reference guard. */
  pushImmediate(value: T): void;
  /** Retry after a failure, with the latest value rather than the failed one. */
  retry(): void;
  /**
   * #200/#211 — stop the pending write from running, keeping its value.
   *
   * Used at both ends of the conflict branch. At the start, because deciding
   * what to do about somebody else's file takes several awaits — reading,
   * copying — and a write sitting in its debounce would otherwise fire in the
   * middle of them and overwrite the very version being preserved. At the end,
   * when nothing could be written anywhere: the file on disk is then the only
   * place that version exists, and a write 400ms later would make the notice's
   * instruction a lie.
   *
   * Nothing is dropped — the queue stands, so the user's next change
   * schedules a write again, by which time they have been told. Calling it
   * twice only changes the code the mark carries.
   *
   * This is not the "single owner blocks writes" model the plan rejected: it is
   * a pause that lasts as long as one decision, released by reconciliation
   * itself or by the next thing the user does.
   */
  hold(code: string): void;
  /**
   * #212 step B — reconciliation takes the file while it decides.
   *
   * Unlike `hold`, this is NOT released by the user's next change: an edit
   * arriving mid-decision is exactly what must not reach the disk, because the
   * decision may be part-way through copying the other version aside. It is
   * released by `resume`, by the restore that ends the episode, or by its own
   * deadline if the episode never returns.
   */
  fence(code: string): void;
  /** Write anything pending and wait for the in-flight write to settle. */
  flush(): Promise<void>;
  /**
   * #200 — wait for a write already running, WITHOUT starting anything new.
   *
   * `flush` cannot serve here: it writes what is pending, and the caller is
   * reconciliation, which must decide what to do about somebody else's file
   * before this session adds to it. Awaiting first means no write of ours can
   * land between the decision and the message the user is given about it.
   */
  settled(): Promise<void>;
  /**
   * #211 — lift the suspension and let the queued edit go to disk again.
   *
   * After a divergence, a queued edit of the user's is fenced rather than
   * re-armed: reconciliation is on its way to read the file and copy the other
   * version aside, and 400ms is not a guarantee that it gets there first.
   * Every branch of the hook calls this when it is done, so the fence lasts
   * exactly as long as the decision does — and it re-arms the debounce whatever
   * the permit was, which is the one thing an earlier version of this got
   * wrong.
   */
  resume(): void;
  /** Drop every timer. Does not write. */
  dispose(): void;
  status(): SaveStatus;
  /**
   * #200 — does memory hold anything the disk has not confirmed?
   *
   * The status cannot answer this. `push` schedules a write and leaves the
   * status at `idle` until that write STARTS, so a reconciliation reading
   * `idle` as "nothing to lose" would adopt the disk over a change the user
   * made a moment ago. A write in flight and a diverged one count too: in both
   * the value is in memory and not known to be on the file.
   */
  hasPending(): boolean;
}

function sameStatus(a: SaveStatus, b: SaveStatus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "failed" && b.kind === "failed") {
    return (
      a.attempts === b.attempts && a.message === b.message && a.code === b.code
    );
  }
  // #211: two `diverged` states are NOT interchangeable. The conflict branch
  // holds twice — once to stop writing while it decides, once more with the
  // code the notice ended up using — and comparing only the kind meant the
  // second was swallowed: the standing mark went on saying the other version
  // had been preserved (PPP-105) while the notice said nothing could be written
  // (PPP-106). A mark that contradicts its own notice is the defect this ticket
  // exists to remove, one surface over.
  if (a.kind === "diverged" && b.kind === "diverged") {
    return a.code === b.code;
  }
  return true;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function createSettingsWriter<T>(
  options: SettingsWriterOptions<T>
): SettingsWriter<T> {
  const { save, verify, onStatus } = options;
  const debounceMs = options.debounceMs ?? SETTINGS_WRITE_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? SETTINGS_WRITE_MAX_WAIT_MS;
  const retryDelays = options.retryDelaysMs ?? SETTINGS_WRITE_RETRY_DELAYS_MS;

  /**
   * The last value this writer was handed, boxed so that `undefined` is a legal
   * settings value and "nothing yet" is still distinguishable from it. It is
   * what `push` compares against; it says nothing about the disk.
   */
  let last: { value: T } | null = null;
  /**
   * #212 step A — what still has to reach the disk, and WHOSE it is.
   *
   * Three flat booleans used to carry three orthogonal facts, and every fix on
   * one of them silently moved another (`PLAN_212` section 0). This is the
   * first of them: provenance belongs to the queued VALUE, not to the writer,
   * which is what the second review pass asked for. `null` means nothing owed.
   */
  let queue: { value: T; origin: Origin } | null = null;
  let inFlight: Promise<void> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let ceilingTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let status: SaveStatus = { kind: "idle" };
  /**
   * #211 — writing is suspended: the queued value stays, its timers do not.
   * #212 step B: the flag this comment described is now the `Permit` value.
   *
   * ONE flag, after review passes found the same hole in three disguises. Two
   * things suspend writing and they used to be separate mechanisms with
   * separate bugs: the divergence deferral (an ordinary edit must not overtake
   * the hook that is about to copy somebody's version aside) and `hold` (that
   * copy failed, so the file on disk is the only place the version exists).
   * Both mean the same thing — nobody may write until this is resolved — and
   * every path that resolves it now clears one flag rather than one of two.
   *
   * The backstop timer belongs to the deferral only. `hold` has none on
   * purpose: it waits for the user, who has been told.
   */
  let permit: Permit = { kind: "open" };
  let flushing = false;

  function setStatus(next: SaveStatus): void {
    // A write that settles after `dispose` has no audience: `onunload` has
    // already reset the status store and dropped the retry handler. Publishing
    // a late failure here would raise a chip in the NEXT session, whose retry
    // reaches a writer that knows nothing about it — the lying control this
    // ticket exists to remove, arriving by a second route.
    if (permit.kind === "closed") return;
    if (sameStatus(status, next)) return;
    status = next;
    onStatus?.(next);
  }

  function cancelSchedule(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (ceilingTimer !== null) {
      clearTimeout(ceilingTimer);
      ceilingTimer = null;
    }
  }

  /** The fence's deadline, and nothing else, since only a fence has one. */
  function clearPermitTimer(): void {
    if (permit.kind === "fenced") clearTimeout(permit.until);
  }

  function toOpen(): void {
    clearPermitTimer();
    permit = { kind: "open" };
  }

  /**
   * Reconciliation takes the file. The deadline is what keeps this from being
   * the "single owner blocks writes" model `PLAN_200` section 2 rejected: an
   * episode that never returns releases the queue by itself.
   */
  function toFenced(code: string): void {
    clearPermitTimer();
    permit = {
      kind: "fenced",
      code,
      until: setTimeout(() => {
        permit = { kind: "open" };
        if (queue !== null) schedule();
      }, SETTINGS_RECONCILE_BACKSTOP_MS),
    };
  }

  function toHeld(code: string): void {
    clearPermitTimer();
    permit = { kind: "held", code };
  }

  /**
   * The one place that answers "may this value be written now".
   *
   * `force` is the flush's licence, and it is deliberately not a master key: it
   * carries a write past `closed`, and never past a fence or a hold, because
   * quitting must not overwrite a version nothing has preserved.
   */
  function mayWrite(origin: Origin, force: boolean): boolean {
    switch (permit.kind) {
      case "open":
        return true;
      case "fenced":
        return origin === "reconciler";
      case "held":
        return false;
      case "closed":
        return force;
    }
  }

  function cancelRetry(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function schedule(): void {
    if (permit.kind === "closed") return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onDue, debounceMs);
    if (ceilingTimer === null) ceilingTimer = setTimeout(onDue, maxWaitMs);
  }

  function onDue(): void {
    cancelSchedule();
    startWrite();
  }

  function startWrite(force = false): void {
    if (inFlight !== null || queue === null) return;
    // The permit is enforced here as well as by cancelling timers, so a path
    // that reaches `startWrite` another way — a retry from a stale handler, a
    // forced flush — cannot write over a version being preserved either.
    if (!mayWrite(queue.origin, force)) return;
    const { value, origin } = queue;
    queue = null;
    // #199: paired with the failure log below. Between them, a developer can
    // tell the three cases apart that look identical from the outside — the
    // write never started, it started and failed, it started and reported
    // success while the file did not change.
    console.debug("[Projects+] settings write starting");
    setStatus({ kind: "saving" });
    inFlight = Promise.resolve()
      .then(() => attemptWrite(value))
      .then(onWritten, (err) => onFailure(err, value, origin));
  }

  /**
   * #199: a resolved `save` is a claim, not a fact. The live run that produced
   * this ticket had `saveData` report success while the file on disk did not
   * change — so the claim is checked, and an unconfirmed write is a failed one.
   */
  async function attemptWrite(value: T): Promise<"confirmed" | "diverged"> {
    await save(value);
    if (verify === undefined) return "confirmed";
    const verdict = await verify(value);
    if (verdict === "confirmed") return "confirmed";
    if (verdict === "diverged") {
      // #200: not an error, and deliberately not thrown. Throwing would put it
      // on the retry path, and a retry here IS the overwrite. The status says
      // what happened and the writer stands down.
      //
      // #212 step A: returned rather than written to a flag the next function
      // reads. It is produced here and consumed one call later, so a flag only
      // added a way for the two to disagree.
      return "diverged";
    }
    throw new Error(
      "the write reported success but the settings file does not match"
    );
  }

  function onWritten(outcome: "confirmed" | "diverged"): void {
    inFlight = null;
    attempt = 0;
    if (outcome === "diverged") {
      // The value stays in memory: it was written, the file simply no longer
      // reflects it, and this writer does not retry — the retry IS the
      // overwrite.
      setStatus({ kind: "diverged", code: SETTINGS_DIVERGED });
      // …but the reconciliation's own restore is a different thing, and
      // returning here stranded it: `pushImmediate` cancels the debounce, sees
      // a write in flight, and only marks the queue dirty — so the conflict
      // copy existed and the promised restore did not, until some unrelated
      // later change happened to carry it.
      //
      // Only THAT value is written now. The catch-up review found the overreach
      // in the first version of this fix: an ordinary edit queued behind the
      // same write would go to disk the instant we learned somebody else had
      // replaced the file, racing the hook that is about to copy their version
      // aside.
      //
      // It is not dropped either, and that is the second half. Its debounce is
      // already spent — the timer fired while the write was in flight and
      // `startWrite` returned — so left alone it would sit dirty with nothing
      // to carry it, which is exactly the stranding this branch was fixed for.
      //
      // Re-arming the debounce was the first answer and it was still a race:
      // 400ms against a host callback that has to read the file and write a
      // copy. So the value is DEFERRED instead — no timer of its own — and
      // reconciliation releases it when it has preserved or explicitly handled
      // the other version. The backstop below is what makes deferring safe:
      // if the hook never comes, the value still goes to disk.
      if (queue !== null) {
        if (queue.origin === "reconciler") {
          startWrite(flushing);
        } else if (permit.kind === "open") {
          // A debounce armed by a `push` that arrived while the write was in
          // flight is still running, and it would fire straight through the
          // fence. Fencing means fencing, so it goes.
          cancelSchedule();
          toFenced(SETTINGS_DIVERGED);
        }
      }
      return;
    }
    if (queue !== null) {
      // Exactly one follow-up write, carrying whatever arrived meanwhile. It
      // keeps the flush's licence to run past `dispose`: teardown calls
      // `flush()` and `dispose()` back to back, so without this the value
      // queued behind an in-flight write is dropped exactly when the user can
      // no longer notice.
      startWrite(flushing);
      return;
    }
    setStatus({ kind: "idle" });
  }

  function onFailure(err: unknown, value: T, origin: Origin): void {
    inFlight = null;
    // #199: a failed write left no trace anywhere a developer could look. The
    // chip and the Notice are for the user and say nothing about WHY; when the
    // first live run of #185 produced no chip at all, there was no way to tell
    // whether the write had failed silently, succeeded silently, or never
    // started. One line per attempt, with the attempt number, answers that.
    // #202: the same code the Notice and the standing mark carry, so the three
    // can be matched to each other — which is the thing that cost a day on
    // #199 and could not be done at all.
    logError(SETTINGS_WRITE_FAILED, `attempt ${attempt + 1}`, err);
    // Nothing reached the disk, so the value is pending again — with the
    // provenance it had, so a failed restore is still the reconciler's. The
    // state itself is untouched: rolling it back would destroy the user's work
    // on the assumption that the disk is right, exactly where that is unknown.
    // A value queued meanwhile is newer and is left alone.
    if (queue === null) queue = { value, origin };
    attempt += 1;
    const delay = retryDelays[attempt - 1];
    if (delay !== undefined && permit.kind !== "closed") {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        startWrite();
      }, delay);
      return;
    }
    setStatus({
      kind: "failed",
      attempts: attempt,
      message: messageOf(err),
      code: SETTINGS_WRITE_FAILED,
    });
  }

  return {
    prime(value: T): void {
      last = { value };
      queue = null;
      toOpen();
    },
    push(value: T): void {
      if (last !== null && Object.is(last.value, value)) return;
      // #212 step B, and the reason the permit is not a boolean. A change the
      // user makes releases a HOLD — it is their answer to the notice they were
      // shown, and holding their work hostage after that helps nobody. It does
      // NOT release a fence: reconciliation is mid-decision, possibly mid-copy,
      // and an edit landing there overwrites the version being preserved.
      if (permit.kind === "held") toOpen();
      // A change made after the budget was spent is a new episode and gets its
      // own retries. Without this, `attempt` stays past the end of the delay
      // list and every later change gets a single attempt — the writer quietly
      // stops retrying for the rest of the session.
      if (status.kind === "failed") attempt = 0;
      last = { value };
      // Replacing the queue replaces its provenance with it — which is the
      // point of keeping the two together. An ordinary edit can no longer
      // inherit a licence granted to the value it displaced.
      queue = { value, origin: "session" };
      schedule();
    },
    pushImmediate(value: T): void {
      if (status.kind === "failed") attempt = 0;
      last = { value };
      queue = { value, origin: "reconciler" };
      cancelSchedule();
      clearPermitTimer();
      // The suspension exists to stop ORDINARY writes from overtaking
      // reconciliation. This IS reconciliation's write — the restore that ends
      // the episode — so it lifts the suspension rather than being blocked by
      // it. The ninth review pass found the alternative: one branch called
      // `hold` and then `pushImmediate` without a `resume` in between, and the
      // restore silently did nothing. Making the caller remember was the
      // version that failed; the writer knowing which write this is does not.
      permit = { kind: "open" };
      startWrite();
    },
    resume(): void {
      // Unconditional, and that is the seventh review pass's finding: the guard
      // that used to stand here read one of the two flags, so a `hold` followed
      // by a `resume` cleared the suspension and re-armed nothing — the value
      // stayed dirty with no timer until an unrelated edit or shutdown carried
      // it, which in an interrupted session means losing it.
      toOpen();
      if (queue !== null) schedule();
    },
    async settled(): Promise<void> {
      while (inFlight !== null) {
        await inFlight;
      }
    },
    fence(code: string): void {
      cancelSchedule();
      cancelRetry();
      toFenced(code);
      setStatus({ kind: "diverged", code });
    },
    hold(code: string): void {
      cancelSchedule();
      cancelRetry();
      // No deadline: a hold waits for the user, however long that takes,
      // because the file it protects may be the only copy of somebody's
      // settings. The queue is deliberately left standing — it is not on disk,
      // and the next `push` or `resume` must still write it.
      toHeld(code);
      setStatus({ kind: "diverged", code });
    },
    retry(): void {
      if (permit.kind === "closed") return;
      if (status.kind !== "failed" && queue === null) return;
      cancelRetry();
      attempt = 0;
      // A retry writes whatever the store holds NOW, which after a failure is
      // the value still on `last`.
      if (queue === null && last !== null) {
        queue = { value: last.value, origin: "session" };
      }
      startWrite();
    },
    async flush(): Promise<void> {
      cancelSchedule();
      cancelRetry();
      flushing = true;
      try {
        // #211: a fenced or held value is NOT flushed, and shutdown is where
        // that matters. `flush` runs on quit and on unload, and forcing the
        // write there would put this session's edit over a `data.json`
        // somebody else replaced, with no copy of theirs anywhere — the race
        // the deferral exists to prevent, arriving through the one path that
        // ignores timers. The edit is lost on reload, which is what #185
        // already promises for a change that could not be written; the standing
        // mark is what warns before it happens.
        if (permit.kind === "fenced" || permit.kind === "held") {
          console.warn(
            "[Projects+] not writing on shutdown: the settings file was replaced and the change is still unreconciled"
          );
        } else {
          startWrite(true);
        }
        while (inFlight !== null) {
          await inFlight;
        }
      } finally {
        flushing = false;
      }
    },
    dispose(): void {
      cancelSchedule();
      cancelRetry();
      clearPermitTimer();
      permit = { kind: "closed" };
    },
    status(): SaveStatus {
      return status;
    },
    hasPending(): boolean {
      return (
        queue !== null ||
        inFlight !== null ||
        status.kind === "failed" ||
        status.kind === "diverged"
      );
    },
  };
}
