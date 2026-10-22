// blockInsert.ts — i3-close: «Insert block after» from a tile's own menu.
//
// i3-close: in tiles the «+» between blocks is hidden (it would sit on top of
// a tile's content), so a new block could only be added at the end of the
// page. The block menu now offers «Insert block after»: it opens the same
// block palette the stack's in-between «+» opens, at the position after this
// block, and the choice goes down the one insert path (`insert` with an
// index). In the stack the in-between «+» stays the way in, so the entry is
// offered in tiles only.
//
// The grid provides the entry through context, like «Properties»
// (blockProperties.ts), so the menu deep inside the widget router needs no
// new prop chain.

import { getContext, setContext } from "svelte";

const KEY = Symbol("ppp-block-insert");

export interface BlockInsert {
  /** Whether the menu offers the entry now (tiles shown, page editable). */
  available(): boolean;
  /** Open the palette for a block placed after `id`, anchored to `anchor`. */
  after(id: string, anchor: HTMLElement | null): void;
}

/** The list position a block inserted after `id` takes; the end for an unknown id. */
export function insertIndexAfter(ids: readonly string[], id: string): number {
  const at = ids.indexOf(id);
  return at < 0 ? ids.length : at + 1;
}

export function provideBlockInsert(insert: BlockInsert): void {
  setContext(KEY, insert);
}

/** Undefined outside a dashboard grid (a widget rendered on its own, a test). */
export function useBlockInsert(): BlockInsert | undefined {
  return getContext<BlockInsert | undefined>(KEY);
}
