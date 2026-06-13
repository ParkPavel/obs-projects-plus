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

export interface ConfigEcho<T> {
  /** The effective config the canvas should render and read from. */
  readonly current: T;
  /** Optimistic local commit: adopt immediately, mark a write in flight. */
  commit(cfg: T): void;
  /** A `config` prop arrived from the parent/store. Decide echo vs external. */
  receiveProp(cfg: T): void;
  /**
   * Post-commit settle (run on a microtask after commit). If a write is still
   * pending and an unrecognized prop was seen, force-adopt it and clear pending
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
  let pendingWrites = 0;
  let sawUnrecognized = false;
  let lastUnrecognized: T = initial;

  return {
    get current(): T {
      return current;
    },

    commit(cfg: T): void {
      current = cfg;
      pendingWrites += 1;
      sawUnrecognized = false;
    },

    receiveProp(cfg: T): void {
      if (pendingWrites > 0) {
        if (structurallyEqual(cfg, current)) {
          // Clean echo of our own optimistic value — recognized, clear one write.
          pendingWrites = 0;
          sawUnrecognized = false;
          return;
        }
        // Differs while a write is in flight: optimistic value wins for now.
        // Remember it in case reconciliation must force-adopt (external change).
        sawUnrecognized = true;
        lastUnrecognized = cfg;
        return;
      }
      // Nothing pending: authoritative external change — adopt it.
      current = cfg;
    },

    reconcile(): void {
      if (pendingWrites === 0) return;
      if (sawUnrecognized) {
        current = lastUnrecognized;
      }
      pendingWrites = 0;
      sawUnrecognized = false;
    },
  };
}
