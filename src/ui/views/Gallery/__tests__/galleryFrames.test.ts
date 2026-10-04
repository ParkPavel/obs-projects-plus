/**
 * cards-g5 — saved card frames in the gallery.
 *
 * The real GalleryView is mounted with a real frame, as in galleryCard and
 * galleryLayouts; only the edges a card hands its work to are replaced, plus
 * `Notice` (to see the cap refusal) and, where a test says so, the window's
 * ResizeObserver (jsdom has none, and does no layout: the grid's width is
 * reported to the gallery the way a browser's observer would). Pointer
 * capture is stubbed on the handle, as in cardResizeHandle.test.ts.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { tick } from "svelte";

import { DataFieldType } from "src/lib/dataframe/dataframe";

// Local aliases: under the jest.mock hoisting transform an imported binding
// may not appear in a type annotation.
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;

jest.mock("src/lib/record/openRecord", () => ({
  ...jest.requireActual("src/lib/record/openRecord"),
  openRecord: jest.fn(() => Promise.resolve()),
}));
jest.mock("src/ui/modals/editNoteModal", () => ({
  EditNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock("src/ui/modals/createNoteModal", () => ({
  CreateNoteModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));
jest.mock("src/ui/views/helpers", () => ({
  ...jest.requireActual("src/ui/views/helpers"),
  showMobileNavMenu: jest.fn(),
  handleHoverLink: jest.fn(),
}));
// The layout barrel re-exports `.svelte` defaults (see galleryCard.test.ts).
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));
jest.mock(
  "obsidian",
  () => ({ ...(jest.requireActual("src/__mocks__/obsidian") as Record<string, unknown>), Notice: jest.fn() }),
  { virtual: true }
);

type Mounted = { $destroy(): void; $set(props: Record<string, unknown>): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const { app } = require("src/lib/stores/obsidian") as { app: { set(value: unknown): void } };
const { watchViewport } = require("src/lib/stores/ui") as { watchViewport: () => () => void };
const helpers = require("src/ui/views/helpers") as { showMobileNavMenu: jest.Mock };
const { Notice } = require("obsidian") as { Notice: jest.Mock };
const GalleryView = require("../GalleryView.svelte").default as ComponentClass;

const COVER = "https://example.com/cover.png";
const status: DataField = { name: "status", type: DataFieldType.Select, repeated: false, identifier: false, derived: false };
const cover: DataField = { ...status, name: "cover", type: DataFieldType.String };
const records: DataRecord[] = ["Alpha", "Beta", "Gamma"].map((name) => ({
  id: `notes/${name}.md`,
  values: { status: "Doing", cover: COVER },
}));
const ALPHA = "notes/Alpha.md";

function mountGallery(config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onConfigChange = jest.fn();
  const component = new GalleryView({
    target,
    props: {
      project: { autosave: true },
      frame: { fields: [status, cover], records },
      config: { coverField: "cover", includeFields: ["status"], ...config },
      onConfigChange,
      api: { updateRecord: jest.fn(), addRecord: jest.fn() },
      getRecordColor: () => null,
      readonly: true,
      ...extra,
    },
  });
  const card = (id: string) => target.querySelector<HTMLElement>(`article[data-ppp-card-id="${id}"]`) as HTMLElement;
  const media = (id: string) => card(id).querySelector<HTMLElement>(".projects--gallery--card__media");
  const handle = (id: string) => {
    const el = card(id).querySelector<HTMLElement>(".ppp-card-resize-handle") as HTMLElement;
    Object.assign(el, { setPointerCapture: jest.fn(), releasePointerCapture: jest.fn(), hasPointerCapture: () => true });
    return el;
  };
  return {
    target,
    component,
    onConfigChange,
    card,
    media,
    handle,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const prop = (el: HTMLElement | null, name: string) => el?.style.getPropertyValue(name) ?? "";

function pointer(type: string, x: number, y: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

/** A ResizeObserver the test drives: `report(width)` is a layout pass. */
class FakeResizeObserver {
  static all: FakeResizeObserver[] = [];
  private readonly callback: (entries: { contentRect: { width: number } }[]) => void;
  constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
    this.callback = callback;
    FakeResizeObserver.all.push(this);
  }
  observe(): void {
    // Layout passes are `report` calls.
  }
  disconnect(): void {
    // Nothing is observed for real.
  }
  report(width: number): void {
    this.callback([{ contentRect: { width } }]);
  }
}

/**
 * chrome-filters: the grid applies an observed width in the next animation
 * frame of its window. Frames are a queue the test flushes, so "not yet" and
 * "once" are both observable.
 */
