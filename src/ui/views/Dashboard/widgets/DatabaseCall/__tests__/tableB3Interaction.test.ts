/**
 * 3.7.2 B3 — touch editing, locked-cell reasons, and the table's scroll work.
 *
 * RED on 4e117313: a non-editable cell said nothing (no lock, no reason, not
 * focusable); a touch "click" after a drag opened the editor; there was no
 * keyboard lift or edge tracking; and every scroll frame re-ran every visible
 * cell's display and read the computed style of every clipping ancestor.
 */
import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataValue = import("src/lib/dataframe/dataframe").DataValue;
type Optional<T> = import("src/lib/dataframe/dataframe").Optional<T>;

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? "",
    }),
  };
});

const canon = jest.requireActual("../tableCanon");
const mockCellDisplay = jest.fn(canon.cellDisplay);
jest.mock("../tableCanon", () => ({ ...jest.requireActual("../tableCanon"), cellDisplay: (...a: unknown[]) => mockCellDisplay(...a) }));

const EditableCell = require("../EditableCell.svelte").default;
const DataTableContent = require("../DataTableContent.svelte").default;
const { cellAccess } = require("../tableCellAccess");
const { createTapTracker, keyboardLift, scrollEdges } = require("../tableTouch");

function makeField(type: string, extra: Partial<DataField> & { typeConfig?: Record<string, unknown> } = {}): DataField {
  return { name: "f", type, repeated: false, identifier: false, derived: false, typeConfig: {}, ...extra } as unknown as DataField;
}

function mountCell(field: DataField, value: Optional<DataValue>, readonly = false) {
  const view = render(EditableCell, {
    props: { field, value, readonly, editing: false, api: {} as never, frame: { fields: [field], records: [] } },
  });
  const starts: number[] = [];
  view.component.$on("startEdit", () => starts.push(1));
  return { ...view, starts, cell: view.container.querySelector<HTMLElement>(".ppp-t2-cell") as HTMLElement };
}

function pointer(el: HTMLElement, type: string, x: number, y: number, pointerType = "touch") {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  el.dispatchEvent(e);
}

describe("touch: a still tap edits, a drag scrolls (B3)", () => {
  it("opens the editor on a tap that moved less than 0.5rem", async () => {
    const { cell, starts } = mountCell(makeField(DataFieldType.String), "x");
    pointer(cell, "pointerdown", 100, 100);
    pointer(cell, "pointermove", 104, 103);
    pointer(cell, "pointerup", 104, 103);
    cell.click(); // the compatibility click a browser sends after the tap
    await tick();
    expect(starts).toHaveLength(1);
  });

  it("a drag beyond the slop is a scroll — no editor, even if a click follows", async () => {
    const { cell, starts } = mountCell(makeField(DataFieldType.String), "x");
    pointer(cell, "pointerdown", 100, 100);
    pointer(cell, "pointermove", 100, 140);
    pointer(cell, "pointerup", 100, 140);
    cell.click();
    await tick();
    expect(starts).toHaveLength(0);
  });

  it("a mouse click still edits as before", async () => {
    const { cell, starts } = mountCell(makeField(DataFieldType.String), "x");
    pointer(cell, "pointerdown", 1, 1, "mouse");
    pointer(cell, "pointerup", 1, 1, "mouse");
    cell.click();
    expect(starts).toHaveLength(1);
  });

  it("tracker thresholds: 8 px is a tap, 9 px is not; cancel is never a tap", () => {
    const t = createTapTracker(8);
    t.down({ pointerType: "touch", clientX: 0, clientY: 0 });
    expect(t.up({ pointerType: "touch", clientX: 8, clientY: 0 })).toBe(true);
    t.down({ pointerType: "touch", clientX: 0, clientY: 0 });
    expect(t.up({ pointerType: "touch", clientX: 9, clientY: 0 })).toBe(false);
    t.down({ pointerType: "touch", clientX: 0, clientY: 0 });
    t.cancel();
    expect(t.up({ pointerType: "touch", clientX: 0, clientY: 0 })).toBe(false);
  });
});

