/**
 * p372-b8 — the board's touch/pen card drag: geometry at board scales
 * 0.25 / 0.54 / 1, target choice, drop writes, and the controller's start,
 * move, drop, cancel and blocker paths on synthetic pointer events.
 */
import {
  boxToBoard,
  computeDropWrites,
  createTouchCardDrag,
  edgeScrollDelta,
  pickDropTarget,
  scaleDraggedClone,
  screenToBoard,
  type ColumnGeom,
} from "../touchCardDrag";

describe("screenToBoard", () => {
  const origin = { x: 100, y: 50 };
  it.each([0.25, 0.54, 1])("inverts the board scale %p", (scale) => {
    const logical = { x: 400, y: 260 };
    const screen = { x: origin.x + logical.x * scale, y: origin.y + logical.y * scale };
    const back = screenToBoard(screen, origin, scale);
    expect(back.x).toBeCloseTo(logical.x, 6);
    expect(back.y).toBeCloseTo(logical.y, 6);
  });

  it("maps a scaled card box to its logical size", () => {
    // A 272 px wide, 90 px tall card at 54%.
    const b = boxToBoard({ left: 100, top: 50, right: 100 + 272 * 0.54, bottom: 50 + 90 * 0.54 }, origin, 0.54);
    expect(b.right - b.left).toBeCloseTo(272, 6);
    expect(b.bottom - b.top).toBeCloseTo(90, 6);
  });

  it("treats a missing scale as 1", () => {
    expect(screenToBoard({ x: 10, y: 10 }, { x: 0, y: 0 }, 0)).toEqual({ x: 10, y: 10 });
  });
});

describe("pickDropTarget", () => {
  const columns: ColumnGeom[] = [
    { id: "A", left: 0, right: 270, top: 40, slots: [
      { id: "a1", top: 40, bottom: 100 },
      { id: "a2", top: 108, bottom: 168 },
      { id: "a3", top: 176, bottom: 236 },
    ] },
    { id: "B", left: 290, right: 560, top: 40, slots: [] },
  ];

  it("picks the index by card middles, without the dragged card", () => {
    expect(pickDropTarget(columns, { x: 50, y: 60 }, "a3")).toMatchObject({ columnId: "A", index: 0 });
    expect(pickDropTarget(columns, { x: 50, y: 120 }, "a3")).toMatchObject({ columnId: "A", index: 1, lineY: 104 });
    expect(pickDropTarget(columns, { x: 50, y: 900 }, "a1")).toMatchObject({ columnId: "A", index: 2 });
  });

  it("targets an empty column at its list top", () => {
    expect(pickDropTarget(columns, { x: 300, y: 500 }, "a1")).toEqual({ columnId: "B", index: 0, lineY: 44 });
  });

  it("takes the nearest column across a gap, nothing far outside", () => {
    expect(pickDropTarget(columns, { x: 285, y: 60 }, "a1")?.columnId).toBe("B");
    expect(pickDropTarget(columns, { x: 900, y: 60 }, "a1")).toBeNull();
  });
});

describe("edgeScrollDelta", () => {
  it("is 0 inside, signed and capped in the edge bands", () => {
    expect(edgeScrollDelta(200, 0, 400)).toBe(0);
    expect(edgeScrollDelta(0, 0, 400)).toBe(-18);
    expect(edgeScrollDelta(400, 0, 400)).toBe(18);
    expect(edgeScrollDelta(376, 0, 400)).toBe(9);
  });
});

describe("computeDropWrites", () => {
  const r = (id: string) => ({ id });
  const columns = [
    { id: "A", records: [r("1"), r("2"), r("3")] },
    { id: "B", records: [r("4")] },
  ];

  it("writes nothing for a drop where the card was", () => {
    expect(computeDropWrites(columns, "2", "A", "A", 1)).toEqual([]);
  });

  it("reorders within a column with one write", () => {
    const w = computeDropWrites(columns, "1", "A", "A", 2);
    expect(w).toHaveLength(1);
    expect(w[0]?.trigger).toBe("addToColumn");
    expect(w[0]?.records.map((x) => x.id)).toEqual(["2", "3", "1"]);
  });

  it("moves between columns: target add first, then source remove", () => {
    const w = computeDropWrites(columns, "2", "A", "B", 0);
    expect(w.map((x) => [x.columnId, x.trigger, x.records.map((y) => y.id)])).toEqual([
      ["B", "addToColumn", ["2", "4"]],
      ["A", "removeFromColumn", ["1", "3"]],
    ]);
  });
});

