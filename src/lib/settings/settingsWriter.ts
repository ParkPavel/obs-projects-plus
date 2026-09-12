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

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "failed"; attempts: number; message: string };

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

export interface SettingsWriterOptions<T> {
  save: (value: T) => Promise<unknown>;
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
}

function sameStatus(a: SaveStatus, b: SaveStatus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "failed" && b.kind === "failed") {
    return a.attempts === b.attempts && a.message === b.message;
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
  const { save, onStatus } = options;
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
  let disposed = false;

  function setStatus(next: SaveStatus): void {
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

  function startWrite(): void {
    if (disposed || inFlight !== null || !dirty || latest === null) return;
    const value = latest.value;
    dirty = false;
    setStatus({ kind: "saving" });
    inFlight = Promise.resolve()
      .then(() => save(value))
      .then(onWritten, onFailure);
  }

  function onWritten(): void {
    inFlight = null;
    attempt = 0;
    if (dirty) {
      // Exactly one follow-up write, carrying whatever arrived meanwhile.
      startWrite();
      return;
    }
    setStatus({ kind: "idle" });
  }

  function onFailure(err: unknown): void {
    inFlight = null;
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
    setStatus({ kind: "failed", attempts: attempt, message: messageOf(err) });
  }

  return {
    prime(value: T): void {
      latest = { value };
      dirty = false;
    },
    push(value: T): void {
      if (latest !== null && Object.is(latest.value, value)) return;
      latest = { value };
      dirty = true;
      schedule();
    },
    pushImmediate(value: T): void {
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
      startWrite();
      while (inFlight !== null) {
        await inFlight;
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
  };
}