describe("keyboard lift (B3)", () => {
  it("scrolls by how far the cell is under the visual viewport, never past its top", () => {
    // Window 800 high, keyboard leaves 400 visible; a cell at 600–636 needs 236 + 8 margin.
    expect(keyboardLift({ top: 600, bottom: 636 }, { offsetTop: 0, height: 400 }, 8)).toBe(244);
    expect(keyboardLift({ top: 100, bottom: 136 }, { offsetTop: 0, height: 400 }, 8)).toBe(0);
    expect(keyboardLift({ top: 600, bottom: 636 }, null)).toBe(0);
    // A cell taller than the room keeps its top in view.
    expect(keyboardLift({ top: 50, bottom: 900 }, { offsetTop: 0, height: 400 }, 0)).toBe(50);
  });
});

describe("locked cells say why (B3)", () => {
  const cases: Array<[string, DataField, Optional<DataValue>, boolean, string]> = [
    ["formula", makeField(DataFieldType.Formula), 3, false, "Formula — computed"],
    ["rollup", makeField(DataFieldType.Rollup, { typeConfig: { rollup: { relationField: "Клиенты", targetField: "x", function: "count" } } }), 3, false, "Rollup from «Клиенты» — computed"],
    ["read-only source", makeField(DataFieldType.String), "a", true, "This source is read only"],
    ["number list", makeField(DataFieldType.Number), [1, 2] as unknown as DataValue, false, "A list of values is not edited here yet — open the note"],
    ["derived", makeField(DataFieldType.String, { derived: true }), "a", false, "Computed field — read only"],
  ];

  it.each(cases)("%s: reason from cellAccess", (_n, field, value, readonly, text) => {
    const access = cellAccess(field, value, readonly);
    expect(access.editable).toBe(false);
    expect(access.reason.defaultValue).toBe(text);
  });

  it.each(cases)("%s: focusable, and a tap shows a lock with the reason", async (_n, field, value, readonly, text) => {
    const { cell, container, starts } = mountCell(field, value, readonly);
    expect(cell).toHaveAttribute("tabindex", "0");
    expect(cell).toHaveAttribute("aria-readonly", "true");
    expect(cell).toHaveAttribute("title", text);
    pointer(cell, "pointerdown", 10, 10);
    pointer(cell, "pointerup", 10, 10);
    await tick();
    expect(container.querySelector(".ppp-t2-lock")).not.toBeNull();
    expect(container.querySelector(".ppp-t2-reason")).toHaveTextContent(text);
    expect(starts).toHaveLength(0);
    cell.dispatchEvent(new FocusEvent("blur"));
    await tick();
    expect(container.querySelector(".ppp-t2-reason")).toBeNull();
  });

  it("an editable cell has no reason", () => {
    expect(cellAccess(makeField(DataFieldType.String), "a", false)).toEqual({ editable: true });
    expect(cellAccess(makeField(DataFieldType.List), ["a"], false)).toEqual({ editable: true });
  });
});

describe("scroll direction cues (B3)", () => {
  it("reports the edges that hide content", () => {
    const base = { scrollWidth: 3000, clientWidth: 400, scrollHeight: 9000, clientHeight: 600 };
    expect(scrollEdges({ ...base, scrollLeft: 0, scrollTop: 0 })).toEqual({ left: false, right: true, top: false, bottom: true });
    expect(scrollEdges({ ...base, scrollLeft: 2600, scrollTop: 8400 })).toEqual({ left: true, right: false, top: true, bottom: false });
  });
});

/**
 * Before/after, measured: 5000 rows × 30 columns, the TABLE scroller is the
 * owner (600 px window), scrolled by 1 px and then by 20 rows.
 *
 * | per scroll frame               | 4e117313 | B3 |
 * |--------------------------------|----------|----|
 * | DOM rows                       | 41       | 41 |
 * | getComputedStyle (ancestors)   | ≥ 2      | 0  |
 * | cellDisplay calls, 1 px scroll | 41 × 29  | 0  |
 * | scroll listeners on scroller   | 1        | 2 (window + edges, both passive, rAF) |
 */
