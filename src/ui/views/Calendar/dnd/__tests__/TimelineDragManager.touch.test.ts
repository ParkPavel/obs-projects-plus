/**
 * ios-d1 — the touch gesture on a timeline event bar.
 *
 * Measured live before this file: a 700 ms press on a bar followed by a move
 * opened the record instead of moving the event. These cases pin the three
 * outcomes a finger can mean, against the manager EventBar drives:
 *
 *   - a short tap is a click: the release must stay default, or the browser
 *     drops the click that opens the record;
 *   - a long press arms the drag: the move that follows moves the event (not
 *     its edge, wherever the finger travels), and the click the browser may
 *     still send after the release is swallowed;
 *   - a pan that starts before the long press belongs to the scroller: it must
 *     never be promoted into a drag later, even when it is slow.
 *
 * Geometry: remPx 16 and 3 rem per hour, so one hour is 48 CSS pixels and the
 * 10:00–11:00 bar spans y 480–528 in a column whose top is at y 0.
 */

import dayjs from "dayjs";
import { get } from "svelte/store";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import {
  TimelineDragManager,
  barDragView,
  type BarDragView,
  type OnDragCommit,
} from "../TimelineDragManager";
import { DND_CONSTANTS } from "../types";
import { EventRenderType, type ProcessedRecord } from "../../types";

const REM_PX = 16;
const HOUR_PX = 3 * REM_PX;
const BAR_TOP = 10 * HOUR_PX;
const BAR_CENTRE_Y = BAR_TOP + HOUR_PX / 2;
const X = 50;

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function placed<T extends HTMLElement>(el: T, box: DOMRect): T {
  Object.defineProperty(el, "getBoundingClientRect", { value: () => box });
  document.body.appendChild(el);
  return el;
}

/** jsdom has no `Touch` constructor; the manager only reads the coordinates. */
function touch(type: string, y: number, cancelable = true): TouchEvent {
  const ev = new Event(type, { bubbles: true, cancelable });
  const point = [{ clientX: X, clientY: y }];
  const ended = type === "touchend" || type === "touchcancel";
  Object.defineProperty(ev, "touches", { value: ended ? [] : point });
  Object.defineProperty(ev, "changedTouches", { value: point });
  return ev as TouchEvent;
}

function mouse(type: string, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: X, clientY: y, button: 0 });
}

