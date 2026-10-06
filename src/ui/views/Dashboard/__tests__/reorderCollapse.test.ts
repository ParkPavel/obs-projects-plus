/**
 * stab-dash (3.7.1) - pressing a tile grip collapses every tile to its header.
 *
 * A table tile can be thousands of pixels tall and kept its full height while
 * dragged, so a tile could not be carried past a tall neighbour. A press on the
 * grip now puts the canvas into a reorder state (a class that hides all but the
 * header of each tile) and it ends on finalize or on a release that started no
 * drag.
 *
 * RED on the old code: `reorderCollapse.ts` does not exist (the controller suite
 * cannot load), and WidgetGrid never sets the class, so the press, finalize and
 * release tests find no `ppp-database-canvas--reordering` and the style has no
 * rule that hides the content.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { SOURCES, TRIGGERS } from "svelte-dnd-action";
import * as fs from "fs";
import * as path from "path";

import { createReorderCollapse, HOLD_VAR, REORDER_CLASS } from "../reorderCollapse";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? "" }) };
});
// The real host drags in the widget registry; a stand-in with the same outer shape is enough here.
jest.mock("../widgets/WidgetHost.svelte", () => require("./StubWidgetHost.svelte"));

const WidgetGrid = require("../WidgetGrid.svelte").default;

const realGetComputedStyle = window.getComputedStyle.bind(window);
let scrollers: Element[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  scrollers = [];
  // jsdom does not say which ancestors scroll: the ones a test names do.
  jest.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) =>
    scrollers.includes(el)
      ? ({ getPropertyValue: (p: string) => (p === "overflow-y" ? "auto" : "") } as unknown as CSSStyleDeclaration)
      : realGetComputedStyle(el, pseudo),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** An ancestor that scrolls, with a scrollTop a test can read back (jsdom has no layout). */
function makeScroller(initialTop: number): { el: HTMLElement; top: () => number } {
  const el = document.createElement("div");
  let top = initialTop;
  Object.defineProperty(el, "scrollTop", { get: () => top, set: (v: number) => { top = v; } });
  Object.defineProperty(el, "scrollHeight", { value: 5000 });
  Object.defineProperty(el, "clientHeight", { value: 600 });
  document.body.appendChild(el);
  scrollers.push(el);
  return { el, top: () => top };
}

function box(top: number): DOMRect {
  return { top, bottom: top + 40, left: 0, right: 300, width: 300, height: 40, x: 0, y: top, toJSON: () => ({}) };
}

