/**
 * i3-dash — the tile grid's arithmetic (layout/tileGrid.ts, layout/tileResize.ts).
 *
 * The desktop dashboard is a grid whose column count follows the container,
 * whose blocks keep their stored twelfths, snap to cells when resized and are
 * placed in list order. Everything the drawing and the pointer agree on is here.
 */

import type { WidgetDefinition } from "../types";
import {
  columnsFor, GAP_EM, HYSTERESIS_EM, LOGICAL_COLUMNS, logicalWidth, MAX_ROWS, MIN_COLUMN_EM, nudgeSpan, packTiles,
  ROW_EM, rowsFor, snapResize, spanFor, STACK_BELOW_EM, tileArea, tileSteps, withPackedLayout, withResized,
} from "../layout/tileGrid";
import { startTileResize } from "../layout/tileResize";

const widget = (id: string, w: number, h: number, x = 0, y = 0): WidgetDefinition =>
  ({ id, type: "stats", title: id, layout: { x, y, w, h }, config: {} });

describe("columnsFor — tiles or stack, from the container", () => {
  it("is a stack below the threshold and on an unmeasured canvas", () => {
    expect(columnsFor(0)).toBe(0);
    expect(columnsFor(Number.NaN)).toBe(0);
    expect(columnsFor(STACK_BELOW_EM - 0.1)).toBe(0);
  });

  it("uses the widest column count whose columns stay at least MIN_COLUMN_EM wide", () => {
    expect(columnsFor(STACK_BELOW_EM)).toBe(6);
    const twelve = 12 * MIN_COLUMN_EM + 11 * GAP_EM;
    expect(columnsFor(twelve - 0.1)).toBe(6);
    expect(columnsFor(twelve)).toBe(12);
    expect(columnsFor(200)).toBe(12);
  });

  it("keeps the current count while the container is within the hysteresis, then lets go", () => {
    const twelve = 12 * MIN_COLUMN_EM + 11 * GAP_EM;
    // A scrollbar appearing takes about one em; the layout must not flip on it.
    expect(columnsFor(twelve - 1, 12)).toBe(12);
    expect(columnsFor(twelve - HYSTERESIS_EM - 0.1, 12)).toBe(6);
    expect(columnsFor(STACK_BELOW_EM - 1, 6)).toBe(6);
    expect(columnsFor(STACK_BELOW_EM - HYSTERESIS_EM - 0.1, 6)).toBe(0);
    // Growing is never held back.
    expect(columnsFor(twelve, 6)).toBe(12);
  });
});

describe("stored twelfths ↔ columns", () => {
  it("maps the registry's widths onto 12 and 6 columns exactly", () => {
    expect([12, 6, 4].map((w) => spanFor(w, 12))).toEqual([12, 6, 4]);
    expect([12, 6, 4].map((w) => spanFor(w, 6))).toEqual([6, 3, 2]);
  });

  it("clamps to the grid and treats an unusable width as full", () => {
    expect(spanFor(30, 6)).toBe(6);
    expect(spanFor(1, 6)).toBe(1);
    expect(spanFor(undefined, 6)).toBe(6);
    expect(spanFor(-2, 6)).toBe(6);
  });

  it("converts columns back to twelfths, round-tripping on a divisor grid", () => {
    for (const w of [2, 4, 6, 8, 10, 12]) expect(logicalWidth(spanFor(w, 6), 6)).toBe(w);
    expect(logicalWidth(1, 12)).toBe(1);
    expect(logicalWidth(99, 6)).toBe(LOGICAL_COLUMNS);
  });

  it("reads rows from the stored height, clamped, with a default", () => {
    expect(rowsFor(6)).toBe(6);
    expect(rowsFor(0)).toBe(4);
    expect(rowsFor("x")).toBe(4);
    expect(rowsFor(1000)).toBe(MAX_ROWS);
  });
});

describe("packTiles — places follow list order", () => {
  it("fills a row left to right and wraps", () => {
    const p = packTiles([{ cols: 6, rows: 2 }, { cols: 6, rows: 2 }, { cols: 12, rows: 1 }], 12);
    expect(p.map(({ x, y }) => [x, y])).toEqual([[0, 0], [6, 0], [0, 2]]);
  });

  it("puts a short tile beside a tall one and never moves a later tile above an earlier one", () => {
    const p = packTiles([{ cols: 8, rows: 4 }, { cols: 4, rows: 1 }, { cols: 4, rows: 1 }, { cols: 12, rows: 1 }], 12);
    expect(p.map(({ x, y }) => [x, y])).toEqual([[0, 0], [8, 0], [8, 1], [0, 4]]);
    // Sparse, not dense: the hole beside the first tile stays rather than pulling the third tile up into it.
    const q = packTiles([{ cols: 8, rows: 3 }, { cols: 6, rows: 1 }, { cols: 4, rows: 1 }], 12);
    expect(q.map(({ x, y }) => [x, y])).toEqual([[0, 0], [0, 3], [6, 3]]);
  });

  it("clamps a tile wider than the grid and keeps input order for duplicate ids", () => {
    const p = packTiles([{ cols: 12, rows: 1 }, { cols: 12, rows: 1 }], 6);
    expect(p).toEqual([{ x: 0, y: 0, cols: 6, rows: 1 }, { x: 0, y: 1, cols: 6, rows: 1 }]);
  });

  it("writes 1-based grid lines", () => {
    expect(tileArea({ x: 2, y: 3, cols: 4, rows: 5 })).toEqual({ column: "3 / span 4", row: "4 / span 5" });
  });
});