const frames = {
  queue: new Map<number, FrameRequestCallback>(),
  next: 1,
  requested: 0,
  cancelled: [] as number[],
  original: { raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame },
  install(): void {
    frames.queue.clear();
    frames.requested = 0;
    frames.cancelled = [];
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      const id = frames.next++;
      frames.requested++;
      frames.queue.set(id, cb);
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => {
      frames.cancelled.push(id);
      frames.queue.delete(id);
    }) as typeof window.cancelAnimationFrame;
  },
  restore(): void {
    window.requestAnimationFrame = frames.original.raf;
    window.cancelAnimationFrame = frames.original.caf;
    frames.queue.clear();
  },
  flush(): void {
    const due = [...frames.queue.entries()];
    frames.queue.clear();
    for (const [, cb] of due) cb(0);
  },
};

/** A layout pass reported by the observer, then the frame that applies it. */
async function reportAndFrame(observer: FakeResizeObserver | undefined, width: number): Promise<void> {
  observer?.report(width);
  frames.flush();
  await tick();
}

beforeAll(() => {
  app.set({});
});

beforeEach(() => {
  Notice.mockClear();
  helpers.showMobileNavMenu.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g5 — a config without frames renders as before", () => {
  it("no span, no height, the media keeps its ratio; the handle is the only addition", () => {
    const m = mountGallery();
    for (const r of records) {
      const card = m.card(r.id);
      expect(prop(card, "grid-column")).toBe("");
      expect(prop(card, "min-height")).toBe("");
      expect(prop(m.media(r.id), "height")).toBe("");
      expect(prop(m.media(r.id), "--ppp-card-media-ratio")).toBe("16 / 10");
      const lanes = Array.from(card.children).map((c) => c.className.split(/\s+/)[0]);
      expect(lanes).toEqual(["projects--gallery--card__media", "projects--gallery--card__body", "ppp-card-resize-handle"]);
    }
    m.destroy();
  });

  it("without a change handler there is no handle at all", () => {
    const m = mountGallery({}, { onConfigChange: undefined });
    expect(m.target.querySelector(".ppp-card-resize-handle")).toBeNull();
    m.destroy();
  });
});

describe("cards-g5 — heights per layout, and precedence", () => {
  it.each(["grid", "masonry", "list"])("%s: the view height sizes every media; an override wins for its card", (layout) => {
    const m = mountGallery({
      layout,
      cardFrame: { heightRem: 9 },
      cardFramesByRecord: { [ALPHA]: { heightRem: 20 } },
    });
    expect(prop(m.media(ALPHA), "height")).toBe("20rem");
    expect(prop(m.media("notes/Beta.md"), "height")).toBe("9rem");
    // A set height replaces the ratio, so the media keeps the card's width.
    expect(prop(m.media("notes/Beta.md"), "--ppp-card-media-ratio")).toBe("auto");
    // Not the card's own minimum: the media carries the height.
    expect(prop(m.card(ALPHA), "min-height")).toBe("");
    m.destroy();
  });

  it("with no media (ratio none) the height is the card's minimum", () => {
    const m = mountGallery({ coverAspectRatio: "none", cardFrame: { heightRem: 11 } });
    expect(m.media(ALPHA)).toBeNull();
    expect(prop(m.card(ALPHA), "min-height")).toBe("11rem");
    m.destroy();
  });

  it("an override's missing dimension inherits the view's", () => {
    const m = mountGallery({ cardFrame: { heightRem: 9, gridSpan: 2 }, cardFramesByRecord: { [ALPHA]: { gridSpan: 3 } } });
    expect(prop(m.media(ALPHA), "height")).toBe("9rem");
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 3/);
    expect(prop(m.card("notes/Beta.md"), "grid-column")).toMatch(/^span 2/);
    m.destroy();
  });

  it("invalid saved values render as no frame", () => {
    const m = mountGallery({ cardFrame: { heightRem: "tall", gridSpan: null }, cardFramesByRecord: { [ALPHA]: "big" } });
    expect(prop(m.media(ALPHA), "height")).toBe("");
    expect(prop(m.card(ALPHA), "grid-column")).toBe("");
    m.destroy();
  });
});