describe("createReorderCollapse (stab-dash)", () => {
  function setup(headerTops: { open: number; collapsed: number }) {
    const scroller = makeScroller(1000);
    const canvas = document.createElement("div");
    const tile = document.createElement("div");
    tile.className = "ppp-widget-host";
    const grip = document.createElement("div");
    grip.className = "ppp-widget-grip";
    tile.appendChild(grip);
    canvas.appendChild(tile);
    scroller.el.appendChild(canvas);
    // Layout would put the pressed tile's header higher once the tiles above it collapse.
    tile.getBoundingClientRect = () => box(canvas.classList.contains(REORDER_CLASS) ? headerTops.collapsed : headerTops.open);
    tile.scrollIntoView = jest.fn();
    const onChange = jest.fn();
    return { scroller, canvas, tile, grip, onChange, collapse: createReorderCollapse(canvas, onChange) };
  }

  it("sets the state on a grip press, once, and clears it on release", () => {
    const { canvas, grip, onChange, collapse } = setup({ open: 500, collapsed: 500 });
    collapse.begin(grip);
    collapse.begin(grip);
    expect(canvas).toHaveClass(REORDER_CLASS);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    collapse.end(false);
    expect(canvas).not.toHaveClass(REORDER_CLASS);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the pressed header where it was by moving the scroller", () => {
    const { scroller, grip, collapse } = setup({ open: 500, collapsed: 100 });
    collapse.begin(grip);
    // The header jumped 400 px up; the page follows, so it is under the finger again.
    expect(scroller.top()).toBe(600);
    collapse.end(false);
    // A tap moved nothing: the page goes back the way the press found it.
    expect(scroller.top()).toBe(1000);
  });

  it("brings the moved tile into view after a finalized drag, without a scroll jump", async () => {
    const { scroller, tile, canvas, grip, collapse } = setup({ open: 500, collapsed: 100 });
    collapse.begin(grip);
    collapse.end(true);
    expect(canvas).not.toHaveClass(REORDER_CLASS);
    expect(scroller.top()).toBe(600);
    await tick();
    expect(tile.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("does nothing on a release that follows no press", () => {
    const { onChange, collapse, scroller } = setup({ open: 500, collapsed: 100 });
    collapse.end(false);
    collapse.end(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(scroller.top()).toBe(1000);
  });
});

describe("WidgetGrid reorder state (stab-dash)", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  function mount() {
    const view = render(WidgetGrid, {
      props: {
        widgets: items, dndWidgets: items, canDnd: true, readonly: false,
        frame: { fields: [], records: [] }, displayFrame: { fields: [], records: [] },
        api: {}, getRecordColor: () => null, fields: [], tableConfig: undefined,
        primaryDataTableId: "a", fieldPresets: [], activeFieldPresetId: undefined,
        availableSources: [], rightFrames: new Map(), project: { id: "p", name: "P" },
      },
    });
    const canvas = view.container.querySelector<HTMLElement>(".ppp-database-canvas--stack") as HTMLElement;
    const grip = canvas.querySelector<HTMLElement>(".ppp-widget-grip") as HTMLElement;
    return { ...view, canvas, grip };
  }

  const press = (grip: Element) => grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  const release = () => window.dispatchEvent(new MouseEvent("mouseup"));
  const considerEvent = (items: Array<{ id: string }>) =>
    new CustomEvent("consider", { detail: { items, info: { trigger: TRIGGERS.DRAG_STARTED, id: "a", source: SOURCES.POINTER } } });

  it("sets the state on a grip press, in the capture phase, before the grip's own handler", () => {
    const { canvas, grip } = mount();
    let classAtGripHandler = false;
    grip.addEventListener("mousedown", () => { classAtGripHandler = canvas.classList.contains(REORDER_CLASS); });
    press(grip);
    expect(classAtGripHandler).toBe(true);
  });

  it("keeps the state through the drag and clears it on finalize", async () => {
    const { canvas, grip, component } = mount();
    const onFinalize = jest.fn();
    component.$on("finalize", onFinalize);
    press(grip);
    canvas.dispatchEvent(considerEvent(items));
    release();
    await tick();
    expect(canvas).toHaveClass(REORDER_CLASS);

    const reordered = [items[1], items[0], items[2]];
    canvas.dispatchEvent(new CustomEvent("finalize", { detail: { items: reordered, info: { trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "a", source: SOURCES.POINTER } } }));
    await tick();
    expect(canvas).not.toHaveClass(REORDER_CLASS);
    // Persistence is unchanged: the finalized order still goes up to the parent.
    expect(onFinalize).toHaveBeenCalledTimes(1);
    expect(onFinalize.mock.calls[0][0].detail.items).toEqual(reordered);
  });

  it("clears the state on a release that started no drag", async () => {
    const { canvas, grip } = mount();
    press(grip);
    expect(canvas).toHaveClass(REORDER_CLASS);
    release();
    expect(canvas).not.toHaveClass(REORDER_CLASS);
    await tick();
    expect(canvas).not.toHaveClass(REORDER_CLASS);
  });

  it("ignores a press that is not on a grip", () => {
    const { canvas } = mount();
    (canvas.querySelector(".ppp-widget-content") as HTMLElement).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(canvas).not.toHaveClass(REORDER_CLASS);
  });

  it("hides everything in a tile but its header while the class is set", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "WidgetGrid.svelte"), "utf8");
    const rule = source.match(/\.ppp-database-canvas--reordering\s+:global\(([^)]*\([^)]*\)[^)]*|[^)]*)\)\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[2]).toMatch(/display:\s*none/);
    // The selector inside :global must pick the content and panels and spare the header.
    const { canvas } = mount();
    const hidden = Array.from(canvas.querySelectorAll(rule?.[1] ?? "x"));
    expect(hidden.length).toBe(items.length);
    expect(hidden.every((el) => el.classList.contains("ppp-widget-content"))).toBe(true);
    expect(canvas.querySelectorAll(".ppp-widget-header").length).toBe(items.length);
  });
});

describe("reorderCollapse keeps the canvas height while reordering", () => {
  it("sets the hold variable on begin and clears it on end", () => {
    const canvas = document.createElement("div");
    const tile = document.createElement("div");
    tile.className = "ppp-widget-host";
    canvas.appendChild(tile);
    document.body.appendChild(canvas);
    canvas.getBoundingClientRect = () => ({ top: 0, left: 0, width: 100, height: 3200, right: 100, bottom: 3200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const rc = createReorderCollapse(canvas, () => {});
    rc.begin(tile);
    expect(canvas.style.getPropertyValue(HOLD_VAR)).toMatch(/rem$/);
    rc.end(false);
    expect(canvas.style.getPropertyValue(HOLD_VAR)).toBe("");
    canvas.remove();
  });
});
