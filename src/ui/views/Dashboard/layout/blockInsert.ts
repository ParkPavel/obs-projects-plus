// Block menus and the grid share one palette/insert path. Above/below entries
// work in tiles and mobile stacks; a read-only page provides no entry.
// Context avoids a prop chain through the widget router.

import { getContext, setContext } from "svelte";

const KEY = Symbol("ppp-block-insert");

export interface BlockInsert {
  /** Whether the editable page allows insertion, in tiles or a phone's stack. */
  available(): boolean;
  /** Open the palette for a block placed after `id`, anchored to `anchor`. */
  after(id: string, anchor: HTMLElement | null): void;
  /** Open the same palette immediately before a block. */
  before?(id: string, anchor: HTMLElement | null): void;
}

/** The list position a block inserted after `id` takes; the end for an unknown id. */
export function insertIndexAfter(ids: readonly string[], id: string): number {
  const at = ids.indexOf(id);
  return at < 0 ? ids.length : at + 1;
}

export function insertIndexBefore(ids: readonly string[], id: string): number {
  const at = ids.indexOf(id);
  return at < 0 ? ids.length : at;
}

export function provideBlockInsert(insert: BlockInsert): void {
  setContext(KEY, insert);
}

/** Undefined outside a dashboard grid (a widget rendered on its own, a test). */
export function useBlockInsert(): BlockInsert | undefined {
  return getContext<BlockInsert | undefined>(KEY);
}
