/**
 * The record currently held open in a peek (#168 step (b)).
 *
 * ## Why a store and not a prop per view
 *
 * The ADR proposed that each view mount its own peek. A dashboard hosts several
 * table widgets, so that design has to answer "what happens when two of them
 * open one at a time" with a convention. One store answers it with a type:
 * there is one peek, it holds one record, and opening a second replaces the
 * first because a store has one value.
 *
 * It also keeps `openRecord` honest. The contract already accepts a `peek`
 * callback in its deps; this is the default one, so a call site does not have
 * to be handed a function by a component it has never heard of in order to stop
 * navigating away.
 *
 * ## What it deliberately does not do
 *
 * It does not fetch, and it does not carry the record. `id` is a vault path,
 * and the peek is RESOLVED — every tick, by `resolvePeek` in
 * `src/lib/record/peekResolution.ts` — from whichever frame actually owns it:
 * this view's own `sortedFrame` for an own record, or `api.resolveExternalFrame`
 * for one named by `projectId`. Carrying a copy here, as the first version did,
 * meant a re-render could hand the copy back to the editor as if it were fresh
 * (#158 N1) and meant the peek could never notice the record it named had
 * disappeared. Identity plus origin is enough to look the record up again on
 * every tick; a copy is not.
 */

import { writable } from "svelte/store";

export interface PeekTarget {
  /** `record.id` — a vault path. */
  readonly id: string;
  /**
   * The project that holds the record, when it is not this view's own — a
   * dashboard table widget can read an EXTERNAL source whose records are not
   * in the host view's frame at all. Absent means "resolve in this view's own
   * frame".
   */
  readonly projectId?: string | undefined;
  /** The row this target came from is read-only, independent of the record's own project. */
  readonly readonly?: boolean | undefined;
}

/** `null` when nothing is peeked. */
export const recordPeek = writable<PeekTarget | null>(null);

export function openPeek(target: PeekTarget): void {
  recordPeek.set(target);
}

export function closePeek(): void {
  recordPeek.set(null);
}