describe("cards-g5 — grid span", () => {
  beforeEach(() => frames.install());
  afterEach(() => {
    delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    FakeResizeObserver.all = [];
    frames.restore();
  });

  it("the column minimum is converted against the root of the window the grid is in", () => {
    // A popout may have its own root size; the measured column count uses the
    // same document, so both must agree.
    const grid = readFileSync(join(__dirname, "..", "components", "Grid", "Grid.svelte"), "utf8");
    expect(grid).toContain("toRem(cardWidth, section?.ownerDocument ?? document)");
    expect(grid).toContain("section.ownerDocument.defaultView?.ResizeObserver");
  });

  it("only the grid spans: masonry and list ignore it", () => {
    for (const layout of ["masonry", "list"]) {
      const m = mountGallery({ layout, cardFramesByRecord: { [ALPHA]: { gridSpan: 3 } } });
      expect(prop(m.card(ALPHA), "grid-column")).toBe("");
      m.destroy();
    }
  });

  it("is capped to the columns the grid lays out, and the saved value is kept", async () => {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    const m = mountGallery({ cardFramesByRecord: { [ALPHA]: { gridSpan: 3 } } });
    const observer = FakeResizeObserver.all[0];
    expect(observer).toBeDefined();

    // 300-wide columns (the default card width) in a 640-wide grid: two.
    await reportAndFrame(observer, 640);
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 2/);

    // Narrower than one column: no span at all.
    await reportAndFrame(observer, 280);
    expect(prop(m.card(ALPHA), "grid-column")).toBe("");

    // Wide again: the saved three come back, because nothing was rewritten.
    await reportAndFrame(observer, 1000);
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 3/);
    expect(m.onConfigChange).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a wider card width means fewer columns, and a tighter cap", async () => {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    const m = mountGallery({ cardWidth: 400, cardFramesByRecord: { [ALPHA]: { gridSpan: 4 } } });
    await reportAndFrame(FakeResizeObserver.all[0], 1000);
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 2/);
    m.destroy();
  });
});

describe("chrome-filters — the grid observer defers and coalesces its update", () => {
  beforeEach(() => {
    frames.install();
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    FakeResizeObserver.all = [];
    frames.restore();
  });

  it("nothing changes inside the observer callback; the next frame applies it", async () => {
    const m = mountGallery({ cardFramesByRecord: { [ALPHA]: { gridSpan: 3 } } });
    FakeResizeObserver.all[0]?.report(640);
    await tick();
    // Still uncapped: the width has been recorded, not applied.
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 3/);
    expect(frames.requested).toBe(1);
    frames.flush();
    await tick();
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 2/);
    m.destroy();
  });

  it("several callbacks before a frame are one frame and one recount, with the last width", async () => {
    const m = mountGallery({ cardFramesByRecord: { [ALPHA]: { gridSpan: 3 } } });
    const observer = FakeResizeObserver.all[0];
    observer?.report(1000);
    observer?.report(280);
    observer?.report(640);
    expect(frames.requested).toBe(1);
    expect(frames.queue.size).toBe(1);
    frames.flush();
    await tick();
    expect(prop(m.card(ALPHA), "grid-column")).toMatch(/^span 2/);
    // After the frame a new report asks for a new one.
    observer?.report(1000);
    expect(frames.requested).toBe(2);
    m.destroy();
  });

  it("a frame still pending when the grid is destroyed is cancelled", () => {
    const m = mountGallery();
    FakeResizeObserver.all[0]?.report(640);
    expect(frames.queue.size).toBe(1);
    const [pending] = [...frames.queue.keys()];
    m.destroy();
    expect(frames.cancelled).toContain(pending);
    expect(frames.queue.size).toBe(0);
  });

  it("the frame is the grid's own window's, requested from the owner document", () => {
    const grid = readFileSync(join(__dirname, "..", "components", "Grid", "Grid.svelte"), "utf8");
    expect(grid).toContain("section.ownerDocument.defaultView");
    expect(grid).toMatch(/view\.requestAnimationFrame\(flush\)/);
    expect(grid).toMatch(/view\.cancelAnimationFrame\(frame\)/);
  });
});

