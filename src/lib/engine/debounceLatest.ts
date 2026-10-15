/**
 * Runs `fn` with the latest argument once input has been quiet for `ms`.
 * `flush` runs a pending call now (a commit must not act on a stale answer);
 * `cancel` drops it (component teardown). B5, 3.7.2.
 */
export function debounceLatest<A>(fn: (arg: A) => void, ms: number) {
  let timer: number | undefined;
  let pending: { arg: A } | null = null;
  function run(): void {
    timer = undefined;
    const next = pending;
    pending = null;
    if (next) fn(next.arg);
  }
  return {
    call(arg: A): void {
      pending = { arg };
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(run, ms);
    },
    flush(): void {
      if (timer !== undefined) window.clearTimeout(timer);
      run();
    },
    cancel(): void {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      pending = null;
    },
  };
}