describe("TimelineDragManager — touch gesture on an event bar (ios-d1)", () => {
  const start = dayjs("2026-10-02T10:00");
  const record: DataRecord = { id: "visits/visit.md", values: {} };
  const processed: ProcessedRecord = {
    record,
    renderType: EventRenderType.TIMED,
    startDate: start,
    endDate: null,
    timeInfo: {
      startTime: start,
      endTime: start.add(1, "hour"),
      durationMinutes: 60,
      hasEmbeddedTime: true,
    },
    spanInfo: null,
    color: null,
    lane: 0,
  };

  let manager: TimelineDragManager;
  let onCommit: jest.Mock<void, Parameters<OnDragCommit>>;
  let bar: HTMLButtonElement;
  let onClick: jest.Mock<void, [Event]>;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimelineDragManager();
    onCommit = jest.fn<void, Parameters<OnDragCommit>>();
    manager.configure(
      { startHour: 0, endHour: 24, hourHeightRem: 3, remPx: REM_PX, isMobile: true },
      onCommit
    );
    const column = placed(document.createElement("div"), rect(0, 0, 100, 24 * HOUR_PX));
    manager.setDayColumns([{ day: start.startOf("day"), element: column }]);
    bar = placed(document.createElement("button"), rect(BAR_TOP, 10, 80, HOUR_PX));
    bar.dataset["recordId"] = record.id; // as EventBar renders it
    onClick = jest.fn<void, [Event]>();
    bar.addEventListener("click", onClick);
  });

  afterEach(() => {
    manager.destroy();
    // Let any pending click guard expire so it cannot leak into the next case.
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  const press = (y = BAR_CENTRE_Y): void => {
    manager.initiate(record, processed, touch("touchstart", y), "move", bar);
  };

  const clickBar = (): void => {
    bar.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  };

  describe("short tap", () => {
    it("leaves the release default, so the click that opens the record arrives", () => {
      press();
      jest.advanceTimersByTime(120);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);

      expect(end.defaultPrevented).toBe(false);
      expect(get(manager.state)).toBe("idle");
      clickBar();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a tap right after a drag of the same bar (quick re-grab) still opens it", () => {
      // The re-grab skips the long-press wait so a second drag can start at
      // once; a finger that only taps it again is still asking for the record.
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        bar.dispatchEvent(touch("touchmove", y));
      }
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      jest.advanceTimersByTime(1000); // past the click guard, inside the re-grab window
      expect(get(manager.longPressActive)).toBe(true);

      press();
      jest.advanceTimersByTime(120);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(false);
      clickBar();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("long press, then move", () => {
    it("moves the event — not its edge — and swallows the click after the release", () => {
      press();
      // The live probe held for 700 ms; the threshold is shorter.
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      expect(get(manager.longPressActive)).toBe(true);

      // Down by one hour in small steps, as a finger travels.
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        const move = touch("touchmove", y);
        bar.dispatchEvent(move);
        expect(move.defaultPrevented).toBe(true);
      }
      expect(get(manager.state)).toBe("dragging");
      expect(get(manager.activeMode)).toBe("move");

      const end = touch("touchend", BAR_CENTRE_Y + HOUR_PX);
      bar.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);

      expect(onCommit).toHaveBeenCalledTimes(1);
      const call = onCommit.mock.calls[0];
      expect(call?.[1]).toBe(record);
      expect(call?.[2]).toEqual(
        expect.objectContaining({ startTime: "11:30", endTime: "12:30" })
      );

      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });

    it("a long press released without a move opens nothing", () => {
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);

      expect(end.defaultPrevented).toBe(true);
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("the guard is this gesture's: a tap elsewhere right after the release goes through", () => {
      // The cancelled touchend sends no click, so nothing consumes the guard;
      // it must not swallow the next tap on a different event or control.
      const other = placed(document.createElement("button"), rect(900, 10, 80, HOUR_PX));
      const onOther = jest.fn<void, [Event]>();
      other.addEventListener("click", onOther);

      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y));
      jest.advanceTimersByTime(100); // well inside the guard window

      other.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, clientX: X, clientY: 924 })
      );
      expect(onOther).toHaveBeenCalledTimes(1);
      // …while a click that does belong to the gesture is still taken.
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });

    it("an adjacent event tapped at the release point right after the release opens", () => {
      // Bar B touches bar A's bottom edge; its click lands within a fingertip
      // of where A was released. Identity, not distance, decides.
      const barB = placed(document.createElement("button"), rect(BAR_TOP + HOUR_PX, 10, 80, HOUR_PX));
      barB.dataset["recordId"] = "visits/other.md";
      const onB = jest.fn<void, [Event]>();
      barB.addEventListener("click", onB);

      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y));
      jest.advanceTimersByTime(100);

      barB.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, clientX: X, clientY: BAR_TOP + HOUR_PX + 2 })
      );
      expect(onB).toHaveBeenCalledTimes(1);
    });

    it("the click on the bar re-rendered by the commit is still swallowed", () => {
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        bar.dispatchEvent(touch("touchmove", y));
      }
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      expect(onCommit).toHaveBeenCalledTimes(1);

      // The commit changes the bar's key, so Svelte replaces the element.
      bar.remove();
      const rerendered = placed(document.createElement("button"), rect(BAR_TOP + HOUR_PX, 10, 80, HOUR_PX));
      rerendered.dataset["recordId"] = record.id;
      const onRerendered = jest.fn<void, [Event]>();
      rerendered.addEventListener("click", onRerendered);
      rerendered.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(onRerendered).not.toHaveBeenCalled();
    });
  });

  describe("pan before the threshold", () => {
    it("a pan past the touch slop is the scroller's and is never promoted into a drag", () => {
      press();
      jest.advanceTimersByTime(100);
      const pan = touch("touchmove", BAR_CENTRE_Y + 16);
      bar.dispatchEvent(pan);
      expect(pan.defaultPrevented).toBe(false);
      expect(get(manager.state)).toBe("idle");

      // A slow pan keeps the finger down past the long-press threshold.
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS * 2);
      expect(get(manager.longPressActive)).toBe(false);
      const more = touch("touchmove", BAR_CENTRE_Y + 64);
      bar.dispatchEvent(more);
      expect(more.defaultPrevented).toBe(false);

      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + 64));
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a move the browser already scrolls with (not cancelable) drops the pending press", () => {
      press();
      jest.advanceTimersByTime(100);
      bar.dispatchEvent(touch("touchmove", BAR_CENTRE_Y + 4, false));
      expect(get(manager.state)).toBe("idle");

      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS * 2);
      expect(get(manager.longPressActive)).toBe(false);
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("mouse, unchanged", () => {
    it("drags at once and swallows the click that follows the mouseup", () => {
      manager.initiate(record, processed, mouse("mousedown", BAR_CENTRE_Y), "move", bar);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        document.dispatchEvent(mouse("mousemove", y));
      }
      expect(get(manager.state)).toBe("dragging");
      document.dispatchEvent(mouse("mouseup", BAR_CENTRE_Y + HOUR_PX));

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]?.[2]).toEqual(
        expect.objectContaining({ startTime: "11:30", endTime: "12:30" })
      );
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  /**
   * ios-p1 — measured live: after a touch drag the bar stayed dimmed, with
   * `pointer-events: none`, through the whole re-grab window, because one flag
   * drove both the dimming and the handles. `barDragView` keeps them apart;
   * these cases read it from the manager's own stores at each phase, exactly
   * as EventBarContainer does, so they pin what the bar shows, not a shape.
   */
  describe("what the bar shows through a drag (ios-p1)", () => {
    const OTHER_ID = "visits/other.md";
    const viewOf = (id: string): BarDragView =>
      barDragView(id, get(manager.dragRecordId), get(manager.draggedRecordId), get(manager.longPressActive));
    const NEITHER: BarDragView = { dimmed: false, handlesVisible: false };

    const touchDragOneHour = (): void => {
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        bar.dispatchEvent(touch("touchmove", y));
      }
    };

    it("touch: armed → handles only; dragging → dimmed and handles; re-grab window → handles only; expiry → neither", () => {
      expect(viewOf(record.id)).toEqual(NEITHER);

      press();
      // A short press is not yet a drag: the bar stays as it was.
      jest.advanceTimersByTime(120);
      expect(viewOf(record.id)).toEqual(NEITHER);

      // The long press arms the drag: handles, no dimming, still hit-testable.
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS);
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });

      // The active drag dims the origin bar and keeps its handles.
      touchDragOneHour();
      expect(get(manager.state)).toBe("dragging");
      expect(viewOf(record.id)).toEqual({ dimmed: true, handlesVisible: true });
      expect(viewOf(OTHER_ID)).toEqual(NEITHER);

      // The release opens the re-grab window: not dimmed, handles stay.
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });
      jest.advanceTimersByTime(1000);
      expect(get(manager.longPressActive)).toBe(true);
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });
      // Only the dragged record's bar shows the window.
      expect(viewOf(OTHER_ID)).toEqual(NEITHER);

      // The window expires (4 s after the release): back to normal.
      jest.advanceTimersByTime(3100);
      expect(get(manager.longPressActive)).toBe(false);
      expect(viewOf(record.id)).toEqual(NEITHER);
    });

    it("touch: a re-grab inside the window dims again only once the second drag runs", () => {
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      touchDragOneHour();
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      jest.advanceTimersByTime(1000);

      press(); // quick re-grab: armed at once, no long-press wait
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });
      touchDragOneHour();
      expect(get(manager.state)).toBe("dragging");
      expect(viewOf(record.id)).toEqual({ dimmed: true, handlesVisible: true });
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });
    });

    it("touch: a long press released without a move leaves neither state behind", () => {
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      expect(viewOf(record.id)).toEqual({ dimmed: false, handlesVisible: true });
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y));
      // No drag ran, so no re-grab window opens.
      expect(viewOf(record.id)).toEqual(NEITHER);
    });

    it("mouse, unchanged: dimmed exactly while the drag runs, never handles, nothing after", () => {
      manager.initiate(record, processed, mouse("mousedown", BAR_CENTRE_Y), "move", bar);
      // Pending press: the bar stays hit-testable (ios-c1).
      expect(viewOf(record.id)).toEqual(NEITHER);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        document.dispatchEvent(mouse("mousemove", y));
      }
      expect(get(manager.state)).toBe("dragging");
      expect(viewOf(record.id)).toEqual({ dimmed: true, handlesVisible: false });

      document.dispatchEvent(mouse("mouseup", BAR_CENTRE_Y + HOUR_PX));
      // The manager keeps `dragRecordId` for the window, but a mouse never
      // arms `longPressActive`, so the bar shows nothing.
      expect(get(manager.dragRecordId)).toBe(record.id);
      expect(viewOf(record.id)).toEqual(NEITHER);
      jest.advanceTimersByTime(1000);
      expect(viewOf(record.id)).toEqual(NEITHER);
    });
  });
});

