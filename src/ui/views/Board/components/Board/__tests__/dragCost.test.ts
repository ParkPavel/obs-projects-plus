/**
 * stab-board — what a card or column drag costs per pointer move.
 *
 * svelte-dnd-action reorders the zone's items on every `consider`. Svelte's
 * `animate:flip` on the keyed each reads `getBoundingClientRect` of every item
 * before and after each such reorder, whatever the animation's duration (a
 * zero duration still measures), so on a 178-card board each move forced layout
 * for every card (~34 ms live). The lists therefore carry no per-item flip, and
 * a `consider` measures no list item at all.
 *
 * Mocks as in boardFrames.test.ts.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, SOURCES, TRIGGERS } from "svelte-dnd-action";

jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined },
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  openRecord: jest.fn(() => Promise.resolve()),
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

const CardList = require("../CardList.svelte").default as ComponentClass;
const Board = require("../Board.svelte").default as ComponentClass;

const SLOT = "ppp-board-card-slot";
const COLUMN = "projects--board--column--dndwrapper";

/** Counts the rect reads made on elements carrying `cls`, until `restore()`. */
function spyOnRects(cls: string) {
  const original = Element.prototype.getBoundingClientRect;
  let reads = 0;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains(cls)) reads += 1;
    return original.call(this);
  };
  return {
    reads: () => reads,
    restore: () => {
      Element.prototype.getBoundingClientRect = original;
    },
  };
}

function consider(zone: Element, items: unknown[], id: string) {
  zone.dispatchEvent(
    new CustomEvent("consider", {
      detail: { items, info: { trigger: TRIGGERS.DRAG_STARTED, id, source: SOURCES.POINTER } },
    })
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("stab-board — a drag measures no list item", () => {
  it("a card consider (reorder, shadow placeholder) reads no card slot's rect", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const items = ["a.md", "b.md", "c.md", "d.md"].map((id) => ({ id, values: {} }));
    const component = new CardList({
      target,
      props: {
        items,
        onRecordClick: jest.fn(),
        onRecordCheck: jest.fn(),
        onDrop: jest.fn(),
        includeFields: [],
        checkField: undefined,
        customHeader: undefined,
        boardEditing: false,
      },
    });
    const zone = target.querySelector(".projects--board--card-list") as HTMLElement;
    expect(zone.querySelectorAll(`.${SLOT}`)).toHaveLength(4);

    const spy = spyOnRects(SLOT);
    try {
      // A move: the dragged card becomes the shadow and sits last.
      const shadow = { id: "a.md", values: {}, [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true };
      consider(zone, [items[1], items[2], items[3], shadow], "a.md");
      await tick();
      consider(zone, [items[1], items[2], shadow, items[3]], "a.md");
      await tick();
      expect(Array.from(zone.querySelectorAll(`.${SLOT}`)).map((el) => el.querySelector("article")?.getAttribute("data-ppp-card-id"))).toEqual(["b.md", "c.md", "a.md", "d.md"]);
      expect(spy.reads()).toBe(0);
    } finally {
      spy.restore();
      component.$destroy();
    }
  });

  it("a column consider reads no column wrapper's rect", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const column = (id: string) => ({ id, records: [], collapse: false, pinned: false, persisted: false });
    const columns = [column("A"), column("B"), column("C")];
    const component = new Board({
      target,
      props: {
        columns,
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
      },
    });
    const zone = target.querySelector("section.projects--board:not(.projects--board--pinned)") as HTMLElement;
    expect(zone.querySelectorAll(`.${COLUMN}`)).toHaveLength(3);

    const spy = spyOnRects(COLUMN);
    try {
      consider(zone, [columns[1], columns[0], columns[2]], "A");
      await tick();
      expect(zone.querySelectorAll(`.${COLUMN}`)).toHaveLength(3);
      expect(spy.reads()).toBe(0);
    } finally {
      spy.restore();
      component.$destroy();
    }
  });

  it("neither list animates its items: no flip is left on the keyed wrappers", () => {
    // Svelte's `animate:` directive has no runtime trace in the DOM; the
    // measurement test above is the behaviour. This pins the sources so a
    // flip cannot return unnoticed.
    const { readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    for (const file of ["CardList.svelte", "Board.svelte"]) {
      const text = readFileSync(join(__dirname, "..", file), "utf8");
      expect(`${file}: ${/\banimate:\w+/.test(text.replace(/\/\/.*|<!--[\s\S]*?-->/g, ""))}`).toBe(`${file}: false`);
      expect(`${file}: ${/from "svelte\/animate"/.test(text)}`).toBe(`${file}: false`);
    }
  });
});