describe("work per scroll frame, 5000 × 30 (B3)", () => {
  const ROWS = 5000;
  const COLS = 30;
  const fields = Array.from({ length: COLS }, (_, i) => ({
    name: i === 0 ? "name" : `c${i}`, type: DataFieldType.String, repeated: false, identifier: i === 0, derived: false, typeConfig: {},
  }));
  const frame = {
    fields,
    records: Array.from({ length: ROWS }, (_, r) => ({
      id: `r${r}.md`, values: Object.fromEntries(fields.map((f, i) => [f.name, `v${r}-${i}`])),
    })),
  };
  let frames: Array<() => void> = [];

  beforeEach(() => {
    frames = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { frames.push(() => cb(0)); return frames.length; });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  function box(top: number, height: number): DOMRect {
    return { top, bottom: top + height, left: 0, right: 400, width: 400, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  }

  async function scrollTo(body: HTMLElement, top: number) {
    body.scrollTop = top;
    body.dispatchEvent(new Event("scroll"));
    const queued = frames;
    frames = [];
    queued.forEach((run) => run());
    await tick();
  }

  it("renders a bounded window, and a scroll inside the window costs no style reads and no cell work", async () => {
    const realGCS = window.getComputedStyle.bind(window);
    let gcs = 0;
    jest.spyOn(window, "getComputedStyle").mockImplementation((el: Element, p?: string | null) => {
      gcs++;
      return realGCS(el, p);
    });
    const { container } = render(DataTableContent, {
      props: { frame, api: {} as never, readonly: true, getRecordColor: () => null, fields, config: undefined },
    });
    const body = container.querySelector<HTMLElement>(".ppp-t2-scroll") as HTMLElement;
    body.getBoundingClientRect = () => box(0, 600);
    Object.defineProperty(body, "scrollHeight", { value: ROWS * 36, configurable: true });
    await scrollTo(body, 36 * 1000);
    const rows = container.querySelectorAll(".ppp-t2-row").length;
    expect(rows).toBeLessThanOrEqual(Math.ceil(600 / 36) + 2 * 12 + 1);
    expect(container.querySelector(".ppp-t2-row")?.textContent).toContain(`v${1000 - 12}-1`);

    gcs = 0;
    mockCellDisplay.mockClear();
    await scrollTo(body, 36 * 1000 + 1);
    expect(gcs).toBe(0);
    expect(mockCellDisplay).not.toHaveBeenCalled();

    // A scroll past the window does move it, and only the shifted rows render anew.
    await scrollTo(body, 36 * 1020);
    expect(container.querySelector(".ppp-t2-row")?.textContent).toContain(`v${1020 - 12}-1`);
  });

  it("the scroller is the one owner: overscroll contained, edge cues on its frame", async () => {
    const { container } = render(DataTableContent, {
      props: { frame, api: {} as never, readonly: true, getRecordColor: () => null, fields, config: undefined },
    });
    const body = container.querySelector<HTMLElement>(".ppp-t2-scroll") as HTMLElement;
    const frameEl = body.parentElement as HTMLElement;
    expect(frameEl).toHaveClass("ppp-t2-frame");
    Object.defineProperty(body, "scrollWidth", { value: 3000, configurable: true });
    Object.defineProperty(body, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(body, "scrollHeight", { value: ROWS * 36, configurable: true });
    Object.defineProperty(body, "clientHeight", { value: 600, configurable: true });
    body.scrollLeft = 200;
    await scrollTo(body, 36 * 10);
    expect(frameEl).toHaveAttribute("data-more-left");
    expect(frameEl).toHaveAttribute("data-more-right");
    expect(frameEl).toHaveAttribute("data-more-top");
    expect(frameEl).toHaveAttribute("data-more-bottom");
    body.scrollLeft = 2600;
    await scrollTo(body, 0);
    expect(frameEl).not.toHaveAttribute("data-more-right");
    expect(frameEl).not.toHaveAttribute("data-more-top");
  });
});
