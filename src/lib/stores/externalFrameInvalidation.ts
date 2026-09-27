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

/**
 * What decides whether cached sibling frames are still right: each project's
 * id, name, source and field configuration. Rollups are folded into those
 * frames (externalFrameResolver), so a changed rollup — sum to avg — must
 * refresh every reader, not only a renamed project (Codex review of 316d058).
 */
export function projectsCacheKey(
  projects: ReadonlyArray<{ id: string; name: string; dataSource?: unknown; fieldConfig?: unknown }>
): string {
  return projects
    .map((p) => `${p.id}|${p.name}|${JSON.stringify(p.dataSource ?? null)}|${JSON.stringify(p.fieldConfig ?? null)}`)
    .join("\u0001");
}