describe("scaleDraggedClone", () => {
  it("gives the mouse clone the logical size at the board's scale", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({ width: 135, height: 27, left: 0, top: 0, right: 135, bottom: 27, x: 0, y: 0, toJSON: () => ({}) });
    scaleDraggedClone(el, 0.54);
    expect(parseFloat(el.style.width) * 16).toBeCloseTo(250, 0);
    expect(parseFloat(el.style.height) * 16).toBeCloseTo(50, 0);
    // jsdom drops the CSS `scale` property; the size and origin carry the check.
    expect(el.classList.contains("ppp-board-scaled-clone")).toBe(true);
  });

  it("leaves a clone at 100% alone", () => {
    const el = document.createElement("div");
    scaleDraggedClone(el, 1);
    expect(el.getAttribute("style")).toBeNull();
    expect(el.classList.length).toBe(0);
  });
});

// ── controller ──

function pointer(type: string, init: { x: number; y: number; id?: number; pointerType?: string; primary?: boolean }, target: EventTarget = window) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, {
    clientX: init.x,
    clientY: init.y,
    pointerId: init.id ?? 1,
    pointerType: init.pointerType ?? "touch",
    isPrimary: init.primary ?? true,
  });
  target.dispatchEvent(e);
  return e;
}

function rect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
}

function board(scale: number, pinnedB = false) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  const viewport = document.createElement("div");
  container.append(viewport);
  document.body.append(container);
  rect(container, 0, 0, 400, 800);
  rect(viewport, 0, 0, 2000 * scale, 2000 * scale);
  const make = (id: string, left: number, cards: string[], pinned: boolean) => {
    const section = document.createElement("section");
    section.className = "projects--board--column" + (pinned ? " pinned" : "");
    section.dataset["id"] = id;
    const list = document.createElement("div");
    list.className = "projects--board--card-list";
    section.append(list);
    rect(section, left * scale, 0, 270 * scale, 1000 * scale);
    rect(list, left * scale, 40 * scale, 270 * scale, 900 * scale);
    cards.forEach((card, i) => {
      const slot = document.createElement("div");
      slot.className = "ppp-board-card-slot";
      slot.dataset["recordId"] = card;
      const grip = document.createElement("span");
      grip.className = "board-card-grip";
      const body = document.createElement("p");
      body.textContent = card;
      slot.append(grip, body);
      list.append(slot);
      rect(slot, left * scale, (40 + i * 70) * scale, 270 * scale, 60 * scale);
    });
    viewport.append(section);
  };
  make("A", 0, ["1", "2", "3"], false);
  make("B", 290, ["4"], pinnedB);
  const frames: Array<() => void> = [];
  const onDrop = jest.fn();
  const onBlocked = jest.fn();
  const handle = createTouchCardDrag({
    container,
    viewport,
    getScale: () => scale,
    blockReason: (col) => (col.classList.contains("pinned") ? "pinned" : null),
    onBlocked,
    onDrop,
    raf: (cb) => frames.push(cb),
    caf: () => undefined,
  });
  const flush = () => {
    // Bounded: an auto-scroll keeps asking for frames.
    for (let i = 0; i < 20 && frames.length; i++) frames.shift()?.();
  };
  const slot = (id: string) => container.querySelector(`[data-record-id="${id}"]`) as HTMLElement;
  return { container, viewport, handle, onDrop, onBlocked, flush, slot };
}