describe("resize snapping", () => {
  const steps = tileSteps(1000, 16, 6);

  it("measures one column and one row including the gap", () => {
    const gap = GAP_EM * 16;
    expect(steps.col).toBeCloseTo((1000 - 5 * gap) / 6 + gap);
    expect(steps.row).toBe(ROW_EM * 16 + gap);
  });

  it("snaps to the nearest whole cell and stays inside the grid", () => {
    const start = { cols: 2, rows: 3 };
    expect(snapResize(start, steps.col * 0.4, steps.row * 0.4, steps, 6)).toEqual(start);
    expect(snapResize(start, steps.col * 0.6, steps.row * 1.6, steps, 6)).toEqual({ cols: 3, rows: 5 });
    expect(snapResize(start, steps.col * 10, -steps.row * 10, steps, 6)).toEqual({ cols: 6, rows: 1 });
    expect(snapResize(start, -steps.col * 10, steps.row * 100, steps, 6)).toEqual({ cols: 1, rows: MAX_ROWS });
  });

  it("moves one cell per arrow key and ignores other keys", () => {
    expect(nudgeSpan({ cols: 2, rows: 2 }, "ArrowRight", 6)).toEqual({ cols: 3, rows: 2 });
    expect(nudgeSpan({ cols: 1, rows: 1 }, "ArrowLeft", 6)).toEqual({ cols: 1, rows: 1 });
    expect(nudgeSpan({ cols: 6, rows: 2 }, "ArrowRight", 6)).toEqual({ cols: 6, rows: 2 });
    expect(nudgeSpan({ cols: 2, rows: 2 }, "ArrowUp", 6)).toEqual({ cols: 2, rows: 1 });
    expect(nudgeSpan({ cols: 2, rows: 2 }, "Enter", 6)).toBeNull();
  });

  it("a pointer drag previews snapped spans and ends with the last one; a cancel ends with none", () => {
    const onPreview = jest.fn();
    const onEnd = jest.fn();
    const from = { cols: 2, rows: 2 };
    startTileResize({ win: window, startX: 100, startY: 100, from, steps, columns: 6, onPreview, onEnd });
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100 + steps.col, clientY: 100 + 2 * steps.row }));
    expect(onPreview).toHaveBeenLastCalledWith({ cols: 3, rows: 4 });
    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(onEnd).toHaveBeenCalledWith({ cols: 3, rows: 4 });
    // Listeners are gone: a later move changes nothing.
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 900, clientY: 900 }));
    expect(onPreview).toHaveBeenCalledTimes(1);

    const onEnd2 = jest.fn();
    const cancel = startTileResize({ win: window, startX: 0, startY: 0, from, steps, columns: 6, onPreview: jest.fn(), onEnd: onEnd2 });
    cancel();
    cancel();
    expect(onEnd2).toHaveBeenCalledTimes(1);
    expect(onEnd2).toHaveBeenCalledWith(null);
  });
});

describe("stored positions", () => {
  it("withPackedLayout writes x/y from the 12-column packing and keeps untouched blocks identical", () => {
    const a = widget("a", 6, 2, 0, 0);
    const b = widget("b", 6, 2, 0, 9);
    const c = widget("c", 12, 1, 0, 2);
    const out = withPackedLayout([a, b, c]);
    expect(out[0]).toBe(a);
    expect(out[1]?.layout).toEqual({ x: 6, y: 0, w: 6, h: 2 });
    expect(out[2]).toBe(c);
  });

  it("withResized stores the new width in twelfths and the rows as h, then repacks", () => {
    const out = withResized([widget("a", 12, 4), widget("b", 6, 2, 0, 4)], "a", { cols: 3, rows: 5 }, 6);
    expect(out[0]?.layout).toEqual({ x: 0, y: 0, w: 6, h: 5 });
    expect(out[1]?.layout).toEqual({ x: 6, y: 0, w: 6, h: 2 });
  });
});
