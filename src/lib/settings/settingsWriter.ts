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
 * NOW — `startWrite` reads `latest` at call time — so a retry can never
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
 * #200 — what the file said after a write claimed to succeed.
 *
 * `confirmed` — the file holds what was written.
 * `not-written` — it does not, and nothing else explains that: retry.
 * `diverged` — it holds something neither we nor the previous state produced,
 *   so another writer got there. Not ours to retry.
 */
export type WriteVerdict = "confirmed" | "not-written" | "diverged";

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
  /** Write anything pending and wait for the in-flight write to settle. */
  flush(): Promise<void>;
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

  // Boxed so that `undefined` is a legal settings value and "nothing yet" is
  // still distinguishable from it.
  let latest: { value: T } | null = null;
  let dirty = false;
  let inFlight: Promise<void> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let ceilingTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let status: SaveStatus = { kind: "idle" };
  /** Set by `attemptWrite` when the file was replaced by somebody else. */
  let diverged = false;
  let disposed = false;
  let flushing = false;

  function setStatus(next: SaveStatus): void {
    // A write that settles after `dispose` has no audience: `onunload` has
    // already reset the status store and dropped the retry handler. Publishing
    // a late failure here would raise a chip in the NEXT session, whose retry
    // reaches a writer that knows nothing about it — the lying control this
    // ticket exists to remove, arriving by a second route.
    if (disposed) return;
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

  function cancelRetry(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function schedule(): void {
    if (disposed) return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onDue, debounceMs);
    if (ceilingTimer === null) ceilingTimer = setTimeout(onDue, maxWaitMs);
  }

  function onDue(): void {
    cancelSchedule();
    startWrite();
  }

  function startWrite(force = false): void {
    if ((disposed && !force) || inFlight !== null || !dirty || latest === null) {
      return;
    }
    const value = latest.value;
    dirty = false;
    // #199: paired with the failure log below. Between them, a developer can
    // tell the three cases apart that look identical from the outside — the
    // write never started, it started and failed, it started and reported
    // success while the file did not change.
    console.debug("[Projects+] settings write starting");
    setStatus({ kind: "saving" });
    inFlight = Promise.resolve()
      .then(() => attemptWrite(value))
      .then(onWritten, onFailure);
  }

  /**
   * #199: a resolved `save` is a claim, not a fact. The live run that produced
   * this ticket had `saveData` report success while the file on disk did not
   * change — so the claim is checked, and an unconfirmed write is a failed one.
   */
  async function attemptWrite(value: T): Promise<void> {
    await save(value);
    if (verify === undefined) return;
    const verdict = await verify(value);
    if (verdict === "confirmed") return;
    if (verdict === "diverged") {
      // #200: not an error, and deliberately not thrown. Throwing would put it
      // on the retry path, and a retry here IS the overwrite. The status says
      // what happened and the writer stands down.
      diverged = true;
      return;
    }
    throw new Error(
      "the write reported success but the settings file does not match"
    );
  }

  function onWritten(): void {
    inFlight = null;
    attempt = 0;
    if (diverged) {
      // The value stays in memory and stays dirty-free: it was written, the
      // file simply no longer reflects it. Reconciliation is #200 step 3; what
      // this step guarantees is only that nobody is told the write succeeded.
      diverged = false;
      setStatus({ kind: "diverged", code: SETTINGS_DIVERGED });
      return;
    }
    if (dirty) {
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

  function onFailure(err: unknown): void {
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
    // is untouched — rolling it back would destroy the user's work on the
    // assumption that the disk is right, exactly where that is unknown.
    dirty = true;
    attempt += 1;
    const delay = retryDelays[attempt - 1];
    if (delay !== undefined && !disposed) {
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
      latest = { value };
      dirty = false;
    },
    push(value: T): void {
      if (latest !== null && Object.is(latest.value, value)) return;
      // A change made after the budget was spent is a new episode and gets its
      // own retries. Without this, `attempt` stays past the end of the delay
      // list and every later change gets a single attempt — the writer quietly
      // stops retrying for the rest of the session.
      if (status.kind === "failed") attempt = 0;
      latest = { value };
      dirty = true;
      schedule();
    },
    pushImmediate(value: T): void {
      if (status.kind === "failed") attempt = 0;
      latest = { value };
      dirty = true;
      cancelSchedule();
      startWrite();
    },
    retry(): void {
      if (disposed) return;
      if (status.kind !== "failed" && !dirty) return;
      cancelRetry();
      attempt = 0;
      dirty = true;
      startWrite();
    },
    async flush(): Promise<void> {
      cancelSchedule();
      cancelRetry();
      flushing = true;
      try {
        startWrite(true);
        while (inFlight !== null) {
          await inFlight;
        }
      } finally {
        flushing = false;
      }
    },
    dispose(): void {
      disposed = true;
      cancelSchedule();
      cancelRetry();
    },
    status(): SaveStatus {
      return status;
    },
    hasPending(): boolean {
      return (
        dirty ||
        inFlight !== null ||
        status.kind === "failed" ||
        status.kind === "diverged"
      );
    },
  };
}
