// w4-p10a (N15, Codex design B; CONSOLIDATION §7 row 22) — the dashboard's
// table of contents lives in the plugin's own bar.
//
// The narrow page had a sticky row of block titles (a carousel) that took a
// line of its own and scrolled sideways. It is one button now, "Blocks · N",
// in the plugin bar beside the view's tools, opening the list of the page's
// blocks. The dashboard publishes its blocks and its jump here; the bar reads
// them. Both sit under one App, which provides the store; a dashboard with no
// such App around it (a test, an embed) draws the same button itself.

import { getContext, setContext } from "svelte";
import { writable } from "svelte/store";
type Writable<T> = import("svelte/store").Writable<T>;
type JumpItem = import("./blockJump").JumpItem;

export interface BlockOutline {
  readonly items: readonly JumpItem[];
  /** Moves the page to block `id`. */
  readonly jump: (id: string) => void;
  /** The block that holds most of the visible page now, or null. */
  readonly current: () => string | null;
  /**
   * w4-p10 (N7): opens the block palette for a block placed after the selected
   * block, else after the one most on screen, anchored to `anchor`; absent on a
   * read-only page.
   */
  readonly insert?: ((anchor: HTMLElement | null) => void) | undefined;
}

export const BLOCK_OUTLINE_KEY = Symbol("ppp-block-outline");

/** For App: the store its bar reads and its dashboard writes. */
export function provideBlockOutline(): Writable<BlockOutline | null> {
  const store = writable<BlockOutline | null>(null);
  setContext(BLOCK_OUTLINE_KEY, store);
  return store;
}

/** The App's store, or undefined outside one. */
export function blockOutlineStore(): Writable<BlockOutline | null> | undefined {
  return getContext<Writable<BlockOutline | null> | undefined>(BLOCK_OUTLINE_KEY);
}

/** The block under `root` with the largest visible area in `viewport` (ties: the upper). */
export function mostVisibleBlock(root: ParentNode | null | undefined, viewport: { top: number; bottom: number }): string | null {
  let best: string | null = null;
  let bestArea = 0;
  for (const el of Array.from(root?.querySelectorAll<HTMLElement>("[data-widget-id]") ?? [])) {
    const box = el.getBoundingClientRect();
    const seen = Math.max(0, Math.min(box.bottom, viewport.bottom) - Math.max(box.top, viewport.top)) * box.width;
    if (seen > bestArea) {
      bestArea = seen;
      best = el.dataset["widgetId"] ?? null;
    }
  }
  return best;
}
