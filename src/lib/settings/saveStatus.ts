import { writable, type Unsubscriber } from "svelte/store";

import type { SaveStatus } from "src/lib/settings/settingsWriter";

export type { SaveStatus };

/**
 * #185 — how a failed write reaches the screen.
 *
 * The writer coalesces, so a per-call promise from `settings.*` would describe
 * an operation that does not exist. The status travels out of band instead, in
 * the idiom the tree already uses for cross-cutting state (`commandBus`, `ui`):
 * `main.ts` feeds this store, components read it.
 */
export const saveStatus = writable<SaveStatus>({ kind: "idle" });

let retryHandler: (() => void) | null = null;

/**
 * The writer is built in `onload` around the plugin's own `saveData`, so it
 * cannot be imported by a component. `main.ts` publishes the retry here.
 */
export function setSaveRetryHandler(handler: (() => void) | null): void {
  retryHandler = handler;
}

export function requestSaveRetry(): void {
  retryHandler?.();
}

/**
 * Call `notify` once per failure EPISODE — on the transition into `failed`,
 * never per attempt.
 *
 * The silent retries inside an episode never leave `saving`, so they cannot
 * reach here. A failure after the user has asked for a retry is a new episode
 * and does notify: they acted, and an answer is owed.
 */
export function onSaveFailureEpisode(
  notify: (status: Extract<SaveStatus, { kind: "failed" }>) => void
): Unsubscriber {
  let previousKind: SaveStatus["kind"] | null = null;
  return saveStatus.subscribe((status) => {
    const wasFailed = previousKind === "failed";
    previousKind = status.kind;
    if (status.kind !== "failed" || wasFailed) return;
    notify(status);
  });
}
