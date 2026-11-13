/**
 * i3-props — the block's writes run one after another, in the order asked.
 *
 * The block used to guard its writer with a `writing` flag and return early
 * while it was set, so a pin pressed during a value write — or a second chip
 * removed before the first had landed — was silently dropped. Each write is
 * now queued behind the one in flight. A failed write is reported and does
 * not stop the ones after it.
 */

export interface WriteQueue {
  /** Resolves true only when the write reached storage; false is reported. */
  run(task: () => Promise<unknown>): Promise<boolean>;
  /** Tasks queued or running. */
  pending(): number;
}

export function createWriteQueue(
  onBusyChange?: (busy: boolean) => void,
  onFailure?: (error: unknown) => void,
): WriteQueue {
  let tail: Promise<void> = Promise.resolve();
  let count = 0;
  return {
    run(task) {
      count += 1;
      if (count === 1) onBusyChange?.(true);
      const next = tail.then(async () => {
        try {
          const applied = await task();
          if (applied === false) throw new Error("The property change was not applied to the note");
          return true;
        } catch (error) {
          console.error("[Projects+] note properties: write failed", error);
          try { onFailure?.(error); }
          catch (notificationError) { console.error("[Projects+] failed to report a write error", notificationError); }
          return false;
        } finally {
          count -= 1;
          if (count === 0) onBusyChange?.(false);
        }
      });
      // The following write must still run even if a notification throws.
      tail = next.then(() => undefined, () => undefined);
      return next;
    },
    pending: () => count,
  };
}
