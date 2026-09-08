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
 * #212 step D — how an episode ends, in the writer's own vocabulary.
 *
 * Returned by the body of `withExclusive`, and exhaustive on purpose: a branch
 * that forgets to say how the episode ended is a compile error, where before it
 * was a missing `resume()` in one of eight places and a value stranded until
 * shutdown (findings 7, 9 and 11 of the #211 loop).
 *
 * `release` — nothing is owed; a queued edit returns to its ordinary schedule.
 * `adopted` — the disk was taken whole; the queue is cleared with it.
 * `restore` — this session's version becomes the file, at once, through the
 *   fence, because it is the write that ends the episode.
 * `hold`  — nothing could be preserved; nobody writes until the user acts.
 * `extend` — the file has not settled; wait and decide again, fence intact.
 */
/**
 * #212 — what was true when the episode began.
 *
 * Handed to the body rather than looked up inside it: the fence publishes a
 * status of its own, so a body that asked the writer would be told about the
 * lease instead of about the user.
 */
export interface EpisodeEntry {
  /** Memory held something the disk had not confirmed when the fence went up. */
  readonly pending: boolean;
}

export type WriteOutcome<T> =
  | { readonly kind: "release" }
  | { readonly kind: "adopted"; readonly settings: T }
  | { readonly kind: "restore"; readonly settings: T }
  | { readonly kind: "hold"; readonly code: string }
  | {
      readonly kind: "extend";
      readonly after: number;
      /**
       * Deliberately NOT called `then`, which is what PLAN_212 §1 named it. An
       * object with a callable `then` is a thenable: `await body()` would try
       * to unwrap the outcome and CALL this continuation as part of resolving
       * the promise. Found by the compiler on the first build of this step, and
       * it would have been a runtime hazard, not a typing one.
       */
      readonly next: (entry: EpisodeEntry) => Promise<WriteOutcome<T>>;
    };

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
  /**
   * #212 step D — write `value` now, bypassing the debounce and the reference
   * guard.
   *
   * What is left of `pushImmediate` once reconciliation's restore became an
   * outcome of the lease. Two callers remain and both are ordinary session
   * writes that must not wait: the migration written at load because the
   * version changed, and the counter carried forward after an adoption. It is
   * NOT a way past a fence or a hold — those are answered by `mayWrite` like
   * any other session value.
   */
  pushNow(value: T): void;
  /** Retry after a failure, with the latest value rather than the failed one. */
  retry(): void;
  /** Write anything pending and wait for the in-flight write to settle. */
  flush(): Promise<void>;
  /**
   * #212 step D — take the file for the length of one decision.
   *
   * Everything the reconciliation used to arrange by hand happens here in a
   * fixed order that no caller can get wrong: the fence goes up BEFORE any
   * awaiting (the sixth review pass), a write already in flight is awaited
   * before the body runs (the absorbed `settled`), and the fence comes down in
   * a `finally` (findings 7, 9, 11, which were each one branch of eight
   * forgetting to release).
   *
   * The body says how the episode ended by returning a `WriteOutcome`; there is
   * no other way to end it, and no way to end it twice. A body that throws
   * leaves the fence standing with a fresh deadline — an unknown outcome must
   * not become a write.
   */
  withExclusive(
    code: string,
    body: (entry: EpisodeEntry) => Promise<WriteOutcome<T>>
  ): Promise<WriteOutcome<T>>;
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

/**
 * #212 step E — two statuses are the same when every field is.
 *
 * This used to be a hand-written comparison per kind, and it had to be TAUGHT
 * about each field a status carried: it compared `kind` alone, so two
 * `diverged` states with different codes counted as equal and the standing mark
 * went on saying the other version had been preserved while the notice said
 * nothing could be written (the tenth review pass). The lesson is not "add
 * `code` to the comparison" — it is that a comparison which must be taught will
 * eventually not be. Structural equality has nothing left to forget, including
 * about fields a future status has not grown yet.
 *
 * `SaveStatus` is a small flat record of primitives, so this is exact rather
 * than an approximation of deep equality.
 */
function sameStatus(a: SaveStatus, b: SaveStatus): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!Object.is(left[key], right[key])) return false;
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
   * #212 — what still has to reach the disk. `null` means nothing is owed.
   *
   * Step A gave this an `origin`, because a queued restore and a queued edit
   * had different rights and the writer had been remembering which was which in
   * a separate boolean. Step D removed the need: the restore is an outcome of
   * the lease, applied and written in one move, so nothing but a session edit
   * is ever left waiting here. The field went with the need — a distinction
   * with no reader is the kind of dead machinery that invites the next defect
   * into exactly this mechanism.
   */
  let queue: { value: T } | null = null;
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
   * The one place that answers "may anything be written now".
   *
   * `force` is the flush's licence, and it is deliberately not a master key: it
   * carries a write past `closed`, and never past a fence or a hold, because
   * quitting must not overwrite a version nothing has preserved.
   *
   * A fence admits nobody, including reconciliation: its own restore is applied
   * by the lease, which opens the permit in the same move. That is stricter
   * than step B's version and it is deliberate — "everything except one
   * privileged caller" is the shape that produced findings 1, 2 and 9.
   */
  function mayWrite(force: boolean): boolean {
    switch (permit.kind) {
      case "open":
        return true;
      case "fenced":
      case "held":
        return false;
      case "closed":
        return force;
    }
  }

  /**
   * #212 step D — bumped by every `push`, and by nothing else.
   *
   * It is the whole of I5: adopting the disk is legal only when the user queued
   * nothing while the decision was being made. Today that holds only because no
   * `await` separates the check from the adoption in `main.ts`; this makes it
   * hold by construction.
   */
  let epoch = 0;
  /**
   * The tail of the episode chain: every lease waits for it and replaces it, so
   * two external changes arriving together are decided one after the other
   * rather than on top of each other.
   */
  let episodes: Promise<void> = Promise.resolve();

  /**
   * Returns what was ACTUALLY applied, which is not always what the body asked
   * for: an adoption refused by the epoch guard becomes a release. The caller
   * publishes the adopted value to the store only on the strength of this
   * answer, so the two cannot disagree about whether the disk was taken.
   */
  function applyOutcome(
    outcome: WriteOutcome<T>,
    epochAtEntry: number
  ): WriteOutcome<T> {
    switch (outcome.kind) {
      case "release":
        toOpen();
        // The episode is over, so the fence's `diverged` goes with it. Leaving
        // it standing would keep `hasPending` true, and the NEXT external
        // change would read as a conflict on the strength of an episode that
        // already ended — the same defect the review found at the other end.
        // `idle` in both cases, which is what the writer publishes for any
        // value merely waiting on its debounce: `saving` would claim a write
        // that has not started.
        if (queue !== null) schedule();
        setStatus({ kind: "idle" });
        return outcome;
      case "adopted":
        if (epoch !== epochAtEntry) {
          // The user changed something while we were deciding. Their edit wins
          // the queue; the file is left alone, and the write that follows will
          // be verified like any other — a divergence there fences again, with
          // the newer state in hand.
          console.debug(
            "[Projects+] settings changed during reconciliation; the disk is not adopted"
          );
          toOpen();
          if (queue !== null) schedule();
          return { kind: "release" };
        }
        last = { value: outcome.settings };
        queue = null;
        toOpen();
        setStatus({ kind: "idle" });
        return outcome;
      case "restore":
        // The user may have edited while the decision ran. Both values come
        // from the same store, so the newer one contains the older; taking it
        // is not a preference but the only reading that cannot lose the edit.
        if (queue === null) queue = { value: outcome.settings };
        last = { value: queue.value };
        toOpen();
        startWrite();
        return outcome;
      case "hold":
        toHeld(outcome.code);
        setStatus({ kind: "diverged", code: outcome.code });
        return outcome;
      case "extend":
        // Unreachable: the lease loops on `extend` and only ever applies a
        // settled outcome. Stated rather than assumed, so the switch is total.
        toOpen();
        return { kind: "release" };
    }
  }

  /**
   * Does memory hold anything the disk has not confirmed?
   *
   * One implementation, because the lease has to ask it at a moment when the
   * public method would answer about the lease itself.
   */
  function hasPendingNow(): boolean {
    return (
      queue !== null ||
      inFlight !== null ||
      status.kind === "failed" ||
      status.kind === "diverged"
    );
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
    if (!mayWrite(force)) return;
    const { value } = queue;
    queue = null;
    // #199: paired with the failure log below. Between them, a developer can
    // tell the three cases apart that look identical from the outside — the
    // write never started, it started and failed, it started and reported
    // success while the file did not change.
    console.debug("[Projects+] settings write starting");
    setStatus({ kind: "saving" });
    inFlight = Promise.resolve()
      .then(() => attemptWrite(value))
      .then(onWritten, (err) => onFailure(err, value));
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
      if (permit.kind === "open") {
        // Unconditional, which is what `PLAN_212` T8 asked for and what I
        // implemented conditionally: the review found the gap. With nothing
        // queued the permit used to stay open, so an edit made before Obsidian
        // dispatched the change event — or while it was slow to — armed its
        // debounce and overwrote the other version before reconciliation could
        // preserve anything. The fence is about the FILE having been replaced,
        // not about what we happen to be holding.
        //
        // A debounce armed by a `push` that arrived while the write was in
        // flight is still running, and it would fire straight through the
        // fence. Fencing means fencing, so it goes.
        cancelSchedule();
        toFenced(SETTINGS_DIVERGED);
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

  function onFailure(err: unknown, value: T): void {
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
    // Nothing reached the disk, so the value is pending again. The state itself
    // is untouched: rolling it back would destroy the user's work on the
    // assumption that the disk is right, exactly where that is unknown. A value
    // queued meanwhile is newer and is left alone.
    if (queue === null) queue = { value };
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
      epoch += 1;
      last = { value };
      queue = { value };
      schedule();
    },
    pushNow(value: T): void {
      if (status.kind === "failed") attempt = 0;
      epoch += 1;
      last = { value };
      queue = { value };
      cancelSchedule();
      startWrite();
    },
    async withExclusive(
      code: string,
      body: (entry: EpisodeEntry) => Promise<WriteOutcome<T>>
    ): Promise<WriteOutcome<T>> {
      // #212, from the review: two external notifications can arrive while a
      // read or a copy is being awaited, and both would enter here. Fencing is
      // shared state, not a queue — the second episode would see the first
      // one's fence, call it "pending", and the two bodies would interleave
      // over one `pendingAdoption`. Episodes are therefore serialised: one
      // decision at a time, in arrival order.
      const previous = episodes;
      let finished!: () => void;
      episodes = new Promise<void>((resolve) => {
        finished = resolve;
      });
      await previous;
      // Taken BEFORE the fence, because the fence itself changes the answer:
      // it publishes `diverged`, and `hasPending` counts that status as unsaved
      // work. Asking mid-episode would have every decision see `pending: true`
      // and treat every external change as a conflict — adoption, the point of
      // #200, would never happen again. Found by the review of step F; nothing
      // in the unit tests could see it, because it is a composition between two
      // modules and the file that composes them has no coverage.
      const entry: EpisodeEntry = { pending: hasPendingNow() };
      // Order is the whole point, and it is fixed here rather than at four call
      // sites: fence, then wait for anything in flight, then decide.
      cancelSchedule();
      cancelRetry();
      toFenced(code);
      setStatus({ kind: "diverged", code });
      while (inFlight !== null) {
        await inFlight;
      }
      // I5 — the disk may be adopted only if nothing of the user's arrived
      // during the episode. `push` moves this; `prime` and the restore do not.
      const epochAtEntry = epoch;
      try {
        let outcome: WriteOutcome<T> = await body(entry);
        while (outcome.kind === "extend") {
          const { after, next } = outcome;
          // The fence's deadline is reset, so the wait cannot outlive it and a
          // decision that never returns still releases the queue.
          toFenced(code);
          await new Promise((resolve) => setTimeout(resolve, after));
          outcome = await next(entry);
        }
        return applyOutcome(outcome, epochAtEntry);
      } catch (err) {
        // An unknown outcome must not become a write. The fence stands, with a
        // fresh deadline, so the queue is released by time rather than by a
        // guess about what the body meant to do.
        console.error("[Projects+] settings reconciliation failed", err);
        toFenced(code);
        return { kind: "hold", code };
      } finally {
        finished();
      }
    },
    retry(): void {
      if (permit.kind === "closed") return;
      if (status.kind !== "failed" && queue === null) return;
      cancelRetry();
      attempt = 0;
      // A retry writes whatever the store holds NOW, which after a failure is
      // the value still on `last`.
      if (queue === null && last !== null) queue = { value: last.value };
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
      return hasPendingNow();
    },
  };
}