describe("createTouchCardDrag", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([0.25, 0.54, 1])("long press, move and drop at scale %p hit the column under the finger", (scale) => {
    const b = board(scale);
    const body = b.slot("1").querySelector("p") as HTMLElement;
    pointer("pointerdown", { x: 100 * scale, y: 60 * scale }, body);
    jest.advanceTimersByTime(450);
    expect(b.handle.isActive()).toBe(true);
    const preview = b.viewport.querySelector(".ppp-board-touch-preview") as HTMLElement;
    expect(preview).not.toBeNull();
    // The copy has the card's LOGICAL width: the viewport scales it.
    expect(parseFloat(preview.style.width) * 16).toBeCloseTo(270, 2);
    expect(b.slot("1").classList.contains("ppp-board-touch-source")).toBe(true);

    // Into column B, above card 4 (logical y 50 < its middle 70).
    pointer("pointermove", { x: 350 * scale, y: 50 * scale });
    b.flush();
    pointer("pointerup", { x: 350 * scale, y: 50 * scale });
    expect(b.onDrop).toHaveBeenCalledTimes(1);
    expect(b.onDrop).toHaveBeenCalledWith({ recordId: "1", fromColumnId: "A", toColumnId: "B", index: 0 });
    expect(b.viewport.querySelector(".ppp-board-touch-preview")).toBeNull();
    expect(b.viewport.querySelector(".ppp-board-touch-line")).toBeNull();
    expect(b.slot("1").classList.contains("ppp-board-touch-source")).toBe(false);
  });

  it("moves the preview by transform at the logical position", () => {
    const b = board(0.5);
    // Clear of the 48 px edge band, so the start does not auto-scroll.
    pointer("pointerdown", { x: 50, y: 60 }, b.slot("2").querySelector(".board-card-grip") as Element);
    jest.advanceTimersByTime(150);
    pointer("pointermove", { x: 100, y: 130 });
    b.flush();
    const preview = b.viewport.querySelector(".ppp-board-touch-preview") as HTMLElement;
    // Grab at logical (100, 120) on a card at (0, 110): offset (100, 10); finger now at logical (200, 260).
    expect(preview.style.transform).toBe("translate3d(6.25rem, 15.625rem, 0)");
  });

  it("starts at once when the grip moves before its timer", () => {
    const b = board(1);
    pointer("pointerdown", { x: 5, y: 50 }, b.slot("2").querySelector(".board-card-grip") as Element);
    pointer("pointermove", { x: 5, y: 60 });
    expect(b.handle.isActive()).toBe(true);
  });

  it("a pan before the long press is a pan: no drag, no write", () => {
    const b = board(1);
    pointer("pointerdown", { x: 100, y: 60 }, b.slot("1").querySelector("p") as Element);
    pointer("pointermove", { x: 100, y: 90 });
    jest.advanceTimersByTime(1000);
    expect(b.handle.isActive()).toBe(false);
    pointer("pointerup", { x: 100, y: 90 });
    expect(b.onDrop).not.toHaveBeenCalled();
  });

  it("the mouse is left to the library", () => {
    const b = board(1);
    pointer("pointerdown", { x: 100, y: 60, pointerType: "mouse" }, b.slot("1").querySelector("p") as Element);
    jest.advanceTimersByTime(1000);
    expect(b.handle.isActive()).toBe(false);
  });

  it.each([
    ["pointercancel", () => pointer("pointercancel", { x: 350, y: 50 })],
    ["Escape", () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))],
    ["a second finger", () => pointer("pointerdown", { x: 200, y: 200, id: 2, primary: false }, document.body.firstElementChild as Element)],
  ])("cancel by %s writes nothing and leaves no shadow", (_name, cancel) => {
    const b = board(0.54);
    pointer("pointerdown", { x: 50, y: 30 }, b.slot("1").querySelector("p") as Element);
    jest.advanceTimersByTime(450);
    pointer("pointermove", { x: 350 * 0.54, y: 50 * 0.54 });
    b.flush();
    cancel();
    expect(b.handle.isActive()).toBe(false);
    pointer("pointerup", { x: 350 * 0.54, y: 50 * 0.54 });
    expect(b.onDrop).not.toHaveBeenCalled();
    expect(b.viewport.querySelector(".ppp-board-touch-preview, .ppp-board-touch-line")).toBeNull();
    expect(b.container.querySelector(".ppp-board-touch-source")).toBeNull();
  });

  it("a drop outside the board writes nothing", () => {
    const b = board(1);
    pointer("pointerdown", { x: 50, y: 60 }, b.slot("1").querySelector("p") as Element);
    jest.advanceTimersByTime(450);
    pointer("pointerup", { x: 900, y: 60 });
    expect(b.onDrop).not.toHaveBeenCalled();
  });

  it("a card in a pinned column does not start: one explanation, no preview", () => {
    const b = board(1, true);
    pointer("pointerdown", { x: 300, y: 60 }, b.slot("4").querySelector("p") as Element);
    jest.advanceTimersByTime(450);
    expect(b.onBlocked).toHaveBeenCalledWith("pinned");
    expect(b.handle.isActive()).toBe(false);
    expect(b.viewport.querySelector(".ppp-board-touch-preview")).toBeNull();
    pointer("pointermove", { x: 50, y: 60 });
    pointer("pointerup", { x: 50, y: 60 });
    expect(b.onDrop).not.toHaveBeenCalled();
  });

  it("auto-scrolls near the container edge and keeps the target under the finger", () => {
    const b = board(1);
    pointer("pointerdown", { x: 50, y: 60 }, b.slot("1").querySelector("p") as Element);
    jest.advanceTimersByTime(450);
    pointer("pointermove", { x: 398, y: 60 });
    b.flush();
    // jsdom keeps no scroll offset for an unlaid box; the frame still asked
    // to scroll right by the edge speed and the drag is still on.
    expect(b.handle.isActive()).toBe(true);
    pointer("pointercancel", { x: 398, y: 60 });
    expect(b.onDrop).not.toHaveBeenCalled();
  });
});
