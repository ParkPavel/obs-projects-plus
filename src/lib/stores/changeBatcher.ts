/**
 * i2-perf (C2/C3, A4 H1): every changed note ran its own `dataFrame.merge`,
 * and each merge recomputed the whole view — relations, rollups, formulas,
 * filter, sort, every dashboard block. A bulk write of 193 notes was 193 full
 * recomputes (on the phone: the freeze, then the crash). Changes arriving
 * close together are now collected and handed over once.
 */
export function createChangeBatcher<T>(
  flush: (items: T[]) => void | Promise<void>,
  delayMs = 50,
  schedule: (fn: () => void, ms: number) => unknown = (fn, ms) => window.setTimeout(fn, ms)
): { push(key: string, item: T): void } {
  let pending = new Map<string, T>();
  let armed = false;
  return {
    push(key, item) {
      pending.set(key, item); // the latest event for a path wins
      if (armed) return;
      armed = true;
      schedule(() => {
        armed = false;
        const items = [...pending.values()];
        pending = new Map();
        void flush(items);
      }, delayMs);
    },
  };
}
