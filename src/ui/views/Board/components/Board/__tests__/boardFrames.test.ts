/**
 * cards-g5 — saved card frames on the board.
 *
 * A board frame sets a card's height only: its top thumbnail's height, a left
 * thumbnail's square side (thumb-hairline 1B, capped at 40% of the card by
 * the grid), or the card's minimum without one. The column governs the width, and the span
 * of a frame means nothing here. The resize handle sits in the card's
 * controls, away from the grip lane, is no drag handle, and leaves the grip's
 * arming and keyboard reorder as they were.
 *
 * Mocks as in gripLayout / boardThumbnails: the view contexts (CardList and
 * Board mounts), the Markdown owner's `Component`, the Flair and Layout
 * barrels, plus `Notice`, the modals and the `components` barrel for the
 * BoardView mount at the end.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { tick } from "svelte";

jest.mock("obsidian-svelte", () => ({
  ...jest.requireActual("src/__mocks__/obsidian-svelte"),
  Checkbox: (jest.requireActual("obsidian-svelte/Checkbox/Checkbox.svelte") as { default: unknown }).default,
}));

// CardList reads two view contexts keyed by private symbols (gripLayout
// pattern); BoardView's `set` calls are no-ops against the same stubs.
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
jest.mock("src/ui/modals/createNoteModal", () => ({
  CreateNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock(
  "obsidian",
  () => {
    const actual = jest.requireActual("src/__mocks__/obsidian") as Record<string, unknown>;
    class Component {
      loaded = false;
      load(): void {
        this.loaded = true;
      }
      unload(): void {
        this.loaded = false;
      }
    }
    return { ...actual, Component, Notice: jest.fn() };
  },
  { virtual: true }
);
jest.mock("src/ui/components/Flair", () => ({
  Flair: (jest.requireActual("src/ui/components/Flair/Flair.svelte") as { default: unknown }).default,
}));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: (jest.requireActual("src/ui/components/Layout/ViewLayout.svelte") as { default: unknown }).default,
  ViewContent: (jest.requireActual("src/ui/components/Layout/ViewContent.svelte") as { default: unknown }).default,
}));
// BoardView imports Board through the components barrel (see gripLayout.test.ts
// for why a barrel of `.svelte` re-exports is bound by hand under Jest).
jest.mock("src/ui/views/Board/components", () => ({
  Board: (jest.requireActual("src/ui/views/Board/components/Board/Board.svelte") as { default: unknown }).default,
}));

type Mounted = { $destroy(): void; $set(props: Record<string, unknown>): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const CardList = require("../CardList.svelte").default as ComponentClass;
const Board = require("../Board.svelte").default as ComponentClass;
const { TRIGGERS, SOURCES } = require("svelte-dnd-action");
const BoardView = require("../../../BoardView.svelte").default as ComponentClass;
const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const { Notice } = require("obsidian") as { Notice: jest.Mock };

const FILES: Record<string, { path: string; extension: string }> = {
  "img/a.png": { path: "img/a.png", extension: "png" },
};
app.set({
  metadataCache: { getFirstLinkpathDest: (link: string) => FILES[link] ?? null },
  vault: { getResourcePath: (file: { path: string }) => `app://vault/${file.path}` },
});

const cover = { name: "cover", type: "string", repeated: false, identifier: false, derived: false };
const RECORDS = () => [
  { id: "a.md", values: { cover: "[[img/a.png]]" } },
  { id: "b.md", values: {} },
];

function mountCards(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const items = RECORDS();
  const onRecordClick = jest.fn();
  const onDrop = jest.fn();
  const onCardFrameChange = jest.fn();
  const component = new CardList({
    target,
    props: {
      items,
      onRecordClick,
      onRecordCheck: jest.fn(),
      onDrop,
      includeFields: [],
      checkField: undefined,
      customHeader: undefined,
      boardEditing: false,
      coverField: cover,
      onCardFrameChange,
      ...props,
    },
  });
  const card = (id: string) => target.querySelector<HTMLElement>(`article[data-ppp-card-id="${id}"]`) as HTMLElement;
  const handle = (id: string) => {
    const el = card(id).querySelector<HTMLElement>(".ppp-card-resize-handle") as HTMLElement;
    Object.assign(el, { setPointerCapture: jest.fn(), releasePointerCapture: jest.fn(), hasPointerCapture: () => true });
    return el;
  };
  const lanes = (id: string) => Array.from(card(id).children).map((c) => c.className.split(/\s+/)[0]);
  return {
    target,
    items,
    card,
    handle,
    lanes,
    component,
    onRecordClick,
    onDrop,
    onCardFrameChange,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const prop = (el: HTMLElement | null | undefined, name: string) => el?.style.getPropertyValue(name) ?? "";

function pointer(type: string, x: number, y: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });

beforeEach(() => {
  Notice.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("board checkbox interaction", () => {
  it("toggles the Boolean property shown in card metadata, without opening YAML", async () => {
    const onRecordCheck = jest.fn();
    const m = mountCards({
      items: [{ id: "a.md", values: { reviewed: false } }],
      includeFields: [{ name: "reviewed", type: "boolean", repeated: false, derived: false, identifier: false }],
      onRecordCheck,
    });
    const checkbox = m.card("a.md").querySelector<HTMLInputElement>('.field-label input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    checkbox!.click();
    await tick();
    expect(onRecordCheck).toHaveBeenCalledWith(expect.objectContaining({ id: "a.md" }), true, "reviewed");
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });
  it("does not write on mount; a native click toggles once without opening the note", async () => {
    const onRecordCheck = jest.fn();
    const onRecordEdit = jest.fn();
    const m = mountCards({ checkField: "done", onRecordCheck, onRecordEdit });
    await tick();
    expect(onRecordCheck).not.toHaveBeenCalled();
    const checkbox = m.card("a.md").querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox).not.toBeNull();
    checkbox.click();
    await tick();
    expect(checkbox.checked).toBe(true);
    expect(onRecordCheck).toHaveBeenCalledTimes(1);
    expect(onRecordCheck).toHaveBeenCalledWith(m.items[0], true);
    expect(m.onRecordClick).not.toHaveBeenCalled();
    expect(onRecordEdit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a read-only card cannot change its checkbox", async () => {
    const onRecordCheck = jest.fn();
    const m = mountCards({ checkField: "done", readOnly: true, onRecordCheck });
    m.card("a.md").querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await tick();
    expect(onRecordCheck).not.toHaveBeenCalled();
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });
});

describe("cards-g5 — board height", () => {
  it("no frame: the card and its slot carry no frame style; the handle is the last lane", () => {
    const m = mountCards();
    expect(prop(m.card("b.md"), "min-height")).toBe("");
    expect(m.lanes("b.md")).toEqual(["board-card-grip", "color-item", "ppp-card-resize-handle"]);
    m.destroy();
  });

  it("without a change handler there is no handle", () => {
    const m = mountCards({ onCardFrameChange: undefined });
    expect(m.target.querySelector(".ppp-card-resize-handle")).toBeNull();
    expect(m.lanes("b.md")).toEqual(["board-card-grip", "color-item"]);
    m.destroy();
  });

  it("without a thumbnail the height is the card's minimum", () => {
    const m = mountCards({ cardFrames: { view: { heightRem: 9 }, byRecord: { "b.md": { heightRem: 14 } } } });
    expect(prop(m.card("b.md"), "min-height")).toBe("14rem");
    expect(prop(m.card("a.md"), "min-height")).toBe("9rem");
    m.destroy();
  });

  it("top thumbnail: the height is the thumbnail's, not the card's", () => {
    const m = mountCards({ thumbnailLayout: "top", cardFrames: { view: { heightRem: 9 }, byRecord: {} } });
    const media = m.card("a.md").querySelector<HTMLElement>(".ppp-board-card-media");
    expect(prop(media, "height")).toBe("9rem");
    expect(prop(media, "--ppp-card-media-ratio")).toBe("auto");
    expect(media).toHaveAttribute("data-ppp-frame-target");
    expect(prop(m.card("a.md"), "min-height")).toBe("");
    expect(prop(m.card("a.md"), "--ppp-board-card-thumb")).toBe("");
    // b.md has no cover: its frame is the card's minimum.
    expect(prop(m.card("b.md"), "min-height")).toBe("9rem");
    m.destroy();
  });

  it("left thumbnail (1B): the height is the square's side, set on the card's lane, never an inline height", () => {
    const m = mountCards({ thumbnailLayout: "left", cardFrames: { view: { heightRem: 9 }, byRecord: {} } });
    const media = m.card("a.md").querySelector<HTMLElement>(".ppp-board-card-media");
    expect(prop(m.card("a.md"), "--ppp-board-card-thumb")).toBe("9rem");
    expect(prop(media, "height")).toBe("");
    expect(prop(media, "--ppp-card-media-ratio")).toBe("");
    expect(media).toHaveAttribute("data-ppp-frame-target");
    // stab-board: the lane is capped at 40% of the card, so the frame is also
    // the card's minimum height; without it the resize would change nothing.
    expect(prop(m.card("a.md"), "min-height")).toBe("9rem");
    // b.md has no cover: no side, and its frame is the card's minimum.
    expect(prop(m.card("b.md"), "--ppp-board-card-thumb")).toBe("");
    expect(prop(m.card("b.md"), "min-height")).toBe("9rem");
    m.destroy();
  });

  it("left thumbnail: a resize preview grows the square live, and the release saves the height", async () => {
    const m = mountCards({ thumbnailLayout: "left", cardFrames: { view: { heightRem: 10 }, byRecord: {} } });
    const handle = m.handle("a.md");
    handle.dispatchEvent(pointer("pointerdown", 100, 100));
    handle.dispatchEvent(pointer("pointermove", 100, 132));
    await tick();
    expect(prop(m.card("a.md"), "--ppp-board-card-thumb")).toBe("12rem");
    expect(prop(m.card("a.md"), "min-height")).toBe("12rem");
    expect(prop(m.card("a.md").querySelector<HTMLElement>(".ppp-board-card-media"), "height")).toBe("");
    handle.dispatchEvent(pointer("pointerup", 100, 132));
    expect(m.onCardFrameChange).toHaveBeenCalledWith("a.md", { heightRem: 12 });
    m.destroy();
  });

  it("left thumbnail: a per-card override sets that card's minimum, the view frame the rest", () => {
    const m = mountCards({
      thumbnailLayout: "left",
      cardFrames: { view: { heightRem: 9 }, byRecord: { "a.md": { heightRem: 15 } } },
    });
    expect(prop(m.card("a.md"), "min-height")).toBe("15rem");
    expect(prop(m.card("a.md"), "--ppp-board-card-thumb")).toBe("15rem");
    expect(prop(m.card("b.md"), "min-height")).toBe("9rem");
    m.destroy();
  });

  it("never changes a card's width: a span is ignored and nothing sizes the inline axis", () => {
    const m = mountCards({ cardFrames: { view: { heightRem: 9, gridSpan: 3 }, byRecord: { "a.md": { gridSpan: 4 } } } });
    for (const id of ["a.md", "b.md"]) {
      const card = m.card(id);
      for (const name of ["grid-column", "width", "min-width", "max-width"]) {
        expect(prop(card, name)).toBe("");
        expect(prop(card.parentElement, name)).toBe("");
      }
    }
    m.destroy();
  });
});

describe("cards-g5 — the board handle", () => {
  it("drags vertically only: a preview, then one change on release", async () => {
    const m = mountCards({ cardFrames: { view: { heightRem: 10 }, byRecord: {} } });
    const handle = m.handle("b.md");
    expect(handle).not.toHaveClass("ppp-card-resize-handle--horizontal");
    handle.dispatchEvent(pointer("pointerdown", 100, 100));
    handle.dispatchEvent(pointer("pointermove", 400, 132));
    await tick();
    expect(prop(m.card("b.md"), "min-height")).toBe("12rem");
    expect(m.onCardFrameChange).not.toHaveBeenCalled();
    handle.dispatchEvent(pointer("pointerup", 400, 132));
    expect(m.onCardFrameChange).toHaveBeenCalledTimes(1);
    expect(m.onCardFrameChange).toHaveBeenCalledWith("b.md", { heightRem: 12 });
    // Nothing opened the card.
    expect(m.onRecordClick).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Left/Right do nothing on the board", () => {
    const m = mountCards({ cardFrames: { view: { heightRem: 10 }, byRecord: {} } });
    m.handle("b.md").dispatchEvent(key("ArrowRight"));
    expect(m.onCardFrameChange).not.toHaveBeenCalled();
    m.handle("b.md").dispatchEvent(key("ArrowUp"));
    expect(m.onCardFrameChange).toHaveBeenCalledWith("b.md", { heightRem: 11 });
    m.destroy();
  });

  it("is not a drag handle: a press on it does not arm the drag", () => {
    const m = mountCards();
    const grip = m.card("a.md").firstElementChild as HTMLElement;
    const handle = m.handle("a.md");
    expect(handle).not.toHaveClass("board-card-grip");
    expect(handle.getAttribute("role")).toBe("slider");
    handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grab");
    handle.dispatchEvent(new Event("touchstart", { bubbles: true }));
    expect(grip.style.cursor).toBe("grab");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    m.destroy();
  });

  it("the grip drag is unaffected: arms, disarms, and keyboard reorder still works", () => {
    const m = mountCards({ cardFrames: { view: { heightRem: 10 }, byRecord: {} } });
    const first = m.card("a.md");
    const grip = first.firstElementChild as HTMLElement;
    grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(grip.style.cursor).toBe("grabbing");
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(grip.style.cursor).toBe("grab");

    grip.dispatchEvent(key("Enter"));
    first.dispatchEvent(key("ArrowDown"));
    expect(m.onDrop).toHaveBeenCalledTimes(1);
    const [moved, order] = m.onDrop.mock.calls[0] as [{ id: string }, { id: string }[]];
    expect(moved.id).toBe("a.md");
    expect(order.map((r) => r.id)).toEqual(["b.md", "a.md"]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // A reorder never wrote a frame.
    expect(m.onCardFrameChange).not.toHaveBeenCalled();
    m.destroy();
  });

  it("the handle's keys do not reach the drag zone", () => {
    const m = mountCards();
    m.handle("a.md").dispatchEvent(key("ArrowDown"));
    expect(m.onDrop).not.toHaveBeenCalled();
    m.destroy();
  });
});

describe("column drag temporarily folds columns without changing saved state", () => {
  it.each([0.25, 0.55, 1, 1.5, 2])("a mouse drag reorders columns at zoom %s", async zoom => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const columns = [
      { id: "Open", records: RECORDS(), collapse: false, pinned: false, persisted: false },
      { id: "Closed", records: RECORDS(), collapse: true, pinned: false, persisted: false },
    ];
    const onSortColumns = jest.fn();
    const component = new Board({ target, props: {
      columns, project: { id: "board", name: "Board" }, readonly: true, dataReadOnly: false, richText: false, zoom,
      onRecordClick: jest.fn(), onRecordCheck: jest.fn(), onRecordUpdate: jest.fn(), onRecordAdd: jest.fn(),
      columnWidth: 270, onSortColumns, onColumnAdd: jest.fn(), onColumnDelete: jest.fn(),
      onColumnRename: jest.fn(), onColumnCollapse: jest.fn(), onColumnPin: jest.fn(), onColumnPersist: jest.fn(),
      validateStatusField: () => ({}), checkField: undefined, includeFields: [], customHeader: undefined,
    }});
    const zone = target.querySelector<HTMLElement>("section.projects--board:not(.projects--board--pinned)")!;
    const grip = target.querySelector<HTMLElement>('section[data-id="Open"] .board-column-grip')!;
    const scrollingElementDescriptor = Object.getOwnPropertyDescriptor(document, "scrollingElement");
    Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
    try {
      grip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: 20, clientY: 10 }));
      await tick();
      const wrappers = Array.from(target.querySelectorAll<HTMLElement>(".projects--board--column--dndwrapper"));
      expect(wrappers).toHaveLength(2);
      expect(wrappers.every((wrapper) => wrapper.classList.contains("projects--board--column--dndwrapper--collapsed"))).toBe(true);
      expect(wrappers.every((wrapper) => wrapper.style.width === "3rem")).toBe(true);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      zone.dispatchEvent(new CustomEvent(TRIGGERS.DRAGGED_OVER_INDEX, {
        detail: { indexObj: { index: 1, isProximityBased: false } },
      }));
      await tick();
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: 20, clientY: 10 }));
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(onSortColumns).toHaveBeenCalledTimes(1);
      expect(onSortColumns).toHaveBeenCalledWith(["Closed", "Open"]);
    } finally {
      component.$destroy();
      target.remove();
      if (scrollingElementDescriptor) Object.defineProperty(document, "scrollingElement", scrollingElementDescriptor);
      else Reflect.deleteProperty(document, "scrollingElement");
    }
  });

  it("restores expanded, collapsed and pinned columns and keeps the pressed handle connected", async () => {
    const target=document.createElement("div");document.body.appendChild(target);
    const columns=[
      {id:"Pinned",records:RECORDS(),collapse:false,pinned:true,persisted:false},
      {id:"Open",records:RECORDS(),collapse:false,pinned:false,persisted:false},
      {id:"Closed",records:RECORDS(),collapse:true,pinned:false,persisted:false},
    ];
    const onColumnCollapse=jest.fn();const onSortColumns=jest.fn();
    const component=new Board({target,props:{columns,project:{id:"board",name:"Board"},readonly:true,dataReadOnly:false,richText:false,
      onRecordClick:jest.fn(),onRecordCheck:jest.fn(),onRecordUpdate:jest.fn(),onRecordAdd:jest.fn(),columnWidth:270,
      onSortColumns,onColumnAdd:jest.fn(),onColumnDelete:jest.fn(),onColumnRename:jest.fn(),onColumnCollapse,
      onColumnPin:jest.fn(),onColumnPersist:jest.fn(),validateStatusField:()=>({}),checkField:undefined,includeFields:[],customHeader:undefined,
    }});
    const zone=target.querySelector<HTMLElement>("section.projects--board:not(.projects--board--pinned)")!;
    const grip=target.querySelector<HTMLElement>('section[data-id="Open"] .board-column-grip')!;
    expect(grip).not.toBeNull();
    zone.dispatchEvent(new CustomEvent("consider",{detail:{items:columns.filter(c=>!c.pinned),info:{trigger:TRIGGERS.DRAG_STARTED,source:SOURCES.KEYBOARD,id:"Open"}}}));
    await tick();
    expect(target.querySelectorAll("section.projects--board--column.collapse")).toHaveLength(3);
    for (const section of Array.from(target.querySelectorAll<HTMLElement>("section.projects--board--column.collapse"))) {
      expect(section.ownerDocument.defaultView!.getComputedStyle(section).boxSizing).toBe("border-box");
      expect(section.style.height).toBe("3rem");
      expect(section.parentElement!.style.minHeight).toBe("16.875rem");
    }
    expect(grip.isConnected).toBe(true);
    expect(columns.map(c=>c.collapse)).toEqual([false,false,true]);
    zone.dispatchEvent(new CustomEvent("finalize",{detail:{items:columns.filter(c=>!c.pinned),info:{trigger:TRIGGERS.DROPPED_INTO_ZONE,source:SOURCES.KEYBOARD,id:"Open"}}}));
    await tick();
    expect(target.querySelectorAll("section.projects--board--column.collapse")).toHaveLength(1);
    expect(target.querySelector('section[data-id="Closed"]')?.classList.contains("collapse")).toBe(true);
    expect(grip.isConnected).toBe(true);
    expect(onColumnCollapse).not.toHaveBeenCalled();expect(onSortColumns).not.toHaveBeenCalled();
    component.$destroy();target.remove();
  });
});

describe("cards-g5 — Board passes frames to every column", () => {
  it("pinned and unpinned columns both size their cards and offer the handle", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onCardFrameChange = jest.fn();
    const column = (id: string, extra: Record<string, boolean> = {}) => ({
      id,
      records: RECORDS(),
      collapse: false,
      pinned: false,
      persisted: false,
      ...extra,
    });
    const component = new Board({
      target,
      props: {
        columns: [column("Pinned", { pinned: true }), column("Open")],
        project: { id: "board", name: "Board" },
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
        cardFrames: { view: {}, byRecord: { "b.md": { heightRem: 15 } } },
        onCardFrameChange,
      },
    });
    for (const columnId of ["Pinned", "Open"]) {
      const card = target.querySelector<HTMLElement>(
        `section.projects--board--column[data-id="${columnId}"] article[data-ppp-card-id="b.md"]`
      );
      expect(prop(card, "min-height")).toBe("15rem");
      expect(card?.querySelector(".ppp-card-resize-handle")).not.toBeNull();
    }
    component.$destroy();
  });
});

describe("cards-g5 — BoardView writes frames through onConfigChange", () => {
  function mountView(config: Record<string, unknown>, props: Record<string, unknown> = {}) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const records = RECORDS();
    const onConfigChange = jest.fn();
    const component = new BoardView({
      target,
      props: {
        project: { id: "p", autosave: true },
        frame: { fields: [], records },
        readonly: true,
        api: { updateRecord: jest.fn(), updateRecords: jest.fn(), addRecord: jest.fn() },
        getRecordColor: () => null,
        sortRecords: (r: unknown[]) => r,
        getRecord: (id: string) => records.find((r) => r.id === id),
        config,
        onConfigChange,
        hasSort: false,
        hasFilter: false,
        ...props,
      },
    });
    const card = (id: string) => target.querySelector<HTMLElement>(`article[data-ppp-card-id="${id}"]`) as HTMLElement;
    return { target, card, onConfigChange, destroy: () => component.$destroy() };
  }

  it.each([false, true])("metadata checkbox reaches the record API only for writable data (readOnly=%s)", async (dataReadOnly) => {
    const updateRecord = jest.fn();
    const booleanField = { name: "reviewed", type: "boolean", repeated: false, derived: false, identifier: false };
    const record = { id: "a.md", values: { reviewed: false } };
    const m = mountView({ includeFields: ["reviewed"] }, {
      frame: { fields: [booleanField], records: [record] },
      getRecord: () => record,
      dataReadOnly,
      api: { updateRecord, updateRecords: jest.fn(), addRecord: jest.fn() },
    });
    const checkbox = m.card("a.md").querySelector<HTMLInputElement>('.field-label input[type="checkbox"]')!;
    expect(checkbox.disabled).toBe(dataReadOnly);
    checkbox.click();
    await tick();
    if (dataReadOnly) expect(updateRecord).not.toHaveBeenCalled();
    else {
      expect(updateRecord).toHaveBeenCalledTimes(1);
      expect(updateRecord).toHaveBeenCalledWith({ id: "a.md", values: { reviewed: true } }, [booleanField]);
      expect(record.values.reviewed).toBe(false);
    }
    m.destroy();
  });

  it("a computed Boolean has no editable header control and stays disabled in metadata", () => {
    const updateRecord = jest.fn();
    const field = { name: "derivedFlag", type: "boolean", repeated: false, derived: true, identifier: false };
    const record = { id: "a.md", values: { derivedFlag: true } };
    const m = mountView({ checkField: "derivedFlag", includeFields: ["derivedFlag"] }, {
      frame: { fields: [field], records: [record] }, getRecord: () => record,
      api: { updateRecord, updateRecords: jest.fn(), addRecord: jest.fn() },
    });
    expect(m.card("a.md").querySelector(".checkbox-wrapper")).toBeNull();
    const checkbox = m.card("a.md").querySelector<HTMLInputElement>('.field-label input[type="checkbox"]')!;
    expect(checkbox.disabled).toBe(true);
    checkbox.click();
    expect(updateRecord).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a key action on a card's handle saves the override once, keeping the rest of the config", async () => {
    const m = mountView({ boardZoom: 1, cardFrame: { heightRem: 10 } });
    expect(m.onConfigChange).not.toHaveBeenCalled();
    expect(prop(m.card("b.md"), "min-height")).toBe("10rem");
    m.card("b.md").querySelector(".ppp-card-resize-handle")?.dispatchEvent(key("ArrowUp"));
    expect(m.onConfigChange).toHaveBeenCalledTimes(1);
    expect(m.onConfigChange).toHaveBeenCalledWith({
      boardZoom: 1,
      cardFrame: { heightRem: 10 },
      cardFramesByRecord: { "b.md": { heightRem: 11 } },
    });
    await tick();
    expect(prop(m.card("b.md"), "min-height")).toBe("11rem");
    m.destroy();
  });

  it("a new override past the cap is refused with a notice", () => {
    const byRecord: Record<string, { heightRem: number }> = {};
    for (let i = 0; i < 500; i++) byRecord[`elsewhere/${i}.md`] = { heightRem: 8 };
    const m = mountView({ cardFramesByRecord: byRecord });
    m.card("b.md").querySelector(".ppp-card-resize-handle")?.dispatchEvent(key("ArrowUp"));
    expect(m.onConfigChange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  it("the dashboard block hands the board its change handler", () => {
    const block = readFileSync(
      join(resolve(__dirname, "../../../.."), "Dashboard", "widgets", "DatabaseCall", "DatabaseCallBlock.svelte"),
      "utf8"
    );
    expect(block).toMatch(/onConfigChange=\{handleBoardConfigChange\}/);
    expect(block).toMatch(/function handleBoardConfigChange\(cfg: BoardConfig\) \{\s*handleViewConfigChange\(/);
  });
});
