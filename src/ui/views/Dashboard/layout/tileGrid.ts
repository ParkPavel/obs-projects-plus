// tileGrid.ts — i3-dash: the dashboard's tile grid as pure arithmetic.
//
// i3-dash: why a logical grid of 12. Every block already stores `layout.w` in
// twelfths (the widget registry's defaults are 12 / 6 / 4 wide), so the stored
// numbers keep their meaning and no migration is needed. What the screen shows
// is a grid of N columns chosen from the CONTAINER's width (not the device), and
// a block spans `w` twelfths of it, snapped to whole columns. Heights are whole
// rows of a fixed row size, stored as `layout.h` unchanged.
//
// i3-dash: why positions are packed, not free. A block's place follows its
// order in the list, exactly as the stack does, so the grip reorder, the jump
// bar, keyboard order and the stored order all agree. `x`/`y` are written back
// on every layout save from the same packing at 12 columns, so the config says
// where a block is without a second source of truth.

import type { WidgetDefinition } from "../types";

/** The stored unit: `layout.w` is in twelfths of the row. */
export const LOGICAL_COLUMNS = 12;
/** Column counts the screen may use; divisors of 12, so stored widths map exactly. */
export const COLUMN_STEPS: readonly number[] = [12, 6, 4, 3, 2];
/** Narrowest column, in em of the canvas font. */
export const MIN_COLUMN_EM = 5;
/** Below this canvas width (em) the page is a stack, not tiles. */
export const STACK_BELOW_EM = 40;
/** A container may shrink this much (em) before it leaves a mode it is in — a scrollbar appearing must not flip the layout back and forth. */
export const HYSTERESIS_EM = 1.5;
/** One grid row, in em of the canvas font. */
export const ROW_EM = 4;
/** The gap between tiles, in em of the canvas font. */
export const GAP_EM = 0.5;
/** Rows a block gets when its stored height is unusable. */
export const DEFAULT_ROWS = 4;
/** Tallest block, in rows. */
export const MAX_ROWS = 24;

export interface TileSpan { readonly cols: number; readonly rows: number }
export interface TilePlacement extends TileSpan { readonly x: number; readonly y: number }
/** Distance the pointer travels for one more column / row, gap included. */
export interface TileSteps { readonly col: number; readonly row: number }

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const usable = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Columns for a canvas `widthEm` wide; 0 means "stack". `previous` is the
 * count shown now: it is kept while the canvas is within `HYSTERESIS_EM` of
 * still fitting it.
 */
export function columnsFor(widthEm: number, previous = 0): number {
  const pick = (w: number): number => {
    if (!(w >= STACK_BELOW_EM)) return 0;
    return COLUMN_STEPS.find((c) => c * MIN_COLUMN_EM + (c - 1) * GAP_EM <= w) ?? 0;
  };
  const fresh = pick(widthEm);
  if (previous > fresh && pick(widthEm + HYSTERESIS_EM) >= previous) return previous;
  return fresh;
}

/** Stored width (twelfths) → whole columns of an N-column grid. */
export function spanFor(w: unknown, columns: number): number {
  const twelfths = usable(w) ? w : LOGICAL_COLUMNS;
  return clamp(Math.round((twelfths * columns) / LOGICAL_COLUMNS), 1, columns);
}

/** Columns of an N-column grid → stored width (twelfths). */
export function logicalWidth(cols: number, columns: number): number {
  return clamp(Math.round((cols * LOGICAL_COLUMNS) / columns), 1, LOGICAL_COLUMNS);
}

/** Stored height → rows. */
export function rowsFor(h: unknown): number {
  return usable(h) ? clamp(Math.round(h), 1, MAX_ROWS) : DEFAULT_ROWS;
}

/**
 * Places tiles in list order, left to right, top to bottom — the CSS grid
 * "sparse" auto-placement, so a later block never jumps above an earlier one
 * to fill a hole. Returned in input order, so duplicate ids (a drag shadow)
 * cannot collide.
 */
