// dashboardConfigEcho.ts — pure optimistic-echo + write-pending guard (#100).
//
// Why this exists (bug class #071):
//   DashboardCanvas commits a config optimistically, calls onConfigChange, and
//   the store round-trips an authoritative copy back through the `config` prop.
//   That returning copy is ALWAYS a fresh reference and may be structurally
//   normalized, so neither reference-identity nor JSON-equality can reliably
//   distinguish "echo of my own write" from "real external change". A stale
//   authoritative echo arriving after a newer local edit would otherwise clobber
//   the newer edit (lost-update race).
//
//   Discriminator of record: a MONOTONIC write-pending counter. While a write is
//   in flight the optimistic local value wins; the returning prop is treated as
//   an echo and discarded. Structural equality is a secondary signal only — used
//   to recognize a clean echo early and to detect a genuinely divergent external
//   change during reconciliation.
//
//   receiveProp is called from a Svelte reactive block that ALSO re-runs after a
//   local commit (before the prop has updated). So it must not mistake the
//   unchanged, pre-commit prop for a new external change: only a prop value that
//   actually changed since the previous observation is a reconciliation
//   candidate (tracked via lastProp).

export interface ConfigEcho<T> {
  /** The effective config the canvas should render and read from. */
  readonly current: T;
  /** Optimistic local commit: adopt immediately, mark a write in flight. */
  commit(cfg: T): void;
  /** A `config` prop arrived from the parent/store. Decide echo vs external. */
  receiveProp(cfg: T): void;
  /**
   * Post-commit settle (run on a microtask after commit). If a write is still
   * pending and a genuinely new prop was seen, force-adopt it and clear pending
   * so an external change is never lost.
   */
  reconcile(): void;
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function createConfigEcho<T>(initial: T): ConfigEcho<T> {
  let current: T = initial;
  let lastProp: T = initial;
  let pendingWrites = 0;
  let sawNewProp = false;
  let lastNewProp: T = initial;

  return {
    get current(): T {
      return current;
    },

    commit(cfg: T): void {
      current = cfg;
      pendingWrites += 1;
      sawNewProp = false;
    },

    receiveProp(cfg: T): void {
      // Did the prop actually change since we last observed it? A reactive
      // re-run triggered by our own commit replays the SAME (stale) prop — that
      // is not an external change and must be ignored entirely.
      const propChanged = !structurallyEqual(cfg, lastProp);
      lastProp = cfg;

      if (pendingWrites > 0) {
        if (!propChanged) return; // replayed stale prop — ignore
        if (structurallyEqual(cfg, current)) {
          // Clean echo of our own optimistic value — recognized, clear pending.
          pendingWrites = 0;
          sawNewProp = false;
          return;
        }
        // A genuinely new prop differing from our optimistic value arrived while
        // a write was in flight: optimistic value wins for now; remember it so
        // reconciliation can force-adopt it (external change wins eventually).
        sawNewProp = true;
        lastNewProp = cfg;
        return;
      }
      // Nothing pending: authoritative external change — adopt it.
      if (propChanged) current = cfg;
    },

    reconcile(): void {
      if (pendingWrites === 0) return;
      if (sawNewProp) {
        current = lastNewProp;
      }
      pendingWrites = 0;
      sawNewProp = false;
    },
  };
}
