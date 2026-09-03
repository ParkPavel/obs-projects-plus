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
 * It does not fetch. `id` is a vault path, and the surface that renders the
 * peek already holds the frame the record came from — looking it up there keeps
 * this a piece of view state rather than a second, slower data path beside
 * `DataFrame`.
 */

import { writable } from "svelte/store";

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

export interface PeekTarget {
  /** `record.id` — a vault path. */
  readonly id: string;
  /**
   * The record itself, when the caller has it.
   *
   * The first version resolved the id in the host view's frame and nothing
   * else, which the adversarial review showed was a defect rather than a
   * simplification: a dashboard table widget can read an EXTERNAL source whose
   * records are not in that frame at all, so its rows opened nothing — a click
   * with no result, which is worse than the navigation it replaced. A caller
   * that has the record hands it over; a caller that does not still resolves
   * by id.
   */
  readonly record?: DataRecord;
  /** The fields that go with `record`, for the same reason. */
  readonly fields?: DataField[];
}

/** `null` when nothing is peeked. */
export const recordPeek = writable<PeekTarget | null>(null);

export function openPeek(target: PeekTarget): void {
  recordPeek.set(target);
}

export function closePeek(): void {
  recordPeek.set(null);
}