export function packTiles(tiles: readonly TileSpan[], columns: number): TilePlacement[] {
  const cols = Math.max(1, columns);
  const taken: boolean[][] = [];
  const free = (x: number, y: number, w: number, h: number): boolean => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (taken[r]?.[c]) return false;
    return true;
  };
  let cx = 0;
  let cy = 0;
  return tiles.map((tile) => {
    const w = clamp(Math.round(tile.cols) || 1, 1, cols);
    const h = Math.max(1, Math.round(tile.rows) || 1);
    let x = cx;
    let y = cy;
    for (;;) {
      if (x + w > cols) { x = 0; y += 1; continue; }
      if (free(x, y, w, h)) break;
      x += 1;
    }
    for (let r = y; r < y + h; r++) {
      const row = taken[r] ?? [];
      taken[r] = row;
      for (let c = x; c < x + w; c++) row[c] = true;
    }
    cx = x + w;
    cy = y;
    return { x, y, cols: w, rows: h };
  });
}

/**
 * The grid lines of a placement (1-based), as two property values. Separate
 * values, not one style string: the drag library writes its own inline styles
 * on the same element, and replacing the whole attribute would erase them.
 */
export function tileArea(p: TilePlacement): { column: string; row: string } {
  return { column: `${p.x + 1} / span ${p.cols}`, row: `${p.y + 1} / span ${p.rows}` };
}

/** Pointer travel per column / row, for a canvas `widthPx` wide whose font is `fontPx`. */
export function tileSteps(widthPx: number, fontPx: number, columns: number): TileSteps {
  const gap = GAP_EM * fontPx;
  const colWidth = (widthPx - (Math.max(1, columns) - 1) * gap) / Math.max(1, columns);
  return { col: Math.max(1, colWidth + gap), row: ROW_EM * fontPx + gap };
}

/** The span a resize handle dragged by (dx, dy) from `start` snaps to. */
export function snapResize(start: TileSpan, dx: number, dy: number, steps: TileSteps, columns: number): TileSpan {
  return {
    cols: clamp(Math.round(start.cols + dx / steps.col), 1, Math.max(1, columns)),
    rows: clamp(Math.round(start.rows + dy / steps.row), 1, MAX_ROWS),
  };
}

/** One cell per arrow key; null for any other key. */
export function nudgeSpan(span: TileSpan, key: string, columns: number): TileSpan | null {
  const by: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  const d = by[key];
  if (!d) return null;
  return { cols: clamp(span.cols + d[0], 1, Math.max(1, columns)), rows: clamp(span.rows + d[1], 1, MAX_ROWS) };
}

/**
 * The widgets with `layout.x`/`layout.y` set from the packing at 12 columns.
 * A widget whose position already matches is returned as the same object.
 */
export function withPackedLayout(widgets: readonly WidgetDefinition[]): WidgetDefinition[] {
  const placed = packTiles(
    widgets.map((w) => ({ cols: spanFor(w.layout?.w, LOGICAL_COLUMNS), rows: rowsFor(w.layout?.h) })),
    LOGICAL_COLUMNS,
  );
  return widgets.map((w, i) => {
    const p = placed[i];
    if (!p || (w.layout?.x === p.x && w.layout?.y === p.y)) return w;
    return { ...w, layout: { ...w.layout, x: p.x, y: p.y } };
  });
}

/** `widgets` with one block resized to `span` on an N-column grid, positions repacked. */
export function withResized(widgets: readonly WidgetDefinition[], id: string, span: TileSpan, columns: number): WidgetDefinition[] {
  return withPackedLayout(widgets.map((w) =>
    w.id === id ? { ...w, layout: { ...w.layout, w: logicalWidth(span.cols, columns), h: clamp(span.rows, 1, MAX_ROWS) } } : w,
  ));
}
