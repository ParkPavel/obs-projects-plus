/**
 * w4-p08 (N6) — columns move at any zoom; the zoom holds still during a drag.
 *
 * ios-c1 forbade moving columns on a zoomed board. The requirement was
 * corrected on 26.10: moving is allowed, and what protects the drag (from a
 * drop thrown off target and from the phone's crash) is that the zoom cannot
 * change while something is being dragged. Ctrl+wheel and the pinch change it
 * otherwise, as before.
 *
 * Mocks as in dragCost.test.ts.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { DRAGGED_ELEMENT_ID } from "svelte-dnd-action";

jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
jest.mock(
  "obsidian",
  () => {
    const actual = jest.requireActual("src/__mocks__/obsidian") as Record<string, unknown>;
    class Component {
      load(): void {}
      unload(): void {}
    }
    return { ...actual, Component, Notice: jest.fn() };
  },
  { virtual: true }
);
jest.mock("src/ui/components/Flair", () => ({
  Flair: (jest.requireActual("src/ui/components/Flair/Flair.svelte") as { default: unknown }).default,
}));

type Mounted = { $destroy(): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const Board = require("../Board.svelte").default as ComponentClass;
const { zoomHeldByDrag } = require("../CardList.svelte") as {
  zoomHeldByDrag: (doc: Document | undefined, columnDrag: boolean, touchDrag: boolean) => boolean;
};

function mountBoard(zoom: number) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onZoomChange = jest.fn();
  const column = (id: string) => ({ id, records: [], collapse: false, pinned: false, persisted: false });
  const component = new Board({
    target,
    props: {
      columns: [column("A"), column("B")],
      // The view config is read-only: no "new column" form (it needs Obsidian).
      readonly: true,
      dataReadOnly: false,
      richText: false,
      onRecordClick: jest.fn(),
      onRecordCheck: jest.fn(),
      onRecordUpdate: jest.fn(),
      onRecordAdd: jest.fn(),
      columnWidth: 270,
      onSortColumns: jest.fn(),
      onColumnAdd: jest.fn(),
      onColumnDelete: jest.fn(),
      onColumnRename: jest.fn(),
      onColumnCollapse: jest.fn(),
      onColumnPin: jest.fn(),
      onColumnPersist: jest.fn(),
      validateStatusField: () => ({}),
      checkField: undefined,
      includeFields: [],
      customHeader: undefined,
      zoom,
      onZoomChange,
    },
  });
  const container = target.querySelector(".projects--board--container") as HTMLElement;
  return { target, component, container, onZoomChange };
}

function ctrlWheel(el: HTMLElement) {
  el.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("zoomHeldByDrag", () => {
  it("holds for a column drag, a touch card drag and the library's mouse drag", () => {
    expect(zoomHeldByDrag(document, false, false)).toBe(false);
    expect(zoomHeldByDrag(document, true, false)).toBe(true);
    expect(zoomHeldByDrag(document, false, true)).toBe(true);
    const clone = document.createElement("div");
    clone.id = DRAGGED_ELEMENT_ID;
    document.body.appendChild(clone);
    expect(zoomHeldByDrag(document, false, false)).toBe(true);
  });
});

describe("Board — the zoom during a drag", () => {
  it("Ctrl+wheel zooms when nothing is dragged", async () => {
    const { component, container, onZoomChange } = mountBoard(1);
    ctrlWheel(container);
    await tick();
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    component.$destroy();
  });

  it("Ctrl+wheel leaves the zoom alone while a card is dragged (old code: changed it)", async () => {
    const { component, container, onZoomChange } = mountBoard(1.25);
    const clone = document.createElement("div");
    clone.id = DRAGGED_ELEMENT_ID;
    document.body.appendChild(clone);
    const wheel = new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    container.dispatchEvent(wheel);
    await tick();
    expect(onZoomChange).not.toHaveBeenCalled();
    // The browser's own zoom stays blocked too.
    expect(wheel.defaultPrevented).toBe(true);
    clone.remove();
    ctrlWheel(container);
    await tick();
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    component.$destroy();
  });

  it("a zoomed board does not gate its column grips (old code: stopped the press)", async () => {
    const { component, target } = mountBoard(1.25);
    await tick();
    const grip = target.querySelector(".board-column-grip") as HTMLElement | null;
    expect(grip).not.toBeNull();
    const reached = jest.fn();
    grip!.addEventListener("mousedown", reached);
    grip!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(reached).toHaveBeenCalledTimes(1);
    component.$destroy();
  });
});