describe("barDragView — the rule itself (ios-p1)", () => {
  const ID = "a.md";
  it("dims only the record whose drag runs", () => {
    expect(barDragView(ID, ID, ID, false).dimmed).toBe(true);
    expect(barDragView(ID, ID, null, true).dimmed).toBe(false);
    expect(barDragView(ID, "b.md", "b.md", true).dimmed).toBe(false);
  });

  it("shows handles only for the pressed record while a long press is armed", () => {
    expect(barDragView(ID, ID, null, true).handlesVisible).toBe(true);
    expect(barDragView(ID, ID, ID, false).handlesVisible).toBe(false);
    expect(barDragView(ID, "b.md", null, true).handlesVisible).toBe(false);
    expect(barDragView(ID, null, null, true).handlesVisible).toBe(false);
  });
});

/**
 * ios-c1 — a click or tap on a calendar strip segment opens its record.
 *
 * Traced live: the press arrived on the segment, the release and the click on
 * the `.multiday-lane` beneath it, so the segment's click handler never ran.
 * The segment had dimmed itself with `pointer-events: none` on the PRESS,
 * because it followed `dragRecordId`, which the manager sets while the session
 * is only pending. `draggedRecordId` is set only once a drag has started; the
 * segment takes itself out of hit-testing from it. jsdom does no hit-testing,
 * so these cases pin that contract and the click outcomes on the segment.
 *
 * Geometry: seven 100-wide day columns from x 0 (Mon 5 – Sun 11 Oct 2026); the
 * two-day strip covers Tue 6 – Wed 7 and its start segment is column 1.
 */
