import { writable } from "svelte/store";

/**
 * Monotonic tick that advances every time sibling-project `DataFrame`s may
 * have become stale (vault `modify/create/delete/rename` events, settings
 * mutations). Canvas preloaders subscribe to this store so they can re-run
 * their `resolveExternalFrame` preload pass for the currently referenced
 * source ids, even when the set of ids hasn't changed.
 *
 * The App-level external-frame cache is cleared in lockstep with this tick.
 */
export const externalFrameInvalidation = writable<number>(0);

export function bumpExternalFrameInvalidation(): void {
  externalFrameInvalidation.update((n) => n + 1);
}