describe("cards-g5 — resizing a card writes the config once", () => {
  it("moves preview without writes; the release calls onConfigChange once with the override", async () => {
    const m = mountGallery({ layout: "grid", cardFrame: { heightRem: 10 } });
    const handle = m.handle(ALPHA);
    handle.dispatchEvent(pointer("pointerdown", 50, 50));
    handle.dispatchEvent(pointer("pointermove", 50, 82));
    await tick();
    // The preview is live on the card it belongs to, and only there.
    expect(prop(m.media(ALPHA), "height")).toBe("12rem");
    expect(prop(m.media("notes/Beta.md"), "height")).toBe("10rem");
    expect(m.onConfigChange).not.toHaveBeenCalled();

    handle.dispatchEvent(pointer("pointerup", 50, 82));
    await tick();
    expect(m.onConfigChange).toHaveBeenCalledTimes(1);
    const saved = m.onConfigChange.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(saved).toEqual({
      coverField: "cover",
      includeFields: ["status"],
      layout: "grid",
      cardFrame: { heightRem: 10 },
      cardFramesByRecord: { [ALPHA]: { heightRem: 12 } },
    });
    // The saved frame stays on screen after the preview ends.
    expect(prop(m.media(ALPHA), "height")).toBe("12rem");
    m.destroy();
  });

  it("a cancelled drag restores the card and writes nothing", async () => {
    const m = mountGallery({ cardFrame: { heightRem: 10 } });
    const handle = m.handle(ALPHA);
    handle.dispatchEvent(pointer("pointerdown", 50, 50));
    handle.dispatchEvent(pointer("pointermove", 50, 114));
    await tick();
    expect(prop(m.media(ALPHA), "height")).toBe("14rem");
    handle.dispatchEvent(pointer("pointercancel", 50, 114));
    await tick();
    expect(prop(m.media(ALPHA), "height")).toBe("10rem");
    expect(m.onConfigChange).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a key action writes once; Delete removes the override", async () => {
    const m = mountGallery({ cardFramesByRecord: { [ALPHA]: { heightRem: 15 } } });
    m.handle(ALPHA).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    expect(m.onConfigChange).toHaveBeenCalledTimes(1);
    expect((m.onConfigChange.mock.calls[0]?.[0] as Record<string, unknown>)["cardFramesByRecord"]).toEqual({ [ALPHA]: { heightRem: 16 } });
    await tick();
    m.handle(ALPHA).dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
    expect(m.onConfigChange).toHaveBeenCalledTimes(2);
    expect((m.onConfigChange.mock.calls[1]?.[0] as Record<string, unknown>)["cardFramesByRecord"]).toBeUndefined();
    await tick();
    expect(prop(m.media(ALPHA), "height")).toBe("");
    m.destroy();
  });

  it("a new override past the cap is refused with a notice; nothing is written or evicted", () => {
    const byRecord: Record<string, { heightRem: number }> = {};
    for (let i = 0; i < 500; i++) byRecord[`elsewhere/${i}.md`] = { heightRem: 8 };
    const m = mountGallery({ cardFramesByRecord: byRecord });
    m.handle(ALPHA).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    expect(m.onConfigChange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledTimes(1);
    expect(Object.keys(byRecord)).toHaveLength(500);
    m.destroy();
  });
});

describe("cards-g5 — persistence", () => {
  it("a serialized config, reloaded, reproduces the frames", async () => {
    const first = mountGallery({ cardFrame: { heightRem: 10 } });
    const handle = first.handle(ALPHA);
    handle.dispatchEvent(pointer("pointerdown", 0, 0));
    handle.dispatchEvent(pointer("pointermove", 0, 48));
    handle.dispatchEvent(pointer("pointerup", 0, 48));
    await tick();
    const saved = JSON.parse(JSON.stringify(first.onConfigChange.mock.calls[0]?.[0])) as Record<string, unknown>;
    first.destroy();

    const reopened = mountGallery(saved);
    expect(prop(reopened.media(ALPHA), "height")).toBe("13rem");
    expect(prop(reopened.media("notes/Beta.md"), "height")).toBe("10rem");
    reopened.destroy();
  });

  it("the standalone view and the dashboard block both hand the gallery its change handler", () => {
    const root = join(__dirname, "..", "..");
    const standalone = readFileSync(join(root, "Gallery", "galleryView.ts"), "utf8");
    expect(standalone).toMatch(/onConfigChange: props\.saveConfig/);
    const block = readFileSync(join(root, "Dashboard", "widgets", "DatabaseCall", "DatabaseCallBlock.svelte"), "utf8");
    expect(block).toMatch(/onConfigChange=\{handleGalleryConfigChange\}/);
    expect(block).toMatch(/function handleGalleryConfigChange\(cfg: GalleryConfig\) \{\s*handleViewConfigChange\(/);
  });

  it("GalleryView no longer parks onConfigChange as unused", () => {
    const view = readFileSync(join(__dirname, "..", "GalleryView.svelte"), "utf8");
    expect(view).not.toMatch(/\$: void onConfigChange/);
    expect(view).toMatch(/onConfigChange\?\.\(next\)/);
  });
});

describe("cards-g5 — the handle never starts the gallery long press", () => {
  function setPointer(kind: "coarse" | "fine"): void {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === `(pointer: ${kind})`,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const stop = watchViewport();
    stop();
    window.matchMedia = original;
  }

  function touch(type: string): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: 10, clientY: 10 }] });
    return event;
  }

  beforeAll(() => setPointer("coarse"));
  afterAll(() => setPointer("fine"));
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("a held touch on the handle of a card that is itself the long-press target opens no menu", () => {
    const m = mountGallery({ coverAspectRatio: "none" });
    m.handle(ALPHA).dispatchEvent(touch("touchstart"));
    jest.advanceTimersByTime(600);
    expect(helpers.showMobileNavMenu).not.toHaveBeenCalled();
    // The same hold on the card body does.
    m.card(ALPHA).querySelector(".projects--gallery--card__body")?.dispatchEvent(touch("touchstart"));
    jest.advanceTimersByTime(600);
    expect(helpers.showMobileNavMenu).toHaveBeenCalledTimes(1);
    m.destroy();
  });
});