describe("TimelineDragManager — press and drag on a strip segment (ios-c1)", () => {
  const WEEK_START = dayjs("2026-10-05");
  const SEG_X = 150;
  const STRIP_Y = 20;
  const record: DataRecord = { id: "trips/trip.md", values: {} };
  const spanStart = WEEK_START.add(1, "day");
  const spanEnd = WEEK_START.add(2, "day");
  const processed: ProcessedRecord = {
    record,
    renderType: EventRenderType.MULTI_DAY_ALLDAY,
    startDate: spanStart,
    endDate: spanEnd,
    timeInfo: null,
    spanInfo: { startDate: spanStart, endDate: spanEnd, spanDays: 2 },
    color: null,
    lane: 0,
  };

  let manager: TimelineDragManager;
  let onCommit: jest.Mock<void, Parameters<OnDragCommit>>;
  let segment: HTMLButtonElement;
  let onOpen: jest.Mock<void, [Event]>;
  const globals = globalThis as unknown as { activeDocument?: Document };
  let hadActiveDocument = false;

  /** The manager's day lookup reads Obsidian's `activeDocument` and the hit-test API. */
  beforeAll(() => {
    hadActiveDocument = "activeDocument" in globals;
    if (!hadActiveDocument) globals.activeDocument = document;
    if (typeof document.elementsFromPoint !== "function") {
      Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: () => [] });
    }
  });

  afterAll(() => {
    if (!hadActiveDocument) delete globals.activeDocument;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimelineDragManager();
    onCommit = jest.fn<void, Parameters<OnDragCommit>>();
    manager.configure({ startHour: 0, endHour: 24, hourHeightRem: 0, remPx: REM_PX, isMobile: true }, onCommit);
    const columns = Array.from({ length: 7 }, (_, i) => ({
      day: WEEK_START.add(i, "day"),
      element: placed(document.createElement("div"), rect(0, i * 100, 100, 40)),
    }));
    manager.setDayColumns(columns);
    segment = placed(document.createElement("button"), rect(10, 100, 100, 20));
    onOpen = jest.fn<void, [Event]>();
    // HeaderStripsSection: `on:click={() => onRecordClick?.(segment.record)}`
    segment.addEventListener("click", onOpen);
  });

  afterEach(() => {
    manager.destroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  const mouseAt = (type: string, x: number): MouseEvent =>
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: STRIP_Y, button: 0 });

  const touchAt = (type: string, x: number): TouchEvent => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const point = [{ clientX: x, clientY: STRIP_Y }];
    const ended = type === "touchend" || type === "touchcancel";
    Object.defineProperty(ev, "touches", { value: ended ? [] : point });
    Object.defineProperty(ev, "changedTouches", { value: point });
    return ev as TouchEvent;
  };

  const clickSegment = (): void => {
    segment.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  };

  /** Two columns to the right, in small steps. */
  const mouseDragTo = (toX: number): void => {
    for (let x = SEG_X + 10; x <= toX; x += 10) document.dispatchEvent(mouseAt("mousemove", x));
  };

  describe("mouse", () => {
    it("a press and release without a move keeps the segment hit-testable and opens the record", () => {
      manager.initiate(record, processed, mouseAt("mousedown", SEG_X), "strip-move", segment);
      expect(get(manager.state)).toBe("pending");
      expect(get(manager.dragRecordId)).toBe(record.id);
      // What the segment dims and drops pointer events from: nothing yet.
      expect(get(manager.draggedRecordId)).toBeNull();

      document.dispatchEvent(mouseAt("mouseup", SEG_X));
      expect(get(manager.state)).toBe("idle");
      expect(get(manager.draggedRecordId)).toBeNull();
      clickSegment();
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a drag moves the strip and does not open it", () => {
      manager.initiate(record, processed, mouseAt("mousedown", SEG_X), "strip-move", segment);
      mouseDragTo(SEG_X + 200);
      expect(get(manager.state)).toBe("dragging");
      expect(get(manager.draggedRecordId)).toBe(record.id);

      document.dispatchEvent(mouseAt("mouseup", SEG_X + 200));
      expect(onCommit).toHaveBeenCalledTimes(1);
      const call = onCommit.mock.calls[0];
      expect(call?.[0].format("YYYY-MM-DD")).toBe("2026-10-08");
      expect(call?.[2]?.endDate?.format("YYYY-MM-DD")).toBe("2026-10-09");
      clickSegment();
      expect(onOpen).not.toHaveBeenCalled();
      // The re-grab window keeps `dragRecordId`, but the segment is hit-testable again.
      expect(get(manager.draggedRecordId)).toBeNull();
    });

    it("a resize from the end handle extends the strip and does not open it", () => {
      manager.initiate(record, processed, mouseAt("mousedown", SEG_X), "strip-resize-end", segment);
      mouseDragTo(SEG_X + 200);
      document.dispatchEvent(mouseAt("mouseup", SEG_X + 200));

      expect(onCommit).toHaveBeenCalledTimes(1);
      const call = onCommit.mock.calls[0];
      expect(call?.[0].format("YYYY-MM-DD")).toBe("2026-10-06");
      expect(call?.[2]?.endDate?.format("YYYY-MM-DD")).toBe("2026-10-08");
      clickSegment();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("a click right after a drag, past its guard, opens the record", () => {
      manager.initiate(record, processed, mouseAt("mousedown", SEG_X), "strip-move", segment);
      mouseDragTo(SEG_X + 200);
      document.dispatchEvent(mouseAt("mouseup", SEG_X + 200));
      jest.advanceTimersByTime(300); // past the mouse click guard, inside the re-grab window

      manager.initiate(record, processed, mouseAt("mousedown", SEG_X), "strip-move", segment);
      expect(get(manager.draggedRecordId)).toBeNull();
      document.dispatchEvent(mouseAt("mouseup", SEG_X));
      clickSegment();
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("touch", () => {
    it("a tap keeps the segment hit-testable, leaves the release default and opens the record", () => {
      manager.initiate(record, processed, touchAt("touchstart", SEG_X), "strip-move", segment);
      expect(get(manager.draggedRecordId)).toBeNull();
      jest.advanceTimersByTime(120);
      const end = touchAt("touchend", SEG_X);
      segment.dispatchEvent(end);

      expect(end.defaultPrevented).toBe(false);
      expect(get(manager.draggedRecordId)).toBeNull();
      clickSegment();
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a long press and a drag move the strip and do not open it", () => {
      manager.initiate(record, processed, touchAt("touchstart", SEG_X), "strip-move", segment);
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      expect(get(manager.draggedRecordId)).toBeNull();
      for (let x = SEG_X + 10; x <= SEG_X + 200; x += 10) segment.dispatchEvent(touchAt("touchmove", x));
      expect(get(manager.state)).toBe("dragging");
      expect(get(manager.draggedRecordId)).toBe(record.id);

      const end = touchAt("touchend", SEG_X + 200);
      segment.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]?.[0].format("YYYY-MM-DD")).toBe("2026-10-08");
      clickSegment();
      expect(onOpen).not.toHaveBeenCalled();
    });
  });
});
